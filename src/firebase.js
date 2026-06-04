import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from './firebase/config.js';

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

/** @type {import('firebase/analytics').Analytics | null} */
let analyticsInstance = null;

if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analyticsInstance = getAnalytics(firebaseApp);
    }
  });
}

export function getFirebaseAnalytics() {
  return analyticsInstance;
}
