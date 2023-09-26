const axios = require('axios');
const moment = require('moment');

const verifyReceipt = async (encodedAppStoreReceipt, isSandbox = false) => {
  const AUTH_TOKEN = process.env.APP_STORE_VERIFIER_AUTH_TOKEN;
  const PASSWORD = process.env.APP_STORE_VERIFIER_PASSWORD;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`
  };
  const verifyReceiptUrl = isSandbox
    ? 'https://sandbox.itunes.apple.com/verifyReceipt'
    : 'https://buy.itunes.apple.com/verifyReceipt';

  const body = {
    'receipt-data': encodedAppStoreReceipt,
    password: PASSWORD,
    'exclude-old-transactions': 'true'
  };

  try {
    const res = await axios.post(verifyReceiptUrl, body, {
      headers
    });
    if (res?.data?.latest_receipt_info && res?.data?.latest_receipt_info['0']) {
      const isInGracePeriod =
        res?.data?.pending_renewal_info[0]?.is_in_billing_retry_period === '1';

      if (isInGracePeriod) {
        const pending_renewal_info = res.data.pending_renewal_info[0];
        const grace_period_info = {
          is_in_billing_retry_period: 1,
          grace_period_expires_date_ms:
            pending_renewal_info.grace_period_expires_date_ms
        };
        return { ...res.data.latest_receipt_info['0'], ...grace_period_info };
      }
      return {
        ...res.data.latest_receipt_info['0'],
        is_in_billing_retry_period: 0
      };
    }
    const SANDBOX_RESPONSE_STATUS = 21007;
    isSandboxReceipt = res?.data?.status === SANDBOX_RESPONSE_STATUS;
    if (isSandboxReceipt) {
      return await verifyReceipt(encodedAppStoreReceipt, isSandboxReceipt);
    }
    throw new Error('Invalid response from app Store Validator');
  } catch (err) {
    console.log('Error verifying App Store receipt:', err.message);
    throw err;
  }
};

const setSubscriptionState = transaction => {
  const ACTIVE = 'active';
  const CANCELLED = 'cancelled';
  const IN_GRACE_PERIOD = 'in_grace_period';
  const EXPIRED = 'expired';
  const NOT_SUBSCRIBED = 'not_subscribed';

  const nowMs = moment().valueOf();
  const expires_date_ms = parseInt(transaction.expires_date_ms);
  const gracePeriodExpiresDateMs = parseInt(
    transaction.grace_period_expires_date_ms
  );
  if (
    transaction.is_in_billing_retry_period &&
    nowMs <= gracePeriodExpiresDateMs
  ) {
    return IN_GRACE_PERIOD;
  }
  if (
    transaction.cancellation_date_ms &&
    transaction.is_in_billing_retry_period
  ) {
    const cancellationDateMs = parseInt(transaction.cancellation_date_ms);
    if (nowMs >= cancellationDateMs) return EXPIRED;
    //setExpireDate(cancellationDateMs);
    return CANCELLED;
  }
  if (nowMs <= expires_date_ms) return ACTIVE;
  //const GRACE_PERIOD_MILIS = 60000;
  //if (nowMs <= expires_date_ms + GRACE_PERIOD_MILIS) return IN_GRACE_PERIOD;
  if (nowMs >= expires_date_ms) {
    transaction.isExpired = true;
    return EXPIRED;
  }

  return NOT_SUBSCRIBED;
};

const verifyAppStorePurchase = async ({ appStoreReceipt }) => {
  let transaction = {};

  const setExpireDate = expiryTime => {
    if (isNaN(expiryTime)) return (transaction.expiryDate = undefined);
    const expiryDate = new Date(expiryTime);
    transaction.expiryDate = expiryDate;
  };

  try {
    const decodedReceipt = await verifyReceipt(appStoreReceipt);
    transaction = { ...transaction, ...decodedReceipt };

    setExpireDate(parseInt(decodedReceipt.expires_date_ms));

    if (decodedReceipt.is_in_billing_retry_period === 1) {
      const gracePeriodExpiresDateMs = parseInt(
        transaction.grace_period_expires_date_ms
      );
      setExpireDate(gracePeriodExpiresDateMs);
    }

    transaction.subscriptionState = setSubscriptionState(transaction);
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

module.exports = {
  verifyAppStorePurchase,
  setSubscriptionState
};
