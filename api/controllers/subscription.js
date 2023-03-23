const Subscription = require('../models/Subscription');
const { paginatedResponse } = require('../helpers/response');
const { getORQuery } = require('../helpers/query');

const { google } = require('googleapis');
const playConsole = google.androidpublisher('v3');
const { GOOGLE_PLAY_CREDENTIALS } = require('../../config');
const constants = require('../constants');

async function gapiAuth() {
  try {
    const scopes = ['https://www.googleapis.com/auth/androidpublisher'];
    const auth = new google.auth.GoogleAuth({
      keyFile: GOOGLE_PLAY_CREDENTIALS,
      scopes: scopes
    });
    const authClient = await auth.getClient();
    google.options({ auth: authClient });
  } catch(error){
    console.error('error during Google API auth', error)
  }
}


module.exports = {
  createSubscription,
  getSubscription,
  updateSubscription,
  deleteSubscription,
  syncSubscriptions,
  listSubscriptions
};

function createSubscription(req, res) {
  const subscriptionId = req.swagger.params.subscriptionId.value;
  const newSubscription = req.body;
  newSubscription.subscriptionId = subscriptionId;
  const subscription = new Subscription(newSubscription);
  subscription.save(function (err, subscription) {
    if (err) {
      console.error('error', err);
      return res.status(409).json({
        message: 'Error saving subscription',
        error: err.message,
      });
    }
    return res.status(200).json(subscription.toJSON());
  });
}

function getSubscription(req, res) {
  const subscriptionId = req.swagger.params.subscriptionId.value;

  Subscription.findOne({ subscriptionId }, function (err, subscription) {
    if (err) {
      return res.status(500).json({
        message: 'Error getting Subscription. ',
        error: err.message,
      });
    }
    if (!subscription) {
      return res.status(404).json({
        message:
          'Subscription does not exist. Subscription Id: ' + subscriptionId,
      });
    }
    return res.status(200).json(subscription.toJSON());
  });
}

function updateSubscription(req, res) {
  const subscriptionId = req.swagger.params.subscriptionId.value;

  Subscription.findOne({ subscriptionId }, function (err, subscription) {
    if (err) {
      return res.status(500).json({
        message: 'Error updating subscription. ',
        error: err.message,
      });
    }
    if (!subscription) {
      return res.status(404).json({
        message:
          'Subscription does not exist. Subscription Id: ' + subscriptionId,
      });
    }
    for (let key in req.body) {
      subscription[key] = req.body[key];
    }
    subscription.save(function (err, subscription) {
      if (err) {
        return res.status(500).json({
          message: 'Error saving subscription. ',
          error: err.message,
        });
      }
      if (!subscription) {
        return res.status(404).json({
          message:
            'Unable to find subscription. subscription id: ' + subscriptionId,
        });
      }
      return res.status(200).json(subscription.toJSON());
    });
  });
}

function deleteSubscription(req, res) {
  const subscriptionId = req.swagger.params.subscriptionId.value;

  Subscription.findOneAndDelete({ subscriptionId }, function (
    err,
    subscription
  ) {
    if (err) {
      return res.status(500).json({
        message: 'Error deleting subscription. ',
        error: err.message,
      });
    }
    if (!subscription) {
      return res.status(404).json({
        message:
          'Subscription does not exist. Subscription Id: ' + subscriptionId,
      });
    }
    return res.status(200).json(subscription.toJSON());
  });
}

async function syncSubscriptions(req, res) {
  console.log('Synchcronizing subscriptions...');
  await gapiAuth();
  const params = { packageName: 'com.unicef.cboard' };
  try {
    // get subscriptions from Google API
    const remoteData = await playConsole.monetization.subscriptions.list(params);
    const remoteSubscrs = remoteData.data.subscriptions;
    //loop remote subscriptions
    remoteSubscrs.forEach(subscription => {
      //console.log(subscription);
      const subscriptionId = subscription.productId;
      Subscription.findOne({ subscriptionId: subscriptionId }, function (err, subscr) {
        if (err) {
          return res.status(500).json({
            message: 'Error getting subscription.',
            error: err.message
          });
        }
        let newSubscription = undefined;
        if (subscr) {
          newSubscription = Object.assign(subscr, mapRemoteSubscr(subscription));
        } else {
          newSubscription = new Subscription(mapRemoteSubscr(subscription));
        }

        newSubscription.save(function (err, result) {
          if (err) {
            console.error('error', err);
            return res.status(409).json({
              message: 'Error saving subscription',
              error: err.message,
            });
          } else {
            if (!subscr) {
              console.log("New subscription added: " + result.name);
            } else {
              console.log("Subscription updated: " + result.name);
            }
          }
        });
      });
    });
    // get subscriptions from database 
    const { search = '' } = req.query;
    const searchFields = ['name'];
    const query = search && search.length ? getORQuery(searchFields, search, true) : {};
    const localSubscrs = await paginatedResponse(Subscription, { query }, req.query);
    // check the local subscription against remote 
    localSubscrs.data.forEach(localSubscr => {
      const id = localSubscr.subscriptionId;
      let found = false;
      remoteSubscrs.forEach(remoteSubscr => {
        remoteSubscr = mapRemoteSubscr(remoteSubscr);
        if (id == remoteSubscr.subscriptionId) found = true;
      });
      if (!found) {
        Subscription.findOneAndDelete({ id }, function (
          err,
          deletedSubscr
        ) {
          if (err) {
            return res.status(500).json({
              message: 'Error deleting subscription. ',
              error: err.message,
            });
          }
          if (!deletedSubscr) {
            return res.status(404).json({
              message:
                'Subscription does not exist. Subscription Id: ' + id,
            });
          }
          console.log("Subscription deleted: " + deletedSubscr.name);
        });
      }
    });

    return res.status(200).json();
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({
      message: err.message
    });
  }
}

function mapRemoteSubscr(subscription) {
  const subscr = {
    subscriptionId: subscription.productId,
    name: subscription.listings[0].title,
    status: 'active',
    platform: 'google play',
    benefits: subscription.listings[0].benefits,
    plans: getPlans(subscription.basePlans)
  };
  return subscr;
}

function getPlans(basePlans) {
  let plans = [];
  basePlans.forEach(basePlan => {
    const plan = {
      name: basePlan.basePlanId,
      planId: basePlan.basePlanId,
      status: basePlan.state,
      countries: basePlan.regionalConfigs,
      period: basePlan.autoRenewingBasePlanType.billingPeriodDuration,
      renovation: basePlan.autoRenewingBasePlanType.resubscribeState === 'RESUBSCRIBE_STATE_ACTIVE'
        ? 'Active'
        : 'Inactive'
    };
    plans.push(plan);
  });
  return plans;
}

async function listSubscriptions(req, res) {
  const { search = '' } = req.query;
  const searchFields = ['name'];
  const query = search && search.length ? getORQuery(searchFields, search, true) : {};
  try {
    const response = await paginatedResponse(Subscription, { query }, req.query);
    return res.status(200).json(response);
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({
      message: err.message
    });
  }
}
