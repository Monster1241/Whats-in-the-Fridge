import {
  buildCombinedExpiryAlertMessage,
  buildExpiringSoonAlertMessage,
} from '../src/inventory/expiryAlertMessages.js';

export { buildCombinedExpiryAlertMessage, buildExpiringSoonAlertMessage };

/** @deprecated Use buildExpiringSoonAlertMessage */
export const buildExpiryAlertMessage = buildExpiringSoonAlertMessage;

function formatSenderLabel(email) {
  const local = String(email || '').split('@')[0]?.trim();
  if (!local) return 'Your household partner';
  return local.charAt(0).toUpperCase() + local.slice(1);
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

/**
 * Push copy when support/admin replies in the in-app support chat.
 * @param {string} [messageBody]
 */
export function buildSupportReplyNotification(messageBody = '') {
  const preview = String(messageBody ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  return {
    title: 'Support replied',
    body: preview
      ? preview
      : 'You have a new message from Fridge support. Open Settings → Support chat to reply.',
  };
}
