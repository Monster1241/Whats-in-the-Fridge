import admin from 'firebase-admin';

let initialized = false;

function ensureAdmin() {
  if (initialized) return;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const serviceAccount = JSON.parse(json);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    return;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    initialized = true;
    return;
  }

  throw new Error(
    'Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON in .env and Vercel.',
  );
}

/**
 * @param {string[]} tokens
 * @param {{ title: string, body: string, data?: Record<string, string> }} message
 * @returns {Promise<{ successCount: number, failureCount: number, invalidTokens: string[] }>}
 */
export async function sendPushToTokens(tokens, message) {
  const unique = [...new Set(tokens.filter(Boolean))];
  if (unique.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  ensureAdmin();
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
