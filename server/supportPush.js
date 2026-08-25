import { getUserFcmTokens, removeInvalidFcmTokens } from './db.js';
import { sendPushToTokens } from './fcm.js';
import { buildSupportReplyNotification } from './pushCopy.js';

/**
 * Notify the support-chat user that an admin/support agent replied.
 * Failures are logged and swallowed so chat delivery is never blocked.
 *
 * @param {{
 *   userId?: string|null,
 *   threadId?: string|null,
 *   messageBody?: string|null,
 * }} input
 */
export async function notifyUserOfSupportReply(input) {
  const userId = String(input.userId ?? '').trim();
  if (!userId) {
    return { sent: 0, skipped: true, reason: 'missing_user' };
  }

  try {
    const tokens = await getUserFcmTokens(userId);
    if (tokens.length === 0) {
      return { sent: 0, skipped: true, reason: 'no_tokens' };
    }

    const { title, body } = buildSupportReplyNotification(input.messageBody);
    const { successCount, invalidTokens } = await sendPushToTokens(tokens, {
      title,
      body,
      data: {
        type: 'support_reply',
        threadId: String(input.threadId ?? ''),
        url: '/#support',
      },
    });

    if (invalidTokens.length > 0) {
      await removeInvalidFcmTokens(invalidTokens).catch(() => {});
    }

    return { sent: successCount, skipped: false };
  } catch (err) {
    console.error('notifyUserOfSupportReply', err?.message || err);
    return { sent: 0, skipped: true, reason: 'push_failed' };
  }
}
