'use strict';

const AccessClient = require('../models/AccessClient');
const AccessPoint = require('../models/AccessPoint');
const Board = require('../models/Board');

module.exports = {
  getClients: getClients,
  getAccessBoard: getAccessBoard
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
