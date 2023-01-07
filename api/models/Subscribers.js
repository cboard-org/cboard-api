'use strict';

const { GOOGLE_PLAY_CREDENTIALS } = require('../../config');
const { google } = require('googleapis');
const androidpublisher = google.androidpublisher('v3');

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PRODUCT_SCHEMA_DEFINITION = {
  planId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
  },
  subscriptionId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    required: true,
    trim: true,
  },
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
    unique: true,
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

subscribersSchema.pre('save', function() {
  if (
    this.product?.status === 'owned' &&
    this.transaction?.state !== 'approved'
  ) {
    throw {
      product: {
        code: 6778001,
        message:
          'product status can t be owned if an approved transaction is not present',
      },
    };
  }
  return true;
});

subscribersSchema.pre('save', async function() {
  if (
    this.transaction?.state === 'approved' &&
    this.product?.status === 'owned'
  ) {
    if (this.transaction.nativePurchase?.productId === this.product.planId) {
      return true;
    }
    throw {
      errors: {
        transaction: {
          code: 6778001,
          message:
            'subscriber product plan Id is different than transaction plan Id',
        },
      },
    };
  }
});

subscribersSchema.path('transaction').validate(async function(transaction) {
  const verifyAndroidPurchase = async ({ productId, purchaseToken }) => {
    const auth = new google.auth.GoogleAuth({
      keyFile: GOOGLE_PLAY_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const authClient = await auth.getClient();
    google.options({ auth: authClient });
    if (productId) {
      try {
        const setExpireDatesOptions = (expiryTimeMillis, subscriptionState) => {
          const expiryDate = new Date(expiryTimeMillis);
          console.log(expiryTimeMillis)
          transaction.expiryDate = expiryDate;
          if(subscriptionState === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"){
            transaction.isBillingRetryPeriod = true;
          }
          if(subscriptionState === "SUBSCRIPTION_STATE_ON_HOLD"){
            transaction.isExpired = true;
          }
        };

        const res = await androidpublisher.purchases.subscriptionsv2.get({
          packageName: 'com.unicef.cboard',
          token: purchaseToken,
        });

        if (!res.data) {
          throw { code: 6778001, message: 'error verifying purchase' };
        }
        if (res.status !== 200 && res.data.acknowledgementState !== 1) {
          console.error(res.data.errors);
          throw { code: 6778001, message: res.data.errors };
        }
        const subscriptionState = res.data.subscriptionState.replace('SUBSCRIPTION_STATE_', '').toLowerCase();
        transaction.subscriptionState = subscriptionState;
        setExpireDatesOptions(res.data.lineItems[0].expiryTime, res.data.subscriptionState);
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
  if (!transaction) return true;
  await verifyAndroidPurchase(transaction.nativePurchase);
  return true;
}, 'transaction puchase token error');

const Subscribers = mongoose.model('Subscribers', subscribersSchema);

module.exports = Subscribers;
