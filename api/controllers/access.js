'use strict';

const AccessClient = require('../models/AccessClient');
const AccessGate = require('../models/AccessGate');
const Board = require('../models/Board');
const User = require('../models/User');

module.exports = {
  getClients: getClients,
  getAccessBoards: getAccessBoards,
  createAccessClient: createAccessClient,
  createAccessGate: createAccessGate,
  listAccessClients: listAccessClients,
  updateAccessClient: updateAccessClient,
  updateAccessGate: updateAccessGate,
  getAccessClientStats: getAccessClientStats,
  getMyAccessClients: getMyAccessClients,
  getMyAccessClientStats: getMyAccessClientStats
};

const DAY_IN_MS = 1000 * 60 * 60 * 24;

function getSubscriptionStatus(client, now) {
  const daysUntilExpiry = Math.ceil((client.subscriptionEnd - now) / DAY_IN_MS);
  return {
    isExpired: client.subscriptionEnd < now,
    daysUntilExpiry: Math.max(0, daysUntilExpiry)
  };
}

/**
 * Keeps User.isAccessClient in sync with whether each user is a member of any AccessClient.
 * @param {Array<string|ObjectId>} userIds
 */
async function syncAccessClientFlags(userIds) {
  const uniqueIds = [...new Set(userIds.map(id => id.toString()))];
  for (const userId of uniqueIds) {
    const isMember = await AccessClient.exists({ 'members.userId': userId });
    await User.updateOne(
      { _id: userId },
      { $set: { isAccessClient: !!isMember } }
    );
  }
}

/**
 * Resolves member emails to AccessClient member entries.
 * @param {Array<{email: string}>} members
 * @returns {Promise<{members: Array<{userId: ObjectId}>, missingEmails: string[]}>}
 */
async function resolveMembers(members) {
  const emails = [...new Set(members.map(m => m.email.trim()))];
  const users = await User.find({ email: { $in: emails } }, { email: 1 });
  const missingEmails = emails.filter(
    email => !users.some(user => user.email === email)
  );
  return {
    members: users.map(user => ({ userId: user._id })),
    missingEmails
  };
}

function getMemberIds(client) {
  return client.members.map(member => member.userId.toString());
}

/**
 * Collects usage stats for a client from its AccessGates and linked boards.
 * @param {Object} client - AccessClient document
 */
