'use strict';
function hasPersonalAccess(subscriber, now = Date.now()) {
  const status = subscriber?.status?.toLowerCase();
  if (status === 'lifetime') return true;
  return (
    !!subscriber &&
    ['active', 'canceled', 'cancelled', 'in_grace_period'].includes(status) &&
    (!subscriber.transaction?.expiryDate ||
      Date.parse(subscriber.transaction.expiryDate) > now)
  );
}
module.exports = { hasPersonalAccess };
