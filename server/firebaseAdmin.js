import admin from 'firebase-admin';

/**
 * Ensures the default Firebase Admin app exists (safe to call repeatedly).
 * @returns {import('firebase-admin').app.App}
 */
export function initFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const serviceAccount = JSON.parse(json);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  throw new Error(
    'Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON (full service account JSON) in .env and Vercel.',
  );
}

/**
 * @param {string} idToken
 * @returns {Promise<import('firebase-admin/auth').DecodedIdToken>}
 */
export async function verifyFirebaseIdToken(idToken) {
  initFirebaseAdmin();
  return admin.auth().verifyIdToken(idToken);
}
