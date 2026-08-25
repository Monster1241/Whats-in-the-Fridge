import {
  buildCombinedExpiryAlertMessage,
  buildExpiringSoonAlertMessage,
} from '../src/inventory/expiryAlertMessages.js';

export { buildCombinedExpiryAlertMessage, buildExpiringSoonAlertMessage };

/** @deprecated Use buildExpiringSoonAlertMessage */
export const buildExpiryAlertMessage = buildExpiringSoonAlertMessage;

function formatSenderLabel(email, displayName) {
  const named = String(displayName || '').trim();
  if (named) return named;
  const local = String(email || '').split('@')[0]?.trim();
  if (!local) return 'Your household partner';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/**
 * Push copy without shopping-list item names.
 * @param {string} senderEmail
 * @param {number} itemCount
 * @param {string} [displayName]
 */
export function buildShoppingPingNotification(senderEmail, itemCount, displayName) {
  const sender = formatSenderLabel(senderEmail, displayName);
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

export function buildFeedbackNudgeNotification() {
  return {
    title: 'How’s the fridge going?',
    body: 'You’ve been using What’s in the Fridge for a week. Tap to send a quick note — it really helps.',
  };
}
