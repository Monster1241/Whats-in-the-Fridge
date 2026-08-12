import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { getFirebaseApp } from '../firebase.js';
import { getFirebaseVapidKey } from './config.js';

const SW_PATH = '/firebase-messaging-sw.js';

let messagingInstance = null;
let swRegistrationPromise = null;

export async function isPushSupported() {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

export async function registerMessagingServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser.');
  }
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker.register(SW_PATH, { scope: '/' });
  }
  return swRegistrationPromise;
}

async function getMessagingInstance() {
  const supported = await isPushSupported();
  if (!supported) return null;
  if (!messagingInstance) {
    messagingInstance = getMessaging(getFirebaseApp());
  }
  return messagingInstance;
}

async function resolveFcmToken({ requestPermission }) {
  const vapidKey = getFirebaseVapidKey();
  if (!vapidKey) {
    throw new Error(
      'Missing VITE_FIREBASE_VAPID_KEY. Add your Web Push certificate key from Firebase Console.',
    );
  }

  if (requestPermission) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
  } else if (Notification.permission !== 'granted') {
    return null;
  }

  const registration = await registerMessagingServiceWorker();
  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  return getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
}

/** Request browser permission, then return the FCM device token. */
export async function fetchFcmDeviceToken() {
  return resolveFcmToken({ requestPermission: true });
}

/** Return FCM token when permission is already granted (no prompt). */
export async function getFcmDeviceTokenIfPermitted() {
  return resolveFcmToken({ requestPermission: false });
}

/**
 * Subscribe to foreground FCM messages while the app tab is open.
 * @param {(payload: import('firebase/messaging').MessagePayload) => void} handler
 * @returns {Promise<(() => void) | null>}
 */
export async function subscribeForegroundMessages(handler) {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;
  return onMessage(messaging, handler);
}

export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
