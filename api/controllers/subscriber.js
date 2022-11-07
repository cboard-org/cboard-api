const moment = require('moment');
const ObjectId = require('mongoose').Types.ObjectId;

const { google } = require('googleapis');
const androidpublisher = google.androidpublisher('v3');

const Subscriber = require('../models/Subscribers');

module.exports = {
  createSubscriber,
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
    const receipt = transaction?.receipt;

    if (receipt && typeof transaction?.receipt === 'string') {
      return { ...transaction, receipt: JSON.parse(receipt) };
    }
    return transaction;
  };
  const verifyAndroidPurchase = async (transaction) => {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const authClient = await auth.getClient();
    google.options({ auth: authClient });

    if (transaction.subscriptionId) {
      const res = await androidpublisher.purchases.subscriptions.get({
        packageName: 'com.unicef.cboard',
        subscriptionId: transaction.subscriptionId,
        token: transaction.purchaseToken,
      });

      if (res.data?.status !== 200 && res.data.resource?.paymentState !== 1) {
        console.error(res.data.errors);
        throw { code: 6778001, message: res.data.errors };
      }
      return;
    }
    throw { code: 6778001, message: 'Subscription Id is not provided' };
  };

  const transaction = parseTransactionReceipt(req.body.transaction);

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

  if (transaction.type !== 'android-playstore')
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
    await verifyAndroidPurchase({
      ...transaction,
      subscriptionId: req.body.id,
    });
  } catch (error) {
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
