function formatSenderLabel(email) {
  const local = String(email || '').split('@')[0]?.trim();
  if (!local) return 'Your household partner';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/**
 * Push copy without inventory item names.
 * @param {number} count
 */
export function buildExpiryAlertMessage(count) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  if (n === 1) {
    return {
      title: 'Food expiring soon',
      body: 'Something in your fridge is expiring soon. Open the app to check.',
    };
  }
  return {
    title: `${n} items expiring soon`,
    body: `${n} items in your fridge are expiring soon. Open the app to check.`,
  };
}

/**
 * Push copy without shopping-list item names.
 * @param {string} senderEmail
 * @param {number} itemCount
 */
export function buildShoppingPingNotification(senderEmail, itemCount) {
  const sender = formatSenderLabel(senderEmail);
  const n = Number(itemCount) || 0;
  if (n <= 0) {
    return {
      title: 'Shopping list',
      body: `${sender} pinged you — the list is empty right now.`,
    };
  }
  return {
    title: 'Time to shop!',
    body: `${sender} asked you to check the household shopping list (${n} item${n === 1 ? '' : 's'}).`,
  };
}
