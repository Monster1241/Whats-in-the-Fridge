import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getFirebaseVapidKey } from '../firebase/config.js';
import {
  isNativePushPlatform,
  registerPushNotifications,
  subscribePushForeground,
} from '../firebase/push.js';
import { PushNotificationBanner } from '../components/PushNotificationBanner.jsx';

const PushNotificationContext = createContext(null);

function getWebNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function payloadToBanner(payload) {
  const notification = payload.notification ?? {};
  const title = notification.title || payload.data?.title || "What's in the Fridge";
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
  const isNative = isNativePushPlatform();
  const vapidConfigured = isNative || Boolean(getFirebaseVapidKey());
  const permission = isNative ? 'default' : getWebNotificationPermission();

  const dismissBanner = useCallback(() => setBanner(null), []);

  const syncToken = useCallback(async ({ prompt = false } = {}) => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    setError(null);
    setStatus('loading');
    try {
      const result = await registerPushNotifications({
        prompt,
        onForegroundMessage: (payload) => setBanner(payloadToBanner(payload)),
      });
      if (result.ok) {
        setStatus('enabled');
        return;
      }
      setStatus(result.status === 'denied' ? 'denied' : result.status === 'unsupported' ? 'unsupported' : 'error');
      if (result.error) setError(result.error);
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Could not enable push notifications.');
    } finally {
      syncInFlight.current = false;
    }
  }, []);

  const enablePush = useCallback(async () => {
    if (!isNative && !vapidConfigured) {
      setStatus('error');
      setError('Web Push is not configured (missing VITE_FIREBASE_VAPID_KEY).');
      return;
    }
    await syncToken({ prompt: true });
  }, [syncToken, vapidConfigured, isNative]);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setError(null);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      if (isNative) {
        // Native: wait for explicit Settings enable (OS permission prompt).
        if (!cancelled) setStatus((prev) => (prev === 'enabled' ? prev : 'idle'));
        return;
      }

      if (!vapidConfigured) {
        if (!cancelled) setStatus('idle');
        return;
      }

      if (typeof Notification === 'undefined') {
        if (!cancelled) setStatus('unsupported');
        return;
      }

      if (Notification.permission === 'granted') {
        await syncToken({ prompt: false });
      } else if (Notification.permission === 'denied') {
        if (!cancelled) setStatus('denied');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, syncToken, vapidConfigured, isNative]);

  useEffect(() => {
    if (!enabled || listenerAttached.current) return undefined;

    let unsubscribe = null;
    let cancelled = false;

    (async () => {
      const unsub = await subscribePushForeground((payload) => {
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
      isNative,
      enablePush,
      dismissBanner,
    }),
    [status, error, permission, vapidConfigured, isNative, enablePush, dismissBanner],
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
