import { useEffect, useRef } from 'react';
import { buildCombinedExpiryAlertMessage } from '../inventory/expiryAlertMessages.js';
import {
  acknowledgeExpiryAlerts,
  collectExpiryAlertCandidates,
  findUnacknowledgedExpiryAlerts,
} from '../inventory/expiryNotificationState.js';

/**
 * Shows an in-app banner when food is expiring soon or expired and not yet acknowledged.
 * @param {Array<Record<string, unknown>>} items
 * @param {{ showLocalBanner?: (message: { title: string, body: string, onAcknowledge?: () => void }) => void, enabled?: boolean }} options
 */
export function useExpiryNotifications(items, { showLocalBanner, enabled = true } = {}) {
  const signatureRef = useRef('');

  useEffect(() => {
    if (!enabled || !showLocalBanner || !Array.isArray(items) || items.length === 0) {
      return;
    }

    const { expiringSoon, expired } = collectExpiryAlertCandidates(items);
    const { pendingSoon, pendingExpired } = findUnacknowledgedExpiryAlerts(expiringSoon, expired);
    if (pendingSoon.length === 0 && pendingExpired.length === 0) return;

    const signature = `${pendingSoon.length}:${pendingExpired.length}:${pendingSoon
      .map((item) => item.id)
      .join(',')}:${pendingExpired.map((item) => item.id).join(',')}`;
    if (signatureRef.current === signature) return;
    signatureRef.current = signature;

    const message = buildCombinedExpiryAlertMessage(pendingSoon.length, pendingExpired.length);
    if (!message) return;

    showLocalBanner({
      ...message,
      onAcknowledge: () => acknowledgeExpiryAlerts(pendingSoon, pendingExpired),
    });
  }, [items, showLocalBanner, enabled]);
}
