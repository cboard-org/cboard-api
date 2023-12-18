
const { gapiAuth } = require('../helpers/auth');
const { google } = require('googleapis');
const playConsole = google.androidpublisher('v3');
const ObjectId = require('mongoose').Types.ObjectId;
const mongoose = require('mongoose');


const Subscriber = require('../models/Subscribers');
const { getAuthDataFromReq } = require('../helpers/auth');
const PayPal = require('../helpers/paypal');
const paypal = new PayPal({});

const {
  verifyAppStorePurchase,
  setSubscriptionState
} = require('../helpers/appStore');

module.exports = {
  createSubscriber,
  getSubscriber,
  updateSubscriber,
  deleteSubscriber,
  createTransaction,
  cancelPlan
};

const checkIfAppStoreTransactionIsValid = async (
  subscriberId,
  originalTransactionId
) => {
  const activeSubscriber = await Subscriber.findOne({
    'transaction.originalTransactionId': originalTransactionId
  });

  if (
    activeSubscriber &&
    activeSubscriber._id.toString() !== subscriberId.toString()
  ) {
    if (activeSubscriber.transaction.platform === 'ios-appstore') {
      try {
        const subscriptionOwnerStateUpdated = setSubscriptionState(
          activeSubscriber.transaction.status,
          activeSubscriber.transaction.autoRenewStatus
        );
        if (subscriptionOwnerStateUpdated === 'expired') {
          activeSubscriber.transaction.subscriptionState = subscriptionOwnerStateUpdated;
          activeSubscriber.transaction.originalTransactionId = '';
          activeSubscriber.status = subscriptionOwnerStateUpdated;
          const subscriber = await activeSubscriber.save();
          if (subscriber) return;
        }
      } catch {
        throw new Error('Transaction ID already exists');
      }
      throw new Error('Transaction ID already exists');
    }
  }
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
      success: false,
      message: 'Error getting subscriber',
      error:
        'unhautorized request, subscriber object is only accesible with subscribered user authToken',
    });
  }

  Subscriber.findOne({ userId: userId }, async function (err, subscriber) {
    if (err) {
      return res.status(409).json({
        success: false,
        message: 'Error getting subscriber',
        error: err.message,
      });
    }

    if (!subscriber) {
      if (req.headers.purchaseversion === '1.0.0') {
        return res.status(200).json({
          success: false,
          userId: userId,
          message: 'Error getting subscriber',
          error: 'subscriber not found'
        });
      } else {
        //if the request is from old purchase version (<1.0.0), we need to conserve the behavior
        return res.status(404).json({
          message: 'Error getting subscriber',
          error: 'subscriber not found'
        });
      }
    }

    // update subscriber status and transaction
    if (subscriber.transaction?.platform === 'android-playstore' &&
      subscriber.transaction?.nativePurchase?.purchaseToken) {
      try {
        const newSubscriber = await subscriber.save();
        return res.status(200).json({success: true, ...newSubscriber.toJSON()});
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
            return res.status(200).json({success: true, ...newSubscriber.toJSON()});
          }
          catch (err) {
            handleError(err);
          }
      }
    }

    if (subscriber.transaction?.platform === 'ios-appstore') {
      subscriber.transaction.platform = 'ios-appstore';
      subscriber.transaction.transactionId = subscriber.transaction.id;

      try {
        const decodedTransaction = await verifyAppStorePurchase({
          transactionId: subscriber.transaction.transactionId
        });
        subscriber.transaction = {
          ...subscriber.transaction,
          ...decodedTransaction
        };
        subscriber.status = subscriber.transaction.subscriptionState;
      } catch (err) {
        return res.status(200).json({
          ok: false,
          data: {
            code: 6778001 //INVALID_PAYLOAD
          },
          error: {
            message: 'ios-appstore subscription details could not be get'
          }
        });
      }

      try {
        await checkIfAppStoreTransactionIsValid(
          subscriber._id,
          subscriber.transaction.originalTransactionId
        );
      } catch (err) {
        console.log(err);
        const NOT_SUBSCRIBED = 'not_subscribed';
        subscriber.status = NOT_SUBSCRIBED;
        subscriber.transaction = null;
      }
      try {
        const newSubscriber = await subscriber.save();
        return res.status(200).json({success: true, ...newSubscriber.toJSON()});
      } catch (err) {
        handleError(err);
        return;
      }
    }

    return res.status(200).json({success: true, ...subscriber.toJSON()});

    function handleError(err) {
      const errorValidatingTransaction = err.errors?.transaction;
      const errorValidatingProduct = err.product;
      const errorFindingSubscriber = err instanceof mongoose.Error.DocumentNotFoundError;
      if (errorValidatingTransaction) {
        console.log(err);
        return res.status(409).json({
          success: false,
          message: 'Error saving subscriber.',
          error:
            errorValidatingTransaction.message ??
            errorValidatingTransaction.properties?.message,
        });
      }
      if (errorValidatingProduct) {
        return res.status(401).json({
          success: false,
          message: 'Error saving subscriber.',
          error: errorValidatingProduct.message,
        });
      }
      if (errorFindingSubscriber) {
        return res.status(404).json({
          success: false,
          message: 'Unable to find subscriber.',
          error: errorFindingSubscriber.message,
        });
      }
      return res.status(500).json({
        success: false,
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
  if (
    transaction.type === 'ios-appstore' ||
    transaction.platform === 'ios-appstore'
  ) {
    transaction.platform = 'ios-appstore';
    transaction.transactionId = transaction.id;

    try {
      const decodedtransaction = await verifyAppStorePurchase({
        transactionId: transaction.transactionId,
        subscriberId
      });

      await checkIfAppStoreTransactionIsValid(
        subscriberId,
        decodedtransaction.originalTransactionId
      );

      transaction = {
        ...transaction,
        ...decodedtransaction
      };
    } catch (err) {
      return res.status(200).json({
        ok: false,
        data: {
          code: 6778001 //INVALID_PAYLOAD
        },
        error: {
          message: err.message
        }
      });
    }
  }

  if (!ObjectId.isValid(subscriberId)) {
    return res.status(200).json({
      ok: false,
      data: {
        code: 6778001 //INVALID_PAYLOAD
      },
      error: {
        message: 'Invalid ID for subscriber. Subscriber Id: ' + subscriberId
      }
    });
  }

  if (!transaction)
    return res.status(200).json({
      ok: false,
      data: {
        code: 6778001 //INVALID_PAYLOAD
      },
      error: {
        message: 'transaction object is not provided'
      }
    });

  if (transaction.platform !== 'ios-appstore')
    try {
      const activeSubscriber = await Subscriber.findOne({
        'transaction.transactionId': transaction.transactionId
      });
      if (
        activeSubscriber &&
        activeSubscriber._id.toString() !== subscriberId
      ) {
        throw new Error('Transaction ID already exists');
      }
    } catch (err) {
      console.log(err);
      return res.status(200).json({
        ok: false,
        data: {
          code: 6778001 //INVALID_PAYLOAD
        },
        error: {
          message: 'Transaction ID already exists'
        }
      });
    }

  if (
    transaction.platform !== 'android-playstore' &&
    transaction.platform !== 'paypal' &&
    transaction.platform !== 'ios-appstore'
  )
    return res.status(200).json({
      ok: false,
      data: {
        code: 6778001 //INVALID_PAYLOAD
      },
      error: {
        message:
          'only android-playstore, ios-appstore or PayPal purchases are allowed'
      }
    });

  let updatedObject = {
    transaction
  };
  if (transaction.platform === 'ios-appstore')
    updatedObject = {
      status: transaction.subscriptionState,
      transaction
    };

  Subscriber.findOneAndUpdate(
    { _id: subscriberId },
    updatedObject,
    {
      new: true,
      runValidators: true,
      useFindAndModify: false
    },
    function(err, subscriber) {
      if (err) {
        return res.status(200).json({
          ok: false,
          data: {
            code: 6778001 //INVALID_PAYLOAD
          },
          error: {
            message: err.message
          }
        });
      }
      const transaction = subscriber.transaction;
      if (transaction.platform === 'ios-appstore') {
        return res.status(200).json({
          ok: true,
          data: {
            id: transaction.productId,
            latest_receipt: true,
            transaction: {
              data: { transaction, success: true },
              type: transaction.platform
            },
            collection: [
              {
                expiryDate: transaction.expiryDate,
                isExpired: transaction.subscriptionState === 'expired',
                subscriptionState: transaction.subscriptionState
              }
            ]
          }
        });
      }
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
