import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { saveFcmToken } from '../api.js';
import {
  fetchFcmDeviceToken,
  getFcmDeviceTokenIfPermitted,
  getNotificationPermission,
  isPushSupported,
  subscribeForegroundMessages,
} from '../firebase/messagingClient.js';
import { getFirebaseVapidKey } from '../firebase/config.js';
import { PushNotificationBanner } from '../components/PushNotificationBanner.jsx';

const PushNotificationContext = createContext(null);

function payloadToBanner(payload) {
  const notification = payload.notification ?? {};
  const title = notification.title || payload.data?.title || 'What\'s in the Fridge';
  const body =
    notification.body || payload.data?.body || 'You have a new household update.';
  return { id: `${Date.now()}-${Math.random()}`, title, body };
}

export function PushNotificationProvider({ enabled = false, children }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [banner, setBanner] = useState(null);
  const syncInFlight = useRef(false);
  const listenerAttached = useRef(false);

  const permission = getNotificationPermission();
  const vapidConfigured = Boolean(getFirebaseVapidKey());

  const dismissBanner = useCallback(() => setBanner(null), []);

  const syncToken = useCallback(async ({ prompt = false } = {}) => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    setError(null);
    setStatus('loading');
    try {
      const token = prompt
        ? await fetchFcmDeviceToken()
        : await getFcmDeviceTokenIfPermitted();
      if (!token) {
        setStatus('denied');
        return;
      }
      await saveFcmToken(token);
      setStatus('enabled');
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Could not enable push notifications.');
    } finally {
      syncInFlight.current = false;
    }
  }, []);

  const enablePush = useCallback(async () => {
    const supported = await isPushSupported();
    if (!supported) {
      setStatus('unsupported');
      setError('Push notifications are not supported in this browser.');
      return;
    }
    if (!vapidConfigured) {
      setStatus('error');
      setError('Web Push is not configured (missing VITE_FIREBASE_VAPID_KEY).');
      return;
    }
    await syncToken({ prompt: true });
  }, [syncToken, vapidConfigured]);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setError(null);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      const supported = await isPushSupported();
      if (cancelled) return;
      if (!supported) {
        setStatus('unsupported');
        return;
      }
      if (!vapidConfigured) {
        setStatus('idle');
        return;
      }
      if (Notification.permission === 'granted') {
        await syncToken({ prompt: false });
      } else if (Notification.permission === 'denied') {
        setStatus('denied');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, syncToken, vapidConfigured]);

  useEffect(() => {
    if (!enabled || listenerAttached.current) return undefined;

    let unsubscribe = null;
    let cancelled = false;

    (async () => {
      const unsub = await subscribeForegroundMessages((payload) => {
        setBanner(payloadToBanner(payload));
      });
      if (cancelled) {
        if (typeof unsub === 'function') unsub();
        return;
      }
      listenerAttached.current = true;
      unsubscribe = unsub;
    })();

    return () => {
      cancelled = true;
      if (typeof unsubscribe === 'function') unsubscribe();
      listenerAttached.current = false;
    };
  }, [enabled]);

  const value = useMemo(
    () => ({
      status,
      error,
      permission,
      vapidConfigured,
      enablePush,
      dismissBanner,
    }),
    [status, error, permission, vapidConfigured, enablePush, dismissBanner],
  );

  return (
    <PushNotificationContext.Provider value={value}>
      {children}
      {enabled && banner ? (
        <PushNotificationBanner
          title={banner.title}
          body={banner.body}
          onDismiss={dismissBanner}
        />
      ) : null}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotifications() {
  const ctx = useContext(PushNotificationContext);
  if (!ctx) {
    throw new Error('usePushNotifications must be used within PushNotificationProvider');
  }
  return ctx;
}
