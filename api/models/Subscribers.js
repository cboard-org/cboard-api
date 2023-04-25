'use strict';

const { GOOGLE_PLAY_CREDENTIALS } = require('../../config');
const { google } = require('googleapis');
const androidpublisher = google.androidpublisher('v3');

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PRODUCT_SCHEMA_DEFINITION = {
  subscriptionId: {
    type: String,
    required: true,
    trim: true,
  },
  planId: {
    type: String,
    trim: true,
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  billingPeriod: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Schema.Types.Mixed,
    required: true,
    trim: true
  }
};

const productSchema = new Schema(PRODUCT_SCHEMA_DEFINITION, {
  autoIndex: false,
  strict: true,
  timestamps: true,
});

const SUBSCRIBERS_SCHEMA_DEFINITION = {
  userId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
  },
  country: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    required: true,
    trim: true,
  },
  // transaction: { type: transactionSchema },
  transaction: {},
  product: {
    type: productSchema,
  },
};

const subscribersSchema = new Schema(SUBSCRIBERS_SCHEMA_DEFINITION, {
  strict: true,
  timestamps: true,
});


subscribersSchema.pre('save', async function () {
  if (
    this.transaction?.state === 'approved'
  ) {
    if (this.product.subscriptionId) {
      return true;
    }
    throw {
      errors: {
        transaction: {
          code: 6778001,
          message:
            'subscriber product subscription Id is different than transaction subscription Id',
        },
      },
    };
  }
});

subscribersSchema.path('transaction').validate(async function (transaction) {
  const verifyAndroidPurchase = async ({ productId, purchaseToken }) => {
    const auth = new google.auth.GoogleAuth({
      keyFile: GOOGLE_PLAY_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const authClient = await auth.getClient();
    google.options({ auth: authClient });
    if (productId) {
      try {
        const setExpireDate = (expiryTime) => {
          const expiryDate = new Date(expiryTime);
          transaction.expiryDate = expiryDate;
        };

        const setStateOptions = (subscriptionState) => {
          const GRACE_PERIOD_STRING = 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
          const ON_HOLD_STRING = 'SUBSCRIPTION_STATE_ON_HOLD';
          const EXPIRED = 'SUBSCRIPTION_STATE_EXPIRED';

          transaction.isExpired = false;
          transaction.isBillingRetryPeriod = false;
          if (subscriptionState === GRACE_PERIOD_STRING) {
            transaction.isExpired = true;
            transaction.isBillingRetryPeriod = true;
            return;
          }
          if (subscriptionState === ON_HOLD_STRING) {
            transaction.isExpired = true;
            return;
          }
          if (subscriptionState === EXPIRED) {
            transaction.isExpired = true;
            return;
          }
        };
        const res = await androidpublisher.purchases.subscriptionsv2.get({
          packageName: 'com.unicef.cboard',
          token: purchaseToken,
        });

        const getSubscritionStateKey = (subscriptionStateConst) => {
          const STATE_BEGIN = 'SUBSCRIPTION_STATE_';
          return subscriptionStateConst.replace(STATE_BEGIN, '').toLowerCase();
        };

        const subscriptionStateConst = res.data.subscriptionState;
        const firstLineItemExpiryTime = res.data.lineItems[0].expiryTime;

        if (!res.data) {
          throw { code: 6778001, message: 'error verifying purchase' };
        }
        if (res.status !== 200 && res.data.acknowledgementState !== 1) {
          console.error(res.data.errors);
          throw { code: 6778001, message: res.data.errors };
        }

        transaction.subscriptionState = getSubscritionStateKey(
          subscriptionStateConst
        );
        setExpireDate(firstLineItemExpiryTime);
        setStateOptions(subscriptionStateConst);
        return;
      } catch (error) {
        console.log('err', error);
        throw {
          code: 6778001,
          message:
            'error verifying purchase. Check if the purchase token is valid',
        };
      }
    }
    throw { code: 6778001, message: 'Subscription Id is not provided' };
  };
  const verifyPaypalPurchase = async (purchase) => {

  };
  if (!transaction) return true;
  if (transaction.platform === 'android-playstore') {
    await verifyAndroidPurchase(transaction.nativePurchase);
  } else if (transaction.platform === 'paypal') {
    await verifyPaypalPurchase(transaction.nativePurchase);
  }
  return true;
}, 'transaction puchase token error');

subscribersSchema.post('findOneAndUpdate', async function (subscriber) {
  const status = subscriber?.transaction?.subscriptionState || 'not_subscribed';
  try {
    const doc = await subscriber.model("Subscribers", subscribersSchema).findById(subscriber._id)
    await doc.updateOne({ status });
  } catch (error) {
    console.error(error);
  }
});

subscribersSchema.statics = {
  getByUserId: async function (userId) {
    let subscriber = null;
    try {
      subscriber = await Subscribers.findOne({ userId: userId.id }).exec();
    } catch (e) { }
    return subscriber;
  }
}

const Subscribers = mongoose.model('Subscribers', subscribersSchema);

module.exports = Subscribers;
