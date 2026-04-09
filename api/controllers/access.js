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
  getAccessClientStats: getAccessClientStats
};

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
 * POST /api/admin/access-clients
 * Creates a new Access client.
 * Requires admin authentication (enforced by Swagger middleware).
 * Creates AccessClient and updates boards with accessCode.
 * Validates rootBoardId exists.
 */
async function createAccessClient(req, res) {
  const {
    code,
    clientName,
    clientContact,
    brandColor,
    rootBoardId,
    subscriptionStart,
    subscriptionEnd,
    boardIds // Array of board IDs to associate
  } = req.body;

  try {
    // Verify that the root board exists
    const rootBoard = await Board.findById(rootBoardId);
    if (!rootBoard) {
      return res.status(404).json({ message: 'Root board not found' });
    }

    // Create the client
    const client = new AccessClient({
      code: code.toUpperCase(),
      clientName,
      clientContact,
      brandColor,
      rootBoardId,
      subscriptionStart: new Date(subscriptionStart),
      subscriptionEnd: new Date(subscriptionEnd),
      createdBy: req.user.id
    });

    await client.save();

    // Mark the boards with the accessCode
    // Ensure rootBoardId is always included even if boardIds is empty array
    const allBoardIds = boardIds && boardIds.length > 0 
      ? [...new Set([rootBoardId.toString(), ...boardIds.map(id => id.toString())])]
      : [rootBoardId];
    await Board.updateMany(
      { _id: { $in: allBoardIds } },
      { $set: { accessCode: code.toUpperCase() } }
    );

    return res.status(201).json(client.toJSON());
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Code already exists' });
    }
    return res.status(500).json({
      message: 'Error creating client',
      error: err.message
    });
  }
}

/**
 * GET /api/admin/access-clients
 * Lists all Access clients with stats.
 * Returns all clients with board counts, expiry status.
 * Populates rootBoard and createdBy.
 */
async function listAccessClients(req, res) {
  try {
    const clients = await AccessClient.find()
      .populate('rootBoardId', 'name')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Precompute board counts for all clients in a single query to avoid N+1
    const accessCodes = clients.map(client => client.code);
    const boardCounts = await Board.aggregate([
      { $match: { accessCode: { $in: accessCodes } } },
      { $group: { _id: '$accessCode', count: { $sum: 1 } } }
    ]);

    const boardCountMap = boardCounts.reduce((map, entry) => {
      map[entry._id] = entry.count;
      return map;
    }, {});

    const now = new Date();
    const result = clients.map(client => {
      const boardCount = boardCountMap[client.code] || 0;
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
 * PUT /api/admin/access-clients/:code
 * Updates an Access client.
 * Allowed fields: isActive, isListedInApp, subscription dates, branding.
 */
async function updateAccessClient(req, res) {
  const code = req.swagger.params.code.value.toUpperCase();
  const updates = req.body;

  try {
    const client = await AccessClient.findOne({ code });

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Updatable fields
    if (updates.isActive !== undefined) client.isActive = updates.isActive;
    if (updates.isListedInApp !== undefined)
      client.isListedInApp = updates.isListedInApp;
    if (updates.subscriptionStart)
      client.subscriptionStart = new Date(updates.subscriptionStart);
    if (updates.subscriptionEnd)
      client.subscriptionEnd = new Date(updates.subscriptionEnd);
    if (updates.clientName) client.clientName = updates.clientName;
    if (updates.clientContact) client.clientContact = updates.clientContact;
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
 * GET /api/admin/access-clients/:code/stats
 * Gets detailed statistics for an Access client.
 * Returns client info, access counts, board list with tile counts.
 */
async function getAccessClientStats(req, res) {
  const code = req.swagger.params.code.value.toUpperCase();

  try {
    const client = await AccessClient.findOne({ code })
      .populate('rootBoardId', 'name tiles')
      .populate('createdBy', 'name email');

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const boards = await Board.find({ accessCode: code }, { name: 1, tiles: 1 });

    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (client.subscriptionEnd - now) / (1000 * 60 * 60 * 24)
    );

    return res.status(200).json({
      client: client.toJSON(),
      stats: {
        totalAccesses: client.accessCount,
        lastAccessAt: client.lastAccessAt,
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
