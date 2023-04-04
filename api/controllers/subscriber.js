
const { gapiAuth } = require('../helpers/auth');
const { google } = require('googleapis');
const playConsole = google.androidpublisher('v3');
const ObjectId = require('mongoose').Types.ObjectId;

const Subscriber = require('../models/Subscribers');
const { getAuthDataFromReq } = require('../helpers/auth');

module.exports = {
  createSubscriber,
  getSubscriber,
  updateSubscriber,
  deleteSubscriber,
  createTransaction,
};

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

    // update subscriber status 
    if (subscriber.transaction?.nativePurchase?.purchaseToken) {
      const token = subscriber.transaction.nativePurchase.purchaseToken;
      const params = { packageName: 'com.unicef.cboard', token: token };
      let state = '';
      try {
        // get purchase from Google API
        const remoteData = await playConsole.purchases.subscriptionsv2.get(params);
        state = remoteData.data.subscriptionState;
      } catch (err) {
        console.log(err.message);
      }
      if (state) {
        subscriber.state = state;
        subscriber.save(function (err, subscr) {
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
          if (!subscr) {
            return res.status(404).json({
              message: 'Unable to find subscriber.'
            });
          }
        });
      }
    }

    return res.status(200).json(subscriber.toJSON());
  });
}

function updateSubscriber(req, res) {
  const subscriberId = req.swagger.params.id.value;

  const { requestedBy, isAdmin: isRequestedByAdmin } = getAuthDataFromReq(req);

  Subscriber.findOne({ _id: subscriberId }, function (err, subscriber) {
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
    subscriber.save(function (err, subscriber) {
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
