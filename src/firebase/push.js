import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { saveFcmToken } from '../api.js';
import { getFirebaseVapidKey } from './config.js';

/** @type {boolean} */
let nativeListenersAttached = false;
/** @type {string | null} */
let lastNativeToken = null;
/** @type {Array<(token: string) => void>} */
let tokenResolvers = [];
/** @type {Array<(err: Error) => void>} */
let tokenRejecters = [];
/** @type {((payload: { notification?: { title?: string, body?: string }, data?: Record<string, string> }) => void) | null} */
let foregroundHandler = null;

function settleTokenSuccess(token) {
  lastNativeToken = token;
  const resolvers = tokenResolvers.splice(0, tokenResolvers.length);
  tokenRejecters.splice(0, tokenRejecters.length);
  resolvers.forEach((resolve) => resolve(token));
}

function settleTokenError(err) {
  const rejecters = tokenRejecters.splice(0, tokenRejecters.length);
  tokenResolvers.splice(0, tokenResolvers.length);
  rejecters.forEach((reject) => reject(err));
}

function waitForNativeToken(timeoutMs = 15_000) {
  if (lastNativeToken) return Promise.resolve(lastNativeToken);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      settleTokenError(new Error('Push registration timed out. Please try again.'));
    }, timeoutMs);
    tokenResolvers.push((token) => {
      clearTimeout(timer);
      resolve(token);
    });
    tokenRejecters.push((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function ensureNativeListeners() {
  if (nativeListenersAttached) return;
  nativeListenersAttached = true;

  await PushNotifications.addListener('registration', async (token) => {
    const value = token?.value ? String(token.value) : '';
    if (!value) return;
    settleTokenSuccess(value);
    try {
      await saveFcmToken(value);
    } catch {
      // Token still returned to caller; sync can be retried from Settings.
    }
  });

  await PushNotifications.addListener('registrationError', (event) => {
    settleTokenError(new Error(event?.error || 'Push registration failed.'));
  });

  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    foregroundHandler?.({
      notification: {
        title: notification?.title,
        body: notification?.body,
      },
      data: notification?.data && typeof notification.data === 'object' ? notification.data : {},
    });
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', () => {
    // Platform opens / focuses the app — no extra handling required.
  });
}

/** @returns {boolean} */
export function isNativePushPlatform() {
  return Capacitor.isNativePlatform();
}

/** Whether this environment can register for push. */
export async function isPushAvailable() {
  if (isNativePushPlatform()) return true;
  const { isPushSupported } = await import('./messagingClient.js');
  return isPushSupported();
}

/**
 * Unified push registration for Capacitor native + web FCM.
 *
 * @param {{
 *   prompt?: boolean,
 *   onForegroundMessage?: (payload: {
 *     notification?: { title?: string, body?: string },
 *     data?: Record<string, string>,
 *   }) => void,
 * }} [options]
 * @returns {Promise<{ ok: boolean, status: 'enabled'|'denied'|'unsupported'|'error', token: string|null, error?: string }>}
 */
export async function registerPushNotifications(options = {}) {
  const { prompt = true, onForegroundMessage } = options;
  if (typeof onForegroundMessage === 'function') {
    foregroundHandler = onForegroundMessage;
  }

  if (isNativePushPlatform()) {
    try {
      await ensureNativeListeners();
      if (Capacitor.getPlatform() === 'android') {
        await PushNotifications.createChannel({
          id: 'fridge_alerts',
          name: 'Fridge alerts',
          description: 'Expiry and household shopping reminders',
          importance: 5,
          visibility: 1,
          sound: 'default',
        });
      }
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') {
        return { ok: false, status: 'denied', token: null };
      }
      const tokenPromise = waitForNativeToken();
      await PushNotifications.register();
      const token = await tokenPromise;
      if (!token) {
        return { ok: false, status: 'error', token: null, error: 'No device token received.' };
      }
      await saveFcmToken(token);
      return { ok: true, status: 'enabled', token };
    } catch (err) {
      return {
        ok: false,
        status: 'error',
        token: null,
        error: err?.message || 'Could not enable push notifications.',
      };
    }
  }

  // Web / PWA — Firebase messaging + VAPID
  try {
    const {
      isPushSupported,
      fetchFcmDeviceToken,
      getFcmDeviceTokenIfPermitted,
    } = await import('./messagingClient.js');

    if (!getFirebaseVapidKey()) {
      return {
        ok: false,
        status: 'error',
        token: null,
        error: 'Web Push is not configured (missing VITE_FIREBASE_VAPID_KEY).',
      };
    }

    const supported = await isPushSupported();
    if (!supported) {
      return {
        ok: false,
        status: 'unsupported',
        token: null,
        error: 'Push notifications are not supported in this browser.',
      };
    }

    const token = prompt
      ? await fetchFcmDeviceToken()
      : await getFcmDeviceTokenIfPermitted();

    if (!token) {
      return { ok: false, status: 'denied', token: null };
    }
    await saveFcmToken(token);
    return { ok: true, status: 'enabled', token };
  } catch (err) {
    return {
      ok: false,
      status: 'error',
      token: null,
      error: err?.message || 'Could not enable push notifications.',
    };
  }
}

/**
 * Attach foreground listener (native Capacitor + web FCM).
 * @param {(payload: unknown) => void} handler
 * @returns {Promise<(() => void) | null>}
 */
export async function subscribePushForeground(handler) {
  foregroundHandler = handler;
  if (isNativePushPlatform()) {
    await ensureNativeListeners();
    return () => {
      if (foregroundHandler === handler) foregroundHandler = null;
    };
  }
  const { subscribeForegroundMessages } = await import('./messagingClient.js');
  return subscribeForegroundMessages(handler);
}
