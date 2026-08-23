import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth';
import { firebaseConfig } from './firebase/config.js';

/** @type {import('firebase/app').FirebaseApp | null} */
let appInstance = null;
/** @type {import('firebase/auth').Auth | null} */
let authInstance = null;
/** @type {import('firebase/analytics').Analytics | null} */
let analyticsInstance = null;
/** @type {Promise<void> | null} */
let analyticsInitPromise = null;

/** Initialize Firebase app on first use (not at module load). */
export function getFirebaseApp() {
  if (!appInstance) {
    appInstance = initializeApp(firebaseConfig);
  }
  return appInstance;
}

/**
 * Initialize Auth on first use with explicit browser persistence.
 * IndexedDB + localStorage is required for reliable restore in iOS WKWebView / Capacitor.
 */
export function getFirebaseAuthInstance() {
  if (!authInstance) {
    const app = getFirebaseApp();
    try {
      authInstance = initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      });
    } catch {
      // HMR / duplicate init — reuse the existing Auth instance.
      authInstance = getAuth(app);
    }
  }
  return authInstance;
}

function ensureAnalytics() {
  if (typeof window === 'undefined' || analyticsInitPromise) return;
  analyticsInitPromise = isSupported()
    .then((supported) => {
      if (supported) {
        analyticsInstance = getAnalytics(getFirebaseApp());
      }
    })
    .catch(() => {
      // Analytics is optional.
    });
}

export function getFirebaseAnalytics() {
  ensureAnalytics();
  return analyticsInstance;
}
