'use strict';

const AccessClient = require('../models/AccessClient');
const AccessPoint = require('../models/AccessPoint');
const Board = require('../models/Board');

module.exports = {
  getClients: getClients,
  getAccessBoard: getAccessBoard,
  createAccessClient: createAccessClient,
  listAccessClients: listAccessClients,
  updateAccessClient: updateAccessClient,
  updateAccessPoint: updateAccessPoint,
  getAccessClientStats: getAccessClientStats
};

/**
 * Recursively discovers all boards reachable from a root board via tile.loadBoard references.
 * The visited Set is shared across all recursive calls (passed by reference), so any board
 * already discovered is skipped immediately — this prevents infinite loops from tiles that
 * navigate back to a parent board (e.g. a "home" tile).
 * @param {string|ObjectId} rootBoardId - Starting board ID
 * @param {Set<string>} visited - Shared set of already-visited IDs (prevents cycles)
 */
async function discoverLinkedBoards(rootBoardId, visited) {
  const id = rootBoardId.toString();
  if (visited.has(id)) return; // Already discovered — skip to prevent cycles
  visited.add(id);

  const board = await Board.findById(id);
  if (!board?.tiles) return;

  for (const tile of board.tiles) {
    if (tile.loadBoard) {
      await discoverLinkedBoards(tile.loadBoard, visited);
    }
  }
}

/**
 * Returns all board IDs reachable from rootBoardId, including rootBoardId itself.
 * @param {string|ObjectId} rootBoardId
 * @returns {Promise<string[]>}
 */
async function getAllLinkedBoardIds(rootBoardId) {
  const visited = new Set();
  await discoverLinkedBoards(rootBoardId, visited);
  return [...visited];
}

/**
 * GET /access/clients
 * Lists all active clients with valid subscriptions and their access points.
 * Returns each client with its access points and root board basic info.
 * Sorted by client name.
 */
async function getClients(req, res) {
  try {
    const now = new Date();
    const clients = await AccessClient.find({
      isActive: true,
      subscriptionStart: { $lte: now },
      subscriptionEnd: { $gte: now }
    }).select('slug client brandColor');

    const accessPoints = await AccessPoint.find({
      accessClient: { $in: clients.map(c => c._id) }
    })
      .populate('rootBoardId', 'name caption tiles')
      .select('code rootBoardId accessClient');

    const result = clients
      .map(client => ({
        slug: client.slug,
        clientName: client.client.name,
        brandColor: client.brandColor,
        accessPoints: accessPoints
          .filter(ap => ap.accessClient.toString() === client._id.toString())
          .map(ap => ({
            code: ap.code,
            rootBoard: ap.rootBoardId
              ? {
                  id: ap.rootBoardId._id,
                  name: ap.rootBoardId.name,
                  caption: ap.rootBoardId.caption,
                  tilesCount: ap.rootBoardId.tiles?.length || 0
                }
              : null
          }))
      }))
      .sort((a, b) => a.clientName.localeCompare(b.clientName));

    return res.status(200).json({
      total: result.length,
      data: result
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error listing clients',
      error: err.message
    });
  }
}

/**
 * GET /access/:code
 * Gets ALL boards for an access code in a single request.
 * This enables instant frontend navigation without additional requests.
 * Validates code exists and client subscription is active.
 * Returns client info (slug, name, color), all boards array, and rootBoardId.
 * Increments viewsCount and updates lastAccessAt on the AccessPoint.
 */
