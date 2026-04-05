'use strict';

const AccessClient = require('../models/AccessClient');
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
 * Recursively discovers all boards linked from a root board.
 * Traverses tile.loadBoard references to find the complete board structure.
 * @param {string} rootBoardId - The starting board ID
 * @param {Set} visited - Set of already visited board IDs (prevents cycles)
 * @returns {Promise<string[]>} - Array of all discovered board IDs
 */
async function discoverLinkedBoards(rootBoardId, visited = new Set()) {
  // Prevent infinite loops from circular references
  if (visited.has(rootBoardId.toString())) {
    return [];
  }
  visited.add(rootBoardId.toString());

  const board = await Board.findById(rootBoardId);
  if (!board) {
    return [];
  }

  const linkedBoardIds = [];

  // Find all tiles that link to other boards
  if (board.tiles && Array.isArray(board.tiles)) {
    for (const tile of board.tiles) {
      if (tile.loadBoard) {
        const linkedId = tile.loadBoard.toString();
        if (!visited.has(linkedId)) {
          linkedBoardIds.push(linkedId);
          // Recursively discover boards linked from this board
          const nestedIds = await discoverLinkedBoards(linkedId, visited);
          linkedBoardIds.push(...nestedIds);
        }
      }
    }
  }

  return linkedBoardIds;
}

/**
 * Gets all board IDs for an access client, starting from root.
 * Returns rootBoardId + all recursively linked boards.
 * @param {string} rootBoardId - The root board ID
 * @returns {Promise<string[]>} - Array of all board IDs
 */
async function getAllLinkedBoardIds(rootBoardId) {
  const visited = new Set();
  const linkedIds = await discoverLinkedBoards(rootBoardId, visited);
  // Return unique IDs including root
  return [...new Set([rootBoardId.toString(), ...linkedIds])];
}

/**
 * GET /access/clients
 * Lists active companies for Cboard Access listing in the app.
 * Returns clients where isActive=true, isListedInApp=true, and subscription is valid.
 * Populates rootBoard basic info (name, caption, tiles count).
 * Sorted by clientName.
 */
async function getClients(req, res) {
  try {
    const now = new Date();
    const clients = await AccessClient.find({
      isActive: true,
      isListedInApp: true,
      subscriptionStart: { $lte: now },
      subscriptionEnd: { $gte: now }
    })
      .populate('rootBoardId', 'name caption tiles')
      .select('code clientName brandColor rootBoardId')
      .sort({ clientName: 1 });

    const result = clients.map(client => ({
      code: client.code,
      clientName: client.clientName,
      brandColor: client.brandColor,
      rootBoard: client.rootBoardId
        ? {
            id: client.rootBoardId._id,
            name: client.rootBoardId.name,
            caption: client.rootBoardId.caption,
            tilesCount: client.rootBoardId.tiles?.length || 0
          }
        : null
    }));

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
 * Validates code exists and subscription is active.
 * Returns client info (code, name, color), all boards array, and rootBoardId.
 * Increments accessCount and updates lastAccessAt.
 */
async function getAccessBoard(req, res) {
  const code = req.swagger.params.code.value.toUpperCase();

  try {
    const now = new Date();
    const client = await AccessClient.findOne({
      code: code,
      isActive: true,
      subscriptionStart: { $lte: now },
      subscriptionEnd: { $gte: now }
    });

    if (!client) {
      return res.status(404).json({
        message: 'Invalid or expired access code'
      });
    }

    // Get ALL boards with this accessCode (exclude PII fields for public endpoint)
    const boards = await Board.find({ accessCode: code }).select(
      '-email -author'
    );

    if (!boards || boards.length === 0) {
      return res.status(404).json({
        message: 'No boards available for this code'
      });
    }

    // Verify the rootBoard exists
    const rootBoard = boards.find(
      b => b._id.toString() === client.rootBoardId.toString()
    );
    if (!rootBoard) {
      return res.status(404).json({
        message: 'Root board not found'
      });
    }

    // Track access analytics atomically to avoid lost updates under concurrency
    await AccessClient.updateOne(
      { _id: client._id },
      {
        $inc: { accessCount: 1 },
        $set: { lastAccessAt: new Date() }
      }
    );

    return res.status(200).json({
      client: {
        code: client.code,
        name: client.clientName,
        color: client.brandColor
      },
      boards: boards.map(b => b.toJSON()),
      rootBoardId: client.rootBoardId.toString()
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
    boardIds // Optional: Array of board IDs to associate. If not provided, auto-discovers linked boards.
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

    // Determine which boards to associate with the access code
    // If boardIds provided, use them; otherwise auto-discover all linked boards
    let allBoardIds;
    if (boardIds && boardIds.length > 0) {
      allBoardIds = [...new Set([rootBoardId.toString(), ...boardIds.map(id => id.toString())])];
    } else {
      // Auto-discover all boards linked from the root board
      allBoardIds = await getAllLinkedBoardIds(rootBoardId);
    }

    await Board.updateMany(
      { _id: { $in: allBoardIds } },
      { $set: { accessCode: code.toUpperCase() } }
    );

    // Return response with discovered board count
    const response = client.toJSON();
    response.linkedBoardsCount = allBoardIds.length;
    response.linkedBoardIds = allBoardIds;

    return res.status(201).json(response);
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
 * GET /admin/access-clients
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
 * PUT /admin/access-clients/:code
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
 * GET /admin/access-clients/:code/stats
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
