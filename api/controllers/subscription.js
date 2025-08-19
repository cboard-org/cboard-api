const Subscription = require('../models/Subscription');
const { paginatedResponse } = require('../helpers/response');
const { gapiAuth } = require('../helpers/auth');
const { getORQuery } = require('../helpers/query');
const PayPal = require('../helpers/paypal');
const paypal = new PayPal({});

const { google } = require('googleapis');
const playConsole = google.androidpublisher('v3');

module.exports = {
  createSubscription,
  getSubscription,
  updateSubscription,
  deleteSubscription,
  syncSubscriptions,
  listSubscriptions
};

async function createSubscription(req, res) {
  const subscriptionId = req.swagger.params.subscriptionId.value;
  const newSubscription = req.body;
  newSubscription.subscriptionId = subscriptionId;
  const subscription = new Subscription(newSubscription);
  await subscription.save(function (err, subscription) {
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

  Subscription.findOne({ subscriptionId }, async function (err, subscription) {
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
    await subscription.save(function (err, subscription) {
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
  let paypalPlans = [];
  // get PayPal plans 
  try {
    paypalPlans = await paypal.listPlans();
  } catch (err) {
    console.log(err.message);
  }
  try {
    // get subscriptions from Google API
    const remoteData = await playConsole.monetization.subscriptions.list(params);
    const remoteSubscrs = remoteData.data.subscriptions;
    
    // loop remote subscriptions
    for (const subscription of remoteSubscrs) {
      try {
        const subscriptionId = subscription.productId;
        const userSubscription = await Subscription.findOne({ subscriptionId: subscriptionId });
        
        let newSubscription = undefined;
        if (userSubscription) {
          newSubscription = Object.assign(userSubscription, mapRemoteSubscr(subscription, paypalPlans.plans));
        } else {
          newSubscription = new Subscription(mapRemoteSubscr(subscription, paypalPlans.plans));
        }

        const result = await newSubscription.save();
        if (!subscr) {
          console.log("New subscription added: " + result.name);
        } else {
          console.log("Subscription updated: " + result.name);
        }
      } catch (err) {
        console.error('Error processing subscription:', err);
      }
    }
    
    // get subscriptions from database 
    const { search = '' } = req.query;
    const searchFields = ['name'];
    const query = search && search.length ? getORQuery(searchFields, search, true) : {};
    const localSubscrs = await paginatedResponse(Subscription, { query }, req.query);
    // check the local subscription against remote 
    for (const localSubscr of localSubscrs.data) {
      try {
        const id = localSubscr.subscriptionId;
        let found = false;
        
        for (const remoteSubscr of remoteSubscrs) {
          const mappedRemoteSubscr = mapRemoteSubscr(remoteSubscr, paypalPlans.plans);
          if (id == mappedRemoteSubscr.subscriptionId) {
            found = true;
            break;
          }
        }
        
        if (!found) {
          const deletedSubscr = await Subscription.findOneAndDelete({ subscriptionId: id });
          if (deletedSubscr) {
            console.log("Subscription deleted: " + deletedSubscr.name);
          }
        }
      } catch (err) {
        console.error('Error processing local subscription:', err);
      }
    }

    return res.status(200).json(localSubscrs);
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({
      message: 'Error synchronizing subscriptions',
      error: err.message
    });
  }
}

function mapRemoteSubscr(subscription, paypalPlans) {
  const subscr = {
    subscriptionId: subscription.productId,
    name: subscription.listings[0].title,
    status: 'active',
    platform: 'android-playstore',
    benefits: subscription.listings[0].benefits,
    plans: getPlans(subscription.basePlans, paypalPlans)
  };
  return subscr;
}

function getPlans(basePlans, paypalPlans) {
  let plans = [];
  if (!basePlans || basePlans.length === 0) return plans;
  basePlans.forEach(basePlan => {
    let paypalPlan = '';
    if (paypalPlans) paypalPlan = paypalPlans.find(plan => plan.name === basePlan.basePlanId);
    const plan = {
      name: basePlan.basePlanId,
      planId: basePlan.basePlanId,
      status: basePlan.state,
      countries: basePlan.regionalConfigs,
      paypalId: paypalPlan
        ? paypalPlan.id
        : '',
      period: basePlan.autoRenewingBasePlanType.billingPeriodDuration,
      tags: basePlan.offerTags ? basePlan.offerTags.map(objectTag => objectTag.tag) : [],
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