async function getAccessBoard(req, res) {
  const code = req.swagger.params.code.value.toUpperCase();

  try {
    const now = new Date();
    const accessPoint = await AccessPoint.findOne({ code }).populate(
      'accessClient'
    );

    if (!accessPoint) {
      return res.status(404).json({
        message: 'Invalid access code'
      });
    }

    const client = accessPoint.accessClient;
    if (
      !client ||
      !client.isActive ||
      client.subscriptionStart > now ||
      client.subscriptionEnd < now
    ) {
      return res.status(404).json({
        message: 'Invalid or expired access code'
      });
    }

    // Fetch all linked boards (exclude PII fields for public endpoint)
    const boards = await Board.find({
      _id: { $in: accessPoint.linkedBoardsIds }
    }).select('-email -author');

    if (!boards || boards.length === 0) {
      return res.status(404).json({
        message: 'No boards available for this code'
      });
    }

    // Verify the rootBoard exists among the linked boards
    const rootBoard = boards.find(
      b => b._id.toString() === accessPoint.rootBoardId.toString()
    );
    if (!rootBoard) {
      return res.status(404).json({
        message: 'Root board not found'
      });
    }

    // Track access analytics atomically to avoid lost updates under concurrency
    await AccessPoint.updateOne(
      { _id: accessPoint._id },
      {
        $inc: { viewsCount: 1 },
        $set: { lastAccessAt: new Date() }
      }
    );

    return res.status(200).json({
      client: {
        code: client.slug,
        name: client.client.name,
        color: client.brandColor
      },
      boards: boards.map(b => b.toJSON()),
      rootBoardId: accessPoint.rootBoardId.toString()
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error getting boards',
      error: err.message
    });
  }
}

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * POST /admin/access-clients
 * Creates a new Access client and its first Access point.
 * Requires admin authentication (enforced by Swagger middleware).
 * Creates AccessClient, creates AccessPoint, and updates boards with accessGate.
 * Validates rootBoardId exists.
 */
async function createAccessClient(req, res) {
  const {
    slug,
    clientName,
    clientContact,
    brandColor,
    rootBoardId,
    subscriptionStart,
    subscriptionEnd,
    accessGate
  } = req.body;

  try {
    // Verify that the root board exists
    const rootBoard = await Board.findById(rootBoardId);
    if (!rootBoard) {
      return res.status(404).json({ message: 'Root board not found' });
    }

    // Create the client
    const client = new AccessClient({
      slug,
      client: { name: clientName, contact: clientContact },
      brandColor,
      subscriptionStart: new Date(subscriptionStart),
      subscriptionEnd: new Date(subscriptionEnd),
      createdBy: req.user.id
    });

    await client.save();

    // Auto-discover all boards reachable from root via tile.loadBoard links
    const linkedBoardIds = await getAllLinkedBoardIds(rootBoardId);

    // Create the access point
    const accessPoint = new AccessPoint({
      code: accessGate.toUpperCase(),
      accessClient: client._id,
      rootBoardId,
      linkedBoardsIds: linkedBoardIds
    });

    await accessPoint.save();

    // Mark all discovered boards with the access point code
    await Board.updateMany(
      { _id: { $in: linkedBoardIds } },
      { $set: { accessGate: accessPoint.code } }
    );

    return res.status(201).json({ ...client.toJSON(), accessPoint: accessPoint.toJSON() });
  } catch (err) {
    if (err.code === 11000) {
      const isSlugDuplicate = err.message.includes('slug');
      return res.status(409).json({
        message: isSlugDuplicate ? 'Slug already exists' : 'Code already exists'
      });
    }
    return res.status(500).json({
      message: 'Error creating client',
      error: err.message
    });
  }
}

/**
 * GET /admin/access-clients
 * Lists all Access clients with stats.
 * Returns all clients with board counts, expiry status.
 * Populates createdBy. Board count derived from AccessPoint.linkedBoardsIds.
 */
async function listAccessClients(req, res) {
  try {
    const clients = await AccessClient.find()
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    // Fetch access points and sum linkedBoardsIds per client to avoid N+1
    const clientIds = clients.map(c => c._id);
    const accessPoints = await AccessPoint.find({ accessClient: { $in: clientIds } });

    const apMap = accessPoints.reduce((map, ap) => {
      const key = ap.accessClient.toString();
      if (!map[key]) map[key] = 0;
      map[key] += ap.linkedBoardsIds?.length || 0;
      return map;
    }, {});

    const now = new Date();
    const result = clients.map(client => {
      const boardCount = apMap[client._id.toString()] || 0;
      const daysUntilExpiry = Math.ceil(
        (client.subscriptionEnd - now) / (1000 * 60 * 60 * 24)
      );

      return {
        ...client.toJSON(),
        boardCount,
        isExpired: client.subscriptionEnd < now,
        daysUntilExpiry: Math.max(0, daysUntilExpiry)
      };
    });

    return res.status(200).json({
      total: result.length,
      data: result
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error listing clients',
      error: err.message
    });
  }
}

