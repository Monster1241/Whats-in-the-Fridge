import { usePushNotifications } from '../context/PushNotificationContext.jsx';
import { useExpiryNotifications } from '../hooks/useExpiryNotifications.js';

export function ExpiryNotificationSync({ items, enabled = true }) {
  const { showLocalBanner } = usePushNotifications();
  useExpiryNotifications(items, { showLocalBanner, enabled });
  return null;
}
