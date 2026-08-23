import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { getFirebaseAuthInstance } from '../firebase.js';

/** Default cap so iOS WKWebView never spins forever on auth restore / ID token. */
export const AUTH_TIMEOUT_MS = 10_000;

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} [ms]
 * @param {string} [message]
 * @returns {Promise<T>}
 */
export function withAuthTimeout(
  promise,
  ms = AUTH_TIMEOUT_MS,
  message = 'Network timeout. Please check your connection or try again.',
) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

/**
 * @param {import('firebase/auth').AuthError} err
 */
export function mapFirebaseAuthError(err) {
  const code = err?.code || '';
  const messages = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password must be at least 8 characters.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Invalid email or password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
  };
  return new Error(messages[code] || err?.message || 'Authentication failed.');
}

export function getFirebaseAuth() {
  return getFirebaseAuthInstance();
}

/**
 * Resolves once Firebase has restored persisted auth state.
 * Times out on flaky WKWebView persistence so boot never hangs.
 */
export async function waitForFirebaseAuth(timeoutMs = AUTH_TIMEOUT_MS) {
  const auth = getFirebaseAuthInstance();
  const timeoutMessage =
    'Network timeout. Please check your connection or try again.';
  try {
    await withAuthTimeout(auth.authStateReady(), timeoutMs, timeoutMessage);
  } catch (err) {
    // Timed out — continue with whatever currentUser we have (often null).
    if (err?.message === timeoutMessage) {
      return auth.currentUser ?? null;
    }
    throw err;
  }
  return auth.currentUser ?? null;
}

export async function firebaseSignUp(email, password) {
  const auth = getFirebaseAuthInstance();
  try {
    const cred = await withAuthTimeout(
      createUserWithEmailAndPassword(auth, email.trim(), password),
    );
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // non-fatal if verification email fails
    }
    return cred.user;
  } catch (err) {
    if (err?.message?.startsWith('Network timeout')) throw err;
    throw mapFirebaseAuthError(err);
  }
}

export async function firebaseSignIn(email, password) {
  const auth = getFirebaseAuthInstance();
  try {
    const cred = await withAuthTimeout(
      signInWithEmailAndPassword(auth, email.trim(), password),
    );
    return cred.user;
  } catch (err) {
    if (err?.message?.startsWith('Network timeout')) throw err;
    throw mapFirebaseAuthError(err);
  }
}

export async function firebaseSignOut() {
  await signOut(getFirebaseAuthInstance());
}

export async function firebaseGetIdToken(forceRefresh = false) {
  const user = getFirebaseAuthInstance().currentUser;
  if (!user) return null;
  return withAuthTimeout(
    user.getIdToken(forceRefresh),
    AUTH_TIMEOUT_MS,
    'Network timeout. Please check your connection or try again.',
  );
}

export async function firebaseSendPasswordReset(email) {
  try {
    await sendPasswordResetEmail(getFirebaseAuthInstance(), email.trim());
  } catch (err) {
    throw mapFirebaseAuthError(err);
  }
}

export async function firebaseResendVerificationEmail() {
  const user = getFirebaseAuthInstance().currentUser;
  if (!user) {
    throw new Error('Not signed in.');
  }
  try {
    await sendEmailVerification(user);
  } catch (err) {
    throw mapFirebaseAuthError(err);
  }
}

export async function firebaseReloadUser() {
  const auth = getFirebaseAuthInstance();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not signed in.');
  }
  await user.reload();
  return auth.currentUser;
}

export async function firebaseDeleteCurrentUser() {
  const user = getFirebaseAuthInstance().currentUser;
  if (!user) return;
  try {
    await deleteUser(user);
  } catch (err) {
    throw mapFirebaseAuthError(err);
  }
}
