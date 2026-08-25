/**
 * Shared push / in-app copy for expiry alerts (counts only — never item names).
 * @param {number} count
 */
export function buildExpiringSoonAlertMessage(count) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  if (n === 1) {
    return {
      title: 'Food expiring soon',
      body: 'You have 1 item expiring soon in your fridge!',
    };
  }
  return {
    title: `${n} items expiring soon`,
    body: `You have ${n} items expiring soon in your fridge!`,
  };
}

/**
 * @param {number} count
 */
export function buildExpiredAlertMessage(count) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  if (n === 1) {
    return {
      title: 'Food expired',
      body: 'You have 1 expired item in your fridge!',
    };
  }
  return {
    title: `${n} items expired`,
    body: `You have ${n} expired items in your fridge!`,
  };
}

/**
 * @param {number} expiringSoonCount
 * @param {number} expiredCount
 */
export function buildCombinedExpiryAlertMessage(expiringSoonCount, expiredCount) {
  const soon = Number(expiringSoonCount) || 0;
  const expired = Number(expiredCount) || 0;
  if (soon <= 0 && expired <= 0) return null;

  if (soon > 0 && expired <= 0) {
    return buildExpiringSoonAlertMessage(soon);
  }
  if (expired > 0 && soon <= 0) {
    return buildExpiredAlertMessage(expired);
  }

  return {
    title: 'Fridge expiry update',
    body: `You have ${soon} item${soon === 1 ? '' : 's'} expiring soon and ${expired} expired item${expired === 1 ? '' : 's'} in your fridge.`,
  };
}

/** @deprecated Use buildExpiringSoonAlertMessage */
export function buildExpiryAlertMessage(count) {
  return buildExpiringSoonAlertMessage(count);
}
