
const { gapiAuth } = require('../helpers/auth');
const { google } = require('googleapis');
const playConsole = google.androidpublisher('v3');
const ObjectId = require('mongoose').Types.ObjectId;
const mongoose = require('mongoose');


const Subscriber = require('../models/Subscribers');
const { getAuthDataFromReq } = require('../helpers/auth');
const PayPal = require('../helpers/paypal');
const paypal = new PayPal({});

module.exports = {
  createSubscriber,
  getSubscriber,
  updateSubscriber,
  deleteSubscriber,
  createTransaction,
  cancelPlan
};

async function cancelPlan(req, res) {
  const subscriptionId = req.swagger.params.id.value;
  try {
    await paypal.cancelPlan(subscriptionId);
    return res.status(204).json();
  } catch (err) {
    console.error('error', err);
    return res.status(409).json({
      message: 'Error canceling PayPal subscription plan.',
      error: err.message,
    });
  }

}

function createSubscriber(req, res) {
  const newSubscriber = req.body;
  const subscriber = new Subscriber(newSubscriber);
  subscriber.save(function (err, subscriber) {
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

async function getSubscriber(req, res) {
  await gapiAuth();
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

  Subscriber.findOne({ userId: userId }, async function (err, subscriber) {
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

    // update subscriber status and transaction
    if (subscriber.transaction?.platform === 'android-playstore' &&
      subscriber.transaction?.nativePurchase?.purchaseToken) {
      try {
        const newSubscriber = await subscriber.save();
        return res.status(200).json(newSubscriber.toJSON());
      }
      catch (err) {
        handleError(err);
        return;
      }
    }

    if (subscriber.transaction?.platform === 'paypal' &&
      subscriber.transaction?.subscriptionId) {
      let status = '';
      let expiryDate = '';
      let remoteData = '';
      let nativePurchase = '';
      try {
        // get subscription from paypal API
        remoteData = await paypal.getSubscriptionDetails(subscriber.transaction.subscriptionId);
        status = remoteData.status;
        if (status.toLowerCase() === 'cancelled') status = 'canceled';
        expiryDate = remoteData.billing_info?.next_billing_time;
        nativePurchase = remoteData;
      } catch (err) {
        console.log(err.message);
      }
      if (status) {
        subscriber.status = status;
        if (expiryDate) subscriber.transaction.expiryDate = expiryDate;
        subscriber.transaction.nativePurchase = nativePurchase;
        if (remoteData)
          try {
            const newSubscriber = await subscriber.save();
            return res.status(200).json(newSubscriber.toJSON());
          }
          catch (err) {
            handleError(err);
          }
      }
    }
    return res.status(200).json(subscriber.toJSON());

    function handleError(err) {
      const errorValidatingTransaction = err.errors?.transaction;
      const errorValidatingProduct = err.product;
      const errorFindingSubscriber = err instanceof mongoose.Error.DocumentNotFoundError;
      if (errorValidatingTransaction) {
        console.log(err);
        return res.status(409).json({
          message: 'Error saving subscriber.',
          error:
            errorValidatingTransaction.message ??
            errorValidatingTransaction.properties?.message,
        });
      }
      if (errorValidatingProduct) {
        return res.status(401).json({
          message: 'Error saving subscriber.',
          error: errorValidatingProduct.message,
        });
      }
      if (errorFindingSubscriber) {
        return res.status(404).json({
          message: 'Unable to find subscriber.',
          error: errorFindingSubscriber.message,
        });
      }
      return res.status(500).json({
        message: 'Error saving subscriber.',
        error: err.message,
      });
    }

  });
}

function updateSubscriber(req, res) {
  const subscriberId = req.swagger.params.id.value;

  const { requestedBy, isAdmin: isRequestedByAdmin } = getAuthDataFromReq(req);

  Subscriber.findOne({ _id: subscriberId }, async function (err, subscriber) {
    if (err) {
      return res.status(500).json({
        message: 'Error updating subscriber. ',
        error: err.message,
      });
    }
    if (!subscriber) {
      return res.status(404).json({
        message: 'Subscriber does not exist. Subscriber Id: ' + subscriberId,
      });
    }
    if (!isRequestedByAdmin &&
      (!requestedBy || subscriber.userId != requestedBy)) {
      return res.status(401).json({
        message: 'Error updating subscriber',
        error:
          'unhautorized request, subscriber object is only accesible with subscribered user authToken',
      });
    }
    for (let key in req.body) {
      const keyCreatedAt = subscriber[key]?.createdAt;
      subscriber[key] = keyCreatedAt
        ? { ...req.body[key], createdAt: keyCreatedAt }
        : req.body[key];
    }
    if (subscriber.transaction?.nativePurchase?.productId &&
      subscriber.transaction.nativePurchase.productId !== subscriber.product.subscriptionId) {
      // this means that user chooses to buy a different subscription than he bought in the past 
      subscriber.transaction.nativePurchase.productId = subscriber.product.subscriptionId;
    }
    await subscriber.save(function (err, subscriber) {
      if (err) {
        const errorValidatingTransaction = err.errors?.transaction;
        const errorValidatingProduct = err.product;
        if (errorValidatingTransaction) {
          console.log(err);
          return res.status(409).json({
            message: 'Error saving subscriber.',
            error:
              errorValidatingTransaction.message ??
              errorValidatingTransaction.properties?.message,
          });
        }
        if (errorValidatingProduct) {
          return res.status(401).json({
            message: 'Error saving subscriber.',
            error: errorValidatingProduct.message,
          });
        }
        return res.status(500).json({
          message: 'Error saving subscriber.',
          error: err.message,
        });
      }
      if (!subscriber) {
        return res.status(404).json({
          message: 'Unable to find subscriber. subscriber id: ' + subscriberId,
        });
      }
      return res.status(200).json(subscriber);
    });
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

  Subscriber.findByIdAndRemove(subscriberId, function (err, subscriber) {
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

async function createTransaction(req, res) {
  const subscriberId = req.swagger.params.id.value;
  const platform = req.body.platform;
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
  const parseSubscriptionDetails = (transaction, subscriptionDetails) => {
    return {
      ...transaction,
      nativePurchase: subscriptionDetails,
      expiryDate: subscriptionDetails.billing_info.next_billing_time,
      purchaseDate: subscriptionDetails.start_time
    };
  };

  let transaction = req.body;
  if (platform === 'android-playstore') {
    transaction = parseTransactionReceipt(transaction);
  } else if (platform === 'paypal') {
    try {
      // get subscription from paypal API
      const remoteData = await paypal.getSubscriptionDetails(req.body.subscriptionId);
      transaction = parseSubscriptionDetails(transaction, remoteData);
    } catch (err) {
      return res.status(200).json({
        ok: false,
        data: {
          code: 6778001, //INVALID_PAYLOAD
        },
        error: {
          message: 'PayPal subscription details could not be get',
        },
      });
    }
  }

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

  if (transaction.platform !== 'android-playstore' &&
    transaction.platform !== 'paypal')
    return res.status(200).json({
      ok: false,
      data: {
        code: 6778001, //INVALID_PAYLOAD
      },
      error: {
        message: 'only android-playstore or PayPal purchases are allowed',
      },
    });

  Subscriber.findOneAndUpdate(
    { _id: subscriberId },
    {
      transaction,
    },
    { new: true, runValidators: true, useFindAndModify: false },
    function (err, subscriber) {
      if (err) {
        return res.status(200).json({
          ok: false,
          data: {
            code: 6778001, //INVALID_PAYLOAD
          },
          error: {
            message: err.message,
          },
        });
      }
      const transaction = subscriber.transaction;
      return res.status(200).json({
        ok: true,
        data: {
          id: transaction.nativePurchase.productId,
          latest_receipt: true,
          transaction: {
            data: { transaction, success: true },
            type: transaction.platform,
          },
          collection: [
            {
              expiryDate: transaction.expiryDate,
              isExpired: transaction.isExpired,
              isBillingRetryPeriod: transaction.isBillingRetryPeriod,
              subscriptionState: transaction.subscriptionState
            },
          ],
        },
      });
    }
  );
}
