'use strict';

const AccessClient = require('../models/AccessClient');
const Board = require('../models/Board');

module.exports = {
  getClients: getClients,
  getAccessBoard: getAccessBoard
};

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