/**
 * PUT /admin/access-clients/:slug
 * Updates an Access client.
 * Allowed fields: isActive, subscription dates, branding, client name/contact.
 */
async function updateAccessClient(req, res) {
  const slug = req.swagger.params.slug.value;
  const updates = req.body;

  try {
    const client = await AccessClient.findOne({ slug });

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (updates.isActive !== undefined) client.isActive = updates.isActive;
    if (updates.subscriptionStart)
      client.subscriptionStart = new Date(updates.subscriptionStart);
    if (updates.subscriptionEnd)
      client.subscriptionEnd = new Date(updates.subscriptionEnd);
    if (updates.clientName) client.client.name = updates.clientName;
    if (updates.clientContact) client.client.contact = updates.clientContact;
    if (updates.brandColor) client.brandColor = updates.brandColor;

    await client.save();

    return res.status(200).json(client.toJSON());
  } catch (err) {
    return res.status(500).json({
      message: 'Error updating client',
      error: err.message
    });
  }
}

/**
 * GET /admin/access-clients/:slug/stats
 * Gets detailed statistics for an Access client.
 * Returns client info, access counts (from AccessPoints), board list with tile counts.
 */
async function getAccessClientStats(req, res) {
  const slug = req.swagger.params.slug.value;

  try {
    const client = await AccessClient.findOne({ slug })
      .populate('createdBy', 'name email role');

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const accessPoints = await AccessPoint.find({ accessClient: client._id });

    // Collect unique board IDs across all access points
    const allBoardIds = [
      ...new Set(accessPoints.flatMap(ap => ap.linkedBoardsIds.map(id => id.toString())))
    ];
    const boards = await Board.find({ _id: { $in: allBoardIds } }, { name: 1, tiles: 1 });

    const totalAccesses = accessPoints.reduce((sum, ap) => sum + (ap.viewsCount || 0), 0);
    const lastAccessAt = accessPoints.reduce((latest, ap) => {
      if (!ap.lastAccessAt) return latest;
      if (!latest || ap.lastAccessAt > latest) return ap.lastAccessAt;
      return latest;
    }, null);

    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (client.subscriptionEnd - now) / (1000 * 60 * 60 * 24)
    );

    return res.status(200).json({
      client: client.toJSON(),
      stats: {
        totalAccesses,
        lastAccessAt,
        boardCount: boards.length,
        boards: boards.map(b => ({
          id: b._id,
          name: b.name,
          tilesCount: b.tiles?.length || 0
        })),
        daysUntilExpiry: Math.max(0, daysUntilExpiry),
        isExpired: client.subscriptionEnd < now
      }
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error getting client statistics',
      error: err.message
    });
  }
}

/**
 * PUT /admin/access-points/:code
 * Re-runs board discovery for an access point, updating its linkedBoardsIds.
 * Optionally accepts a new rootBoardId to change the root and re-discover from there.
 * Useful when the board structure has changed since the access point was created.
 */
async function updateAccessPoint(req, res) {
  const code = req.swagger.params.code.value.toUpperCase();
  const { rootBoardId } = req.body;

  try {
    const accessPoint = await AccessPoint.findOne({ code });
    if (!accessPoint) {
      return res.status(404).json({ message: 'Access point not found' });
    }

    const newRootBoardId = rootBoardId || accessPoint.rootBoardId;

    // Verify root board exists
    const rootBoard = await Board.findById(newRootBoardId);
    if (!rootBoard) {
      return res.status(404).json({ message: 'Root board not found' });
    }

    // Re-discover all boards reachable from root
    const linkedBoardIds = await getAllLinkedBoardIds(newRootBoardId);

    accessPoint.rootBoardId = newRootBoardId;
    accessPoint.linkedBoardsIds = linkedBoardIds;
    await accessPoint.save();

    // Mark all discovered boards with this access point code
    await Board.updateMany(
      { _id: { $in: linkedBoardIds } },
      { $set: { accessGate: code } }
    );

    return res.status(200).json(accessPoint.toJSON());
  } catch (err) {
    return res.status(500).json({
      message: 'Error updating access point',
      error: err.message
    });
  }
}
