'use strict';

const AccessClient = require('../models/AccessClient');
const AccessGate = require('../models/AccessGate');
const Board = require('../models/Board');

module.exports = {
  getClients: getClients,
  getAccessBoard: getAccessBoard,
  createAccessClient: createAccessClient,
  listAccessClients: listAccessClients,
  updateAccessClient: updateAccessClient,
  updateAccessGate: updateAccessGate,
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
 * GET /access/clients/all
 * Lists all active clients with valid subscriptions and their access gates.
 * Returns each client with its access gates and root board basic info.
 * Sorted by client name.
 */
async function getClients(req, res) {
  try {
    const now = new Date();
    const clients = await AccessClient.find({
      isActive: true,
      subscriptionStart: { $lte: now },
      subscriptionEnd: { $gte: now }
    }).select('slug contact brandColor');

    const accessGates = await AccessGate.find({
      accessClient: { $in: clients.map(c => c._id) }
    })
      .populate('rootBoardId', 'name caption tiles')
      .select('code rootBoardId accessClient');

    const result = clients
      .map(client => ({
        slug: client.slug,
        clientName: client.contact.name,
        brandColor: client.brandColor,
        accessGates: accessGates
          .filter(ag => ag.accessClient.toString() === client._id.toString())
          .map(ag => ({
            code: ag.code,
            rootBoard: ag.rootBoardId
              ? {
                  id: ag.rootBoardId._id,
                  name: ag.rootBoardId.name,
                  caption: ag.rootBoardId.caption,
                  tilesCount: ag.rootBoardId.tiles?.length || 0
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
 * GET /access/:slug/:code
 * Gets ALL boards for a slug + access code pair in a single request.
 * This enables instant frontend navigation without additional requests.
 * Validates slug and code exist, belong together, and client subscription is active.
 * Returns client info (slug, name, color), all boards array, and rootBoardId.
 * Increments viewsCount and updates lastAccessAt on the AccessGate.
 */
async function getAccessBoard(req, res) {
  const code = req.swagger.params.code.value.toUpperCase();
  const slug = req.swagger.params.slug.value;

  try {
    const now = new Date();
    const accessGate = await AccessGate.findOne({ code }).populate(
      'accessClient'
    );

    if (!accessGate) {
      return res.status(404).json({
        message: 'Invalid access code'
      });
    }

    const client = accessGate.accessClient;
    if (
      !client ||
      client.slug !== slug ||
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
      _id: { $in: accessGate.linkedBoardIds }
    }).select('-email -author');

    if (!boards || boards.length === 0) {
      return res.status(404).json({
        message: 'No boards available for this code'
      });
    }

    // Verify the rootBoard exists among the linked boards
    const rootBoard = boards.find(
      b => b._id.toString() === accessGate.rootBoardId.toString()
    );
    if (!rootBoard) {
      return res.status(404).json({
        message: 'Root board not found'
      });
    }

    // Track access analytics atomically to avoid lost updates under concurrency
    await AccessGate.updateOne(
      { _id: accessGate._id },
      {
        $inc: { viewsCount: 1 },
        $set: { lastAccessAt: new Date() }
      }
    );

    return res.status(200).json({
      client: {
        code: client.slug,
        name: client.contact.name,
        color: client.brandColor
      },
      boards: boards.map(b => b.toJSON()),
      rootBoardId: accessGate.rootBoardId.toString()
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
 * Creates a new Access client and its first Access gate.
 * Requires admin authentication (enforced by Swagger middleware).
 * Creates AccessClient, creates AccessGate, and updates boards with accessGate.
 * Validates rootBoardId exists.
 */
async function createAccessClient(req, res) {
  const {
    slug,
    clientName,
    clientEmail,
    clientPhone,
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

    // Check for duplicates before persisting anything to avoid orphaned documents
    const [existingSlug, existingCode] = await Promise.all([
      AccessClient.findOne({ slug }),
      AccessGate.findOne({ code: accessGate.toUpperCase() })
    ]);
    if (existingSlug) {
      return res.status(409).json({ message: 'Slug already exists' });
    }
    if (existingCode) {
      return res.status(409).json({ message: 'Code already exists' });
    }

    // Create the client
    const client = new AccessClient({
      slug,
      contact: { name: clientName, email: clientEmail, phone: clientPhone },
      brandColor,
      subscriptionStart: new Date(subscriptionStart),
      subscriptionEnd: new Date(subscriptionEnd),
      createdBy: req.user.id
    });

    await client.save();

    // Auto-discover all boards reachable from root via tile.loadBoard links
    const linkedBoardIds = await getAllLinkedBoardIds(rootBoardId);

    // Create the access gate
    const newAccessGate = new AccessGate({
      code: accessGate.toUpperCase(),
      accessClient: client._id,
      rootBoardId,
      linkedBoardIds: linkedBoardIds
    });

    await newAccessGate.save();

    // Mark all discovered boards with the access gate code
    await Board.updateMany(
      { _id: { $in: linkedBoardIds } },
      { $set: { accessGateCode: newAccessGate.code } }
    );

    return res.status(201).json({ ...client.toJSON(), accessGate: newAccessGate.toJSON() });
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
 * Populates createdBy. Board count derived from AccessGate.linkedBoardIds.
 */
async function listAccessClients(req, res) {
  try {
    const clients = await AccessClient.find()
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    // Fetch access gates and sum linkedBoardIds per client to avoid N+1
    const clientIds = clients.map(c => c._id);
    const accessGates = await AccessGate.find({ accessClient: { $in: clientIds } });

    const agMap = accessGates.reduce((map, ag) => {
      const key = ag.accessClient.toString();
      if (!map[key]) map[key] = 0;
      map[key] += ag.linkedBoardIds?.length || 0;
      return map;
    }, {});

    const now = new Date();
    const result = clients.map(client => {
      const boardCount = agMap[client._id.toString()] || 0;
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
 * Allowed fields: isActive, subscription dates, branding, client name/email/phone.
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
    if (updates.clientName) client.contact.name = updates.clientName;
    if (updates.clientEmail) client.contact.email = updates.clientEmail;
    if (updates.clientPhone) client.contact.phone = updates.clientPhone;
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
 * Returns client info, access counts (from AccessGates), board list with tile counts.
 */
async function getAccessClientStats(req, res) {
  const slug = req.swagger.params.slug.value;

  try {
    const client = await AccessClient.findOne({ slug })
      .populate('createdBy', 'name email role');

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const accessGates = await AccessGate.find({ accessClient: client._id });

    // Collect unique board IDs across all access gates
    const allBoardIds = [
      ...new Set(accessGates.flatMap(ag => ag.linkedBoardIds.map(id => id.toString())))
    ];
    const boards = await Board.find({ _id: { $in: allBoardIds } }, { name: 1, tiles: 1 });

    const totalAccesses = accessGates.reduce((sum, ag) => sum + (ag.viewsCount || 0), 0);
    const lastAccessAt = accessGates.reduce((latest, ag) => {
      if (!ag.lastAccessAt) return latest;
      if (!latest || ag.lastAccessAt > latest) return ag.lastAccessAt;
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
 * PUT /admin/access-gates/:code
 * Re-runs board discovery for an access gate, updating its linkedBoardIds.
 * Optionally accepts a new rootBoardId to change the root and re-discover from there.
 * Useful when the board structure has changed since the access gate was created.
 */
async function updateAccessGate(req, res) {
  const code = req.swagger.params.code.value.toUpperCase();
  const { rootBoardId } = req.body;

  try {
    const accessGate = await AccessGate.findOne({ code });
    if (!accessGate) {
      return res.status(404).json({ message: 'Access gate not found' });
    }

    const newRootBoardId = rootBoardId || accessGate.rootBoardId;

    // Verify root board exists
    const rootBoard = await Board.findById(newRootBoardId);
    if (!rootBoard) {
      return res.status(404).json({ message: 'Root board not found' });
    }

    // Re-discover all boards reachable from root
    const linkedBoardIds = await getAllLinkedBoardIds(newRootBoardId);

    accessGate.rootBoardId = newRootBoardId;
    accessGate.linkedBoardIds = linkedBoardIds;
    await accessGate.save();

    // Mark all discovered boards with this access gate code
    await Board.updateMany(
      { _id: { $in: linkedBoardIds } },
      { $set: { accessGateCode: code } }
    );

    return res.status(200).json(accessGate.toJSON());
  } catch (err) {
    return res.status(500).json({
      message: 'Error updating access gate',
      error: err.message
    });
  }
}