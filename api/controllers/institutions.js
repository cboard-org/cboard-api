'use strict';
const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Subscriber = require('../models/Subscribers');
const { verifyToken } = require('../helpers/auth');
const { createBridge } = require('../helpers/institutional-bridge');
const { institutionalLimits } = require('../helpers/institutional-rate-limit');

function bridge() {
  return createBridge({
    product: 'cboard',
    db: mongoose.connection.db,
    accountExists: async userId =>
      mongoose.isValidObjectId(userId) &&
      !!(await User.findById(userId).select('_id'))
  });
}
async function entitlements(userId) {
  return bridge().entitlements(String(userId));
}
function router() {
  const router = express.Router();
  const limits = institutionalLimits(() => mongoose.connection.db);
  router.use(limits.network);
  router.post(
    '/entitlements',
    express.raw({ type: 'application/json', limit: '64kb' }),
    async (req, res) => {
      try {
        await bridge().migrate();
        res.json(await bridge().synchronize(req.headers, req.body));
      } catch (error) {
        res.status(error.status || 503).json({
          message: error.status
            ? error.message
            : 'Institutional synchronization failed'
        });
      }
    }
  );
  router.post(
    '/activation/:action',
    (req, res, next) => {
      if (!verifyToken(req, req.get('Authorization')))
        return res.status(401).json({
          message: 'Sign in to your Cboard account first'
        });
      next();
    },
    limits.account,
    express.json({ limit: '16kb' }),
    async (req, res) => {
      try {
        const user = await User.getById(req.auth.id);
        if (!user)
          return res.status(401).json({ message: 'Product account not found' });
        const paths = {
          preview: '/api/product/invitations/preview',
          redeem: '/api/product/invitations/redeem',
          status: '/api/product/activation/status',
          check: '/api/product/activation/check',
          cancel: '/api/product/activation/cancel',
          retry: '/api/product/activation/retry'
        };
        const path = paths[req.params.action];
        if (!path)
          return res
            .status(404)
            .json({ message: 'Activation action not found' });
        const subscriber = await Subscriber.findOne({
          userId: String(req.auth.id)
        });
        const live = require('../helpers/institutional-access').hasPersonalAccess(
          subscriber
        );
        const payload = {
          token: req.body.token,
          assignmentId: req.body.assignmentId,
          consent: req.body.consent,
          userId: String(req.auth.id),
          email: user.email,
          existingAccess: live || (await entitlements(req.auth.id)).length > 0
        };
        res.json(await bridge().request(path, payload));
      } catch (error) {
        res.status(error.status || 503).json({
          message: error.status
            ? error.message
            : 'Institutional service unavailable; try again later'
        });
      }
    }
  );
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (
      error.type === 'entity.too.large' ||
      error.type === 'entity.parse.failed'
    )
      return res
        .status(error.status)
        .json({ message: 'Invalid institutional request body' });
    res
      .status(503)
      .json({
        message: 'Institutional request protection unavailable; try again later'
      });
  });
  return router;
}
module.exports = { router, entitlements };
