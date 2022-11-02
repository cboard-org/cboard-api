const moment = require('moment');

const Subscription = require('../models/subscriptions');

module.exports = {
  createSubscription,
  getSubscription,
  updateSubscription,
  deleteSubscription
};

function createSubscription(req, res) {
  const subscriptionId = req.swagger.params.subscriptionId.value;
  const newSubscription = req.body;
  const actualMoment = moment().format();
  newSubscription.subscriptionId = subscriptionId;
  newSubscription.createdAt = actualMoment;
  newSubscription.updatedAt = actualMoment;
  newSubscription.plans = newSubscription.plans?.map(plan => ({
    ...plan,
    createdAt: actualMoment,
    updatedAt: actualMoment
  }));
  const subscription = new Subscription(newSubscription);
  subscription.save(function(err, subscription) {
    if (err) {
      console.error('error', err);
      return res.status(409).json({
        message: 'Error saving subscription',
        error: err.message
      });
    }
    return res.status(200).json(subscription.toJSON());
  });
}

function getSubscription(req, res) {
  const subscriptionId = req.swagger.params.subscriptionId.value;

  Subscription.findOne({ subscriptionId }, function(err, subscription) {
    if (err) {
      return res.status(500).json({
        message: 'Error getting Subscription. ',
        error: err.message
      });
    }
    if (!subscription) {
      return res.status(404).json({
        message:
          'Subscription does not exist. Subscription Id: ' + subscriptionId
      });
    }
    return res.status(200).json(subscription.toJSON());
  });
}

function updateSubscription(req, res) {
  const subscriptionId = req.swagger.params.subscriptionId.value;

  Subscription.findOne({ subscriptionId }, function(err, subscription) {
    if (err) {
      return res.status(500).json({
        message: 'Error updating subscription. ',
        error: err.message
      });
    }
    if (!subscription) {
      return res.status(404).json({
        message:
          'Subscription does not exist. Subscription Id: ' + subscriptionId
      });
    }
    const actualMoment = moment().format();
    for (let key in req.body) {
      if (key === 'plans') {
        const updatedPlans = req.body[key]?.map(plan => {
          const planExisted = subscription.plans?.filter( oldPlan => oldPlan.planId === plan.planId)[0] || null;
          const createdAt = planExisted ? planExisted.createdAt : actualMoment;
          return ({
          ...plan,
          createdAt: createdAt,
          updatedAt: actualMoment
          })
        });
        subscription[key] = updatedPlans;
        continue;
      }
      subscription[key] = req.body[key];
    }
    subscription.updatedAt = actualMoment;
    subscription.save(function(err, subscription) {
      if (err) {
        return res.status(500).json({
          message: 'Error saving subscription. ',
          error: err.message
        });
      }
      if (!subscription) {
        return res.status(404).json({
          message:
            'Unable to find subscription. subscription id: ' + subscriptionId
        });
      }
    });
    return res.status(200).json(subscription.toJSON());
  });
}

function deleteSubscription(req, res) {
  const subscriptionId = req.swagger.params.subscriptionId.value;

  Subscription.findOneAndDelete({ subscriptionId }, function(err, subscription) {
    if (err) {
      return res.status(500).json({
        message: 'Error deleting subscription. ',
        error: err.message
      });
    }
    if (!subscription) {
      return res.status(404).json({
        message:
          'Subscription does not exist. Subscription Id: ' + subscriptionId
      });
    }
    return res.status(200).json(subscription.toJSON());
  });
}