import { useEffect, useRef } from 'react';

/**
 * Poll while a screen is open. Pauses when the tab/app is backgrounded
 * (Capacitor iOS/Android + browser), resumes immediately on foreground.
 *
 * @param {() => void | Promise<void>} callback
 * @param {{
 *   enabled?: boolean,
 *   intervalMs?: number,
 *   runImmediately?: boolean,
 * }} [options]
 */
export function usePolling(callback, options = {}) {
  const {
    enabled = true,
    intervalMs = 3000,
    runImmediately = false,
  } = options;
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    let timerId = null;
    let inFlight = false;

    const tick = async () => {
      if (cancelled || inFlight) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      inFlight = true;
      try {
        await callbackRef.current();
      } catch {
        // Callers handle their own errors; keep polling.
      } finally {
        inFlight = false;
      }
    };

    const clear = () => {
      if (timerId != null) {
        window.clearInterval(timerId);
        timerId = null;
      }
    };

    const start = () => {
      clear();
      timerId = window.setInterval(() => {
        void tick();
      }, intervalMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clear();
        return;
      }
      void tick();
      start();
    };

    const onFocus = () => {
      void tick();
      start();
    };

    if (runImmediately) {
      void tick();
    }
    start();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onFocus);

    return () => {
      cancelled = true;
      clear();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onFocus);
    };
  }, [enabled, intervalMs, runImmediately]);
}

/**
 * @param {{ id?: string, lastMessageAt?: string|null, messageCount?: number, messages?: unknown[] } | null | undefined} thread
 */
export function supportThreadFingerprint(thread) {
  if (!thread) return '';
  const count = Array.isArray(thread.messages)
    ? thread.messages.length
    : Number(thread.messageCount ?? 0);
  return `${thread.id ?? ''}|${thread.lastMessageAt ?? ''}|${count}|${thread.unreadForAdmin ?? 0}|${thread.unreadForUser ?? 0}|${thread.status ?? ''}`;
}
