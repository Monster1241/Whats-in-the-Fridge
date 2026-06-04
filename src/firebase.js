import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyBc9LDIPH__J3JgN8F7NnP7pDGwTebCysU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'my-household-hub.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'my-household-hub',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'my-household-hub.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '268899548006',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:268899548006:web:0cc638e66159ef602ae6a7',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-M7FH8F82V2',
};

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