async function buildClientStats(client) {
  const accessGates = await AccessGate.find({ accessClientId: client._id });

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

  return {
    totalAccesses,
    lastAccessAt,
    boardCount: boards.length,
    boards: boards.map(b => ({
      id: b._id,
      name: b.name,
      tilesCount: b.tiles?.length || 0
    })),
    ...getSubscriptionStatus(client, new Date())
  };
}

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
    }).select('slug name brandColor');

    const accessGates = await AccessGate.find({
      accessClientId: { $in: clients.map(c => c._id) }
    })
      .populate('rootBoard', 'name caption tiles')
      .select('code rootBoardId accessClientId');

    const result = clients
      .map(client => ({
        slug: client.slug,
        clientName: client.name,
        brandColor: client.brandColor,
        accessGates: accessGates
          .filter(ag => ag.accessClientId.toString() === client._id.toString())
          .map(ag => ({
            code: ag.code,
            rootBoard: ag.rootBoard
              ? {
                  id: ag.rootBoard._id,
                  name: ag.rootBoard.name,
                  caption: ag.rootBoard.caption,
                  tilesCount: ag.rootBoard.tiles?.length || 0
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
 * GET /access/:clientSlug/:gateCode
 * Gets ALL boards for a slug + access code pair in a single request.
 * This enables instant frontend navigation without additional requests.
 * Validates slug and code exist, belong together, and client subscription is active.
 * Returns client info (slug, name, color), all boards array, and rootBoardId.
 * Increments viewsCount and updates lastAccessAt on the AccessGate.
 */
async function getAccessBoards(req, res) {
  const code = req.swagger.params.gateCode.value.toUpperCase();
  const slug = req.swagger.params.clientSlug.value;

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

    // Fire-and-forget analytics: never block the response or surface tracking errors to the caller.
    // $inc is atomic (safe under concurrency); $currentDate uses MongoDB server time for consistency across app nodes.
    AccessGate.updateOne(
      { _id: accessGate._id },
      {
        $inc: { viewsCount: 1 },
        $currentDate: { lastAccessAt: true }
      }
    ).catch(err =>
      console.error('[access] viewsCount update failed', {
        gateId: accessGate._id,
        error: err.message
      })
    );

    return res.status(200).json({
      client: {
        slug: client.slug,
        name: client.name,
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
 * POST /admin/access/clients
 * Creates a new Access client and its first Access gate.
 * Requires admin authentication (enforced by Swagger middleware).
 * Creates AccessClient, creates AccessGate, and updates boards with accessGate.
 * Validates rootBoardId exists.
 */
async function createAccessClient(req, res) {
  const {
    slug,
    clientName,
    contactName,
    clientEmail,
    clientPhone,
    brandColor,
    rootBoardId,
    subscriptionStart,
    subscriptionEnd,
    accessGateCode,
    members = []
  } = req.body;

  try {
    // Verify that the root board exists
    const rootBoard = await Board.findById(rootBoardId);
    if (!rootBoard) {
      return res.status(404).json({ message: 'Root board not found' });
    }

    const resolvedMembers = await resolveMembers(members);
    if (resolvedMembers.missingEmails.length) {
      return res.status(404).json({
        message: 'Member user not found',
        emails: resolvedMembers.missingEmails
      });
    }

    // Check for duplicates before persisting anything to avoid orphaned documents
    const [existingSlug, existingCode] = await Promise.all([
      AccessClient.findOne({ slug }),
      AccessGate.findOne({ code: accessGateCode.toUpperCase() })
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
      name: clientName,
      contact: { name: contactName, email: clientEmail, phone: clientPhone },
      brandColor,
      subscriptionStart: new Date(subscriptionStart),
      subscriptionEnd: new Date(subscriptionEnd),
      createdBy: req.user.id,
      members: resolvedMembers.members
    });

    await client.save();

    let newAccessGate;

    try {
      // Auto-discover all boards reachable from root via tile.loadBoard links
      const linkedBoardIds = await getAllLinkedBoardIds(rootBoardId);

      // Create the access gate
      newAccessGate = new AccessGate({
        code: accessGateCode.toUpperCase(),
        accessClientId: client._id,
        rootBoardId,
        linkedBoardIds: linkedBoardIds
      });

      await newAccessGate.save();

      // Mark all discovered boards with the access gate code
      await Board.updateMany(
        { _id: { $in: linkedBoardIds } },
        { $set: { accessGateCode: newAccessGate.code } }
      );
    } catch (err) {
      await AccessClient.deleteOne({ _id: client._id });
      if (newAccessGate?._id) {
        await AccessGate.deleteOne({ _id: newAccessGate._id });
      }
      throw err;
    }

    await syncAccessClientFlags(getMemberIds(client));

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
 * GET /admin/access/clients
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
    const accessGates = await AccessGate.find({ accessClientId: { $in: clientIds } });

    const agMap = accessGates.reduce((map, ag) => {
      const key = ag.accessClientId.toString();
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
 * POST /admin/access/clients/:clientSlug/gates
 * Adds a new AccessGate to an existing Access client.
 * Requires admin authentication (enforced by Swagger middleware).
 * Auto-discovers linked boards from rootBoardId and marks them with accessGateCode.
 */
async function createAccessGate(req, res) {
  const slug = req.swagger.params.clientSlug.value;
  const { accessGateCode, rootBoardId } = req.body;

  try {
    const client = await AccessClient.findOne({ slug });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const rootBoard = await Board.findById(rootBoardId);
    if (!rootBoard) {
      return res.status(404).json({ message: 'Root board not found' });
    }

    const existingCode = await AccessGate.findOne({
      code: accessGateCode.toUpperCase()
    });
    if (existingCode) {
      return res.status(409).json({ message: 'Code already exists' });
    }

    const linkedBoardIds = await getAllLinkedBoardIds(rootBoardId);

    const newAccessGate = new AccessGate({
      code: accessGateCode.toUpperCase(),
      accessClientId: client._id,
      rootBoardId,
      linkedBoardIds
    });

    await newAccessGate.save();

    await Board.updateMany(
      { _id: { $in: linkedBoardIds } },
      { $set: { accessGateCode: newAccessGate.code } }
    );

    return res.status(201).json(newAccessGate.toJSON());
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Code already exists' });
    }
    return res.status(500).json({
      message: 'Error creating access gate',
      error: err.message
    });
  }
}

/**
 * PUT /admin/access/clients/:clientSlug
 * Updates an Access client.
 * Allowed fields: isActive, subscription dates, branding, client name, contact name/email/phone, members.
 * When members is sent, it replaces the current member list.
 */
async function updateAccessClient(req, res) {
  const slug = req.swagger.params.clientSlug.value;
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
    if (updates.clientName) client.name = updates.clientName;
    if (updates.contactName) client.contact.name = updates.contactName;
    if (updates.clientEmail) client.contact.email = updates.clientEmail;
    if (updates.clientPhone) client.contact.phone = updates.clientPhone;
    if (updates.brandColor) client.brandColor = updates.brandColor;

    const previousMemberIds = getMemberIds(client);
    if (updates.members !== undefined) {
      const resolvedMembers = await resolveMembers(updates.members);
      if (resolvedMembers.missingEmails.length) {
        return res.status(404).json({
          message: 'Member user not found',
          emails: resolvedMembers.missingEmails
        });
      }
      client.members = resolvedMembers.members;
    }

    await client.save();

    const currentMemberIds = getMemberIds(client);
    const changedMemberIds = [
      ...previousMemberIds.filter(id => !currentMemberIds.includes(id)),
      ...currentMemberIds.filter(id => !previousMemberIds.includes(id))
    ];
    await syncAccessClientFlags(changedMemberIds);

    return res.status(200).json(client.toJSON());
  } catch (err) {
    return res.status(500).json({
      message: 'Error updating client',
      error: err.message
    });
  }
}

/**
 * GET /admin/access/clients/:clientSlug/stats
 * Gets detailed statistics for an Access client.
 * Returns client info, access counts (from AccessGates), board list with tile counts.
 */
async function getAccessClientStats(req, res) {
  const slug = req.swagger.params.clientSlug.value;

  try {
    const client = await AccessClient.findOne({ slug })
      .populate('createdBy', 'name email role');

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    return res.status(200).json({
      client: client.toJSON(),
      stats: await buildClientStats(client)
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error getting client statistics',
      error: err.message
    });
  }
}

/**
 * PUT /admin/access/gates/:gateCode
 * Re-runs board discovery for an access gate, updating its linkedBoardIds.
 * Optionally accepts a new rootBoardId to change the root and re-discover from there.
 * Useful when the board structure has changed since the access gate was created.
 */
async function updateAccessGate(req, res) {
  const code = req.swagger.params.gateCode.value.toUpperCase();
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

    const oldLinkedBoardIds = accessGate.linkedBoardIds.map(id => id.toString());

    // Re-discover all boards reachable from root
    const linkedBoardIds = await getAllLinkedBoardIds(newRootBoardId);
    const newLinkedBoardIds = linkedBoardIds.map(id => id.toString());
    const removedIds = oldLinkedBoardIds.filter(id => !newLinkedBoardIds.includes(id));

    accessGate.rootBoardId = newRootBoardId;
    accessGate.linkedBoardIds = linkedBoardIds;
    await accessGate.save();

    if (removedIds.length) {
      await Board.updateMany(
        { _id: { $in: removedIds }, accessGateCode: code },
        { $set: { accessGateCode: null } }
      );
    }
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

// ============================================
// MEMBER ENDPOINTS
// Members have read-only access: boards are managed by the Cboard team.
// ============================================

/**
 * GET /access/me/clients
 * Lists the Access clients the authenticated user is a member of, with their
 * access gates, usage counters and subscription status.
 */
async function getMyAccessClients(req, res) {
  try {
    const clients = await AccessClient.find({
      'members.userId': req.user.id
    }).sort({ name: 1 });

    const accessGates = await AccessGate.find({
      accessClientId: { $in: clients.map(c => c._id) }
    })
      .populate('rootBoard', 'name caption tiles')
      .select('code rootBoardId accessClientId viewsCount lastAccessAt');

    const now = new Date();
    const result = clients.map(client => ({
      slug: client.slug,
      clientName: client.name,
      brandColor: client.brandColor,
      isActive: client.isActive,
      subscriptionStart: client.subscriptionStart,
      subscriptionEnd: client.subscriptionEnd,
      ...getSubscriptionStatus(client, now),
      accessGates: accessGates
        .filter(ag => ag.accessClientId.toString() === client._id.toString())
        .map(ag => ({
          code: ag.code,
          viewsCount: ag.viewsCount || 0,
          lastAccessAt: ag.lastAccessAt,
          rootBoard: ag.rootBoard
            ? {
                id: ag.rootBoard._id,
                name: ag.rootBoard.name,
                caption: ag.rootBoard.caption,
                tilesCount: ag.rootBoard.tiles?.length || 0
              }
            : null
        }))
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
 * GET /access/me/clients/:clientSlug/stats
 * Gets detailed statistics for an Access client the authenticated user is a member of.
 */
async function getMyAccessClientStats(req, res) {
  const slug = req.swagger.params.clientSlug.value;

  try {
    const client = await AccessClient.findOne({
      slug,
      'members.userId': req.user.id
    });

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const { createdBy, members, ...clientData } = client.toJSON();

    return res.status(200).json({
      client: clientData,
      stats: await buildClientStats(client)
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error getting client statistics',
      error: err.message
    });
  }
}