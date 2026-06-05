import admin from 'firebase-admin';
import { dedupeFcmTokens } from './db.js';
import { initFirebaseAdmin } from './firebaseAdmin.js';

/**
 * @param {string[]} tokens
 * @param {{ title: string, body: string, data?: Record<string, string> }} message
 * @returns {Promise<{ successCount: number, failureCount: number, invalidTokens: string[] }>}
 */
export async function sendPushToTokens(tokens, message) {
  const unique = dedupeFcmTokens(tokens);
  if (unique.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  initFirebaseAdmin();
  const messaging = admin.messaging();
  const data = Object.fromEntries(
    Object.entries(message.data ?? {}).map(([k, v]) => [k, String(v)]),
  );

  const response = await messaging.sendEachForMulticast({
    tokens: unique,
    notification: {
      title: message.title,
      body: message.body,
    },
    data,
    webpush: {
      fcmOptions: {
        link: message.data?.url || '/',
      },
    },
  });

  const invalidTokens = [];
  response.responses.forEach((result, index) => {
    if (result.success) return;
    const code = result.error?.code;
    if (
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/registration-token-not-registered'
    ) {
      invalidTokens.push(unique[index]);
    }
  });

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokens,
  };
}
