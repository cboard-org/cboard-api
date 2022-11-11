const moment = require('moment');
const ObjectId = require('mongoose').Types.ObjectId;

const { google } = require('googleapis');
const androidpublisher = google.androidpublisher('v3');

const Subscriber = require('../models/Subscribers');
const { getAuthDataFromReq } = require('../helpers/auth');
const { GOOGLE_PLAY_CREDENTIALS } = require('../../config');

module.exports = {
  createSubscriber,
  getSubscriber,
  deleteSubscriber,
  postTransaction,
};

function createSubscriber(req, res) {
  const newSubscriber = req.body;
  const actualMoment = moment().format();
  newSubscriber.createdAt = actualMoment;
  newSubscriber.updatedAt = actualMoment;
  newSubscriber.product.createdAt = actualMoment;
  newSubscriber.product.updatedAt = actualMoment;
  const subscriber = new Subscriber(newSubscriber);
  subscriber.save(function(err, subscriber) {
    if (err) {
      console.error('error', err);
      return res.status(409).json({
        message: 'Error saving subscriber',
        error: err.message,
      });
    }
    return res.status(200).json(subscriber.toJSON());
  });
}

function getSubscriber(req, res) {
  const userId = req.swagger.params.id.value;

  //this would be implemented like a middleware
  const { requestedBy, isAdmin: isRequestedByAdmin } = getAuthDataFromReq(req);

  if (!isRequestedByAdmin && (!requestedBy || userId != requestedBy)) {
    return res.status(401).json({
      message: 'Error getting subscriber',
      error:
        'unhautorized request, subscriber object is only accesible with subscribered user authToken',
    });
  }

  Subscriber.findOne({ userId: userId }, function(err, subscriber) {
    if (err) {
      return res.status(409).json({
        message: 'Error getting subscriber',
        error: err.message,
      });
    }
    if (!subscriber) {
      return res.status(404).json({
        message: 'Error getting subscriber',
        error: 'subscriber not found',
      });
    }
    return res.status(200).json(subscriber.toJSON());
  });
}

function deleteSubscriber(req, res) {
  const subscriberId = req.swagger.params.id.value;

  if (!ObjectId.isValid(subscriberId)) {
    return res.status(400).json({
      error: {
        message: 'Invalid ID for subscriber. Subscriber Id: ' + subscriberId,
      },
    });
  }

  Subscriber.findByIdAndRemove(subscriberId, function(err, subscriber) {
    if (err) {
      console.log(err);
      return res.status(200).json({
        error: {
          message: err,
        },
      });
    }
    return res.status(200).json(subscriber);
  });
}

async function postTransaction(req, res) {
  const subscriberId = req.swagger.params.id.value;
  const parseTransactionReceipt = (transaction) => {
    const receipt = transaction?.nativePurchase?.receipt;

    if (receipt && typeof receipt === 'string') {
      return {
        ...transaction,
        nativePurchase: {
          ...transaction.nativePurchase,
          receipt: JSON.parse(receipt),
        },
      };
    }
    return transaction;
  };
  const verifyAndroidPurchase = async ({ productId, purchaseToken }) => {
    const auth = new google.auth.GoogleAuth({
      keyFile: GOOGLE_PLAY_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const authClient = await auth.getClient();
    google.options({ auth: authClient });

    if (productId) {
      const res = await androidpublisher.purchases.subscriptions.get({
        packageName: 'com.unicef.cboard',
        subscriptionId: productId,
        token: purchaseToken,
      });
      if (!res.data) {
        throw { code: 6778001, message: 'error verifying purchase' };
      }
      if (res.status !== 200 && res.data.acknowledgementState !== 1) {
        console.error(res.data.errors);
        throw { code: 6778001, message: res.data.errors };
      }
      return;
    }
    throw { code: 6778001, message: 'Subscription Id is not provided' };
  };

  const transaction = parseTransactionReceipt(req.body);

  if (!ObjectId.isValid(subscriberId)) {
    return res.status(200).json({
      ok: false,
      data: {
        code: 6778001, //INVALID_PAYLOAD
      },
      error: {
        message: 'Invalid ID for subscriber. Subscriber Id: ' + subscriberId,
      },
    });
  }

  if (!transaction)
    return res.status(200).json({
      ok: false,
      data: {
        code: 6778001, //INVALID_PAYLOAD
      },
      error: {
        message: 'transaction object is not provided',
      },
    });

  if (transaction.platform !== 'android-playstore')
    return res.status(200).json({
      ok: false,
      data: {
        code: 6778001, //INVALID_PAYLOAD
      },
      error: {
        message: 'only android-playstore purchases are allowed',
      },
    });

  try {
    await verifyAndroidPurchase(transaction.nativePurchase);
  } catch (error) {
    console.error(error);
    if (error.code === 400 || error.code === 6778001)
      return res.status(200).json({
        ok: false,
        data: {
          code: 6778001, //INVALID_PAYLOAD
        },
        error: {
          message: error.message,
        },
      });
    return res.status(200).json({
      ok: false,
      data: {
        code: 6778002, //CONNECTION_FAILED
      },
      error: {
        message: error.message,
      },
    });
  }

  Subscriber.findByIdAndUpdate(
    subscriberId,
    {
      updatedAt: moment().format(),
      transaction,
    },
    { new: true },
    function(err, subscriber) {
      if (err) {
        console.log(err);
        return res.status(200).json({
          ok: false,
          data: {
            code: 6778005, //INTERNAL_ERROR
          },
          error: {
            message: err,
          },
        });
      }
      return res.status(200).json({
        ok: true,
        data: {
          transaction: subscriber.transaction,
        },
      });
    }
  );
}
