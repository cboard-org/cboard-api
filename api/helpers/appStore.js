const axios = require('axios');
const moment = require('moment');

const fs = require('fs');
const jwt = require('jsonwebtoken');

const setSubscriptionState = (status, autoRenewStatus) => {
  const ACTIVE = 'active';
  const CANCELLED = 'canceled';
  const IN_GRACE_PERIOD = 'in_grace_period';
  const EXPIRED = 'expired';
  const NOT_SUBSCRIBED = 'not_subscribed';

  if (status === 1 && autoRenewStatus) return ACTIVE;
  if (status === 1) return CANCELLED;
  if (status === 2) return EXPIRED;
  if (status === 3) return EXPIRED;
  if (status === 4) return IN_GRACE_PERIOD;
  if (status === 5) return NOT_SUBSCRIBED;
  return NOT_SUBSCRIBED;
};

const verifyAppStorePurchase = async ({ transactionId }) => {
  let transaction = {};

  const setExpireDate = expiryTime => {
    if (isNaN(expiryTime)) return (transaction.expiryDate = undefined);
    const expiryDate = new Date(expiryTime);
    transaction.expiryDate = expiryDate;
  };

  try {
    const transactionRemoteData = await getTransactionData(transactionId);
    transaction = { ...transaction, ...transactionRemoteData };
    setExpireDate(transactionRemoteData.expiresDate);

    transaction.subscriptionState = setSubscriptionState(
      transaction.status,
      transaction.autoRenewStatus
    );

    const IN_GRACE_PERIOD_STATE = 'in_grace_period';
    if (transaction.subscriptionState === IN_GRACE_PERIOD_STATE) {
      setExpireDate(transactionRemoteData.gracePeriodExpiresDate);
    }

    transaction.subscriptionState = setSubscriptionState(
      transaction.status,
      transaction.autoRenewStatus
    );
    return transaction;
  } catch (error) {
    console.error(error);
    throw {
      code: 6778001,
      message: error.message
        ? error.message
        : 'error verifying purchase. Check if the appStoreReceipt is valid'
    };
  }
};

const getTransactionData = async (transactionId, isSandbox = false) => {
  const AUTH_TOKEN = generateAppleAppStoreJWT();

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`
  };

  const getTransactionURl = isSandbox
    ? `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/subscriptions/${transactionId}`
    : `https://api.storekit.itunes.apple.com/inApps/v1/subscriptions/${transactionId}`;
  try {
    const res = await axios.get(getTransactionURl, {
      headers
    });
    const lastTransaction = res.data?.data[0]?.lastTransactions[0];
    if (lastTransaction) {
      const signedTransactionInfo = lastTransaction.signedTransactionInfo;
      const signedRenewalInfo = lastTransaction.signedRenewalInfo;

      const transactionInfo = jwt.decode(signedTransactionInfo);
      const renewalInfo = jwt.decode(signedRenewalInfo);

      return {
        ...lastTransaction,
        ...transactionInfo,
        ...renewalInfo,
        signedTransactionInfo: null,
        signedRenewalInfo: null
      };
    }
    throw new Error('Invalid response from app Store Validator');
  } catch (err) {
    const SANDBOX_RESPONSE_ERROR_CODE = 4040010;
    isSandboxReceipt =
      err.response?.data?.errorCode === SANDBOX_RESPONSE_ERROR_CODE;

    if (isSandboxReceipt) {
      try {
        return await getTransactionData(transactionId, isSandboxReceipt);
      } catch (err) {
        console.log('Error verifying App Store receipt:', err);
        throw err;
      }
    }
    console.log('Error verifying App Store receipt:', err);
    throw err;
  }
};

const generateAppleAppStoreJWT = () => {
  const privateKey = fs.readFileSync('./App-Store-Connect-API-Key.p8');
  const API_KEY_ID = process.env.APP_STORE_CONNECT_API_KEY_ID;
  const ISSUER_ID = process.env.APP_STORE_CONNECT_API_ISSUER_ID;
  const BUNDLE_ID = process.env.APPLE_APP_CLIENT_ID;

  const now = Math.round(new Date().getTime() / 1000);
  let nowPlus20 = now + 1199;
  let payload = {
    iss: ISSUER_ID,
    iat: now,
    exp: nowPlus20,
    aud: 'appstoreconnect-v1',
    bid: BUNDLE_ID
  };

  let signOptions = {
    algorithm: 'ES256', // you must use this algorythm, not jsonwebtoken's default
    header: {
      alg: 'ES256',
      kid: API_KEY_ID,
      typ: 'JWT'
    }
  };

  const token = jwt.sign(payload, privateKey, signOptions);
  return token;
};

module.exports = {
  verifyAppStorePurchase,
  setSubscriptionState
};
