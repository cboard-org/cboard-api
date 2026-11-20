'use strict';

const KNOWN_STATUSES = [
  'not_subscribed',
  'proccesing',
  'active',
  'canceled',
  'in_grace_period',
  'paused',
  'expired',
  'on_hold',
  'suspended',
  'unverified'
];

const ANDROID_PREFIX = 'SUBSCRIPTION_STATE_';

/**
 * Normalize a raw platform subscription state string
 * into the internal Cboard status vocabulary.
 *
 * Handles:
 *   - Android raw constants: "SUBSCRIPTION_STATE_ACTIVE" -> "active"
 *   - Already-normalized strings: "active" -> "active"
 *   - Unknown values: falls back to "not_subscribed"
 */
function normalizeSubscriptionStatus(raw) {
  if (!raw || typeof raw !== 'string') return 'not_subscribed';

  let normalized = raw;

  if (normalized.startsWith(ANDROID_PREFIX)) {
    normalized = normalized.replace(ANDROID_PREFIX, '');
  }

  normalized = normalized.toLowerCase();

  return KNOWN_STATUSES.includes(normalized) ? normalized : 'not_subscribed';
}

// Maps raw PayPal subscription statuses to the internal Cboard status vocabulary.
// https://developer.paypal.com/docs/api/subscriptions/v1/#definition-subscription_status
const PAYPAL_STATUS_MAP = {
  approval_pending: 'proccesing',
  approved: 'proccesing',
  active: 'active',
  suspended: 'suspended',
  cancelled: 'canceled',
  expired: 'expired'
};

module.exports = { normalizeSubscriptionStatus, PAYPAL_STATUS_MAP };
