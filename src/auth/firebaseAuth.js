import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase.js';

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
  return auth;
}

/** Resolves once Firebase has restored persisted auth state. */
export function waitForFirebaseAuth() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, () => {
      unsub();
      resolve(auth.currentUser);
    });
  });
}

export async function firebaseSignUp(email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // non-fatal if verification email fails
    }
    return cred.user;
  } catch (err) {
    throw mapFirebaseAuthError(err);
  }
}

export async function firebaseSignIn(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return cred.user;
  } catch (err) {
    throw mapFirebaseAuthError(err);
  }
}

export async function firebaseSignOut() {
  await signOut(auth);
}

export async function firebaseGetIdToken(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export async function firebaseSendPasswordReset(email) {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err) {
    throw mapFirebaseAuthError(err);
  }
}

export async function firebaseResendVerificationEmail() {
  const user = auth.currentUser;
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
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not signed in.');
  }
  await user.reload();
  return auth.currentUser;
}

export async function firebaseDeleteCurrentUser() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteUser(user);
  } catch (err) {
    throw mapFirebaseAuthError(err);
  }
}
