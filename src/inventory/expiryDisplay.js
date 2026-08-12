import { isOnShoppingList } from './constants.js';
import { calculateItemStatus } from './consumption.js';

export const EXPIRING_SOON_DAYS = 3;

export function daysUntilExpiry(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${iso}T12:00:00`);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
}

export function isExpiringSoon(item, maxDays = EXPIRING_SOON_DAYS) {
  if (!item?.expiryDate || isOnShoppingList(item)) return false;
  return daysUntilExpiry(item.expiryDate) <= maxDays;
}

export function getDisplayStatus(item) {
  return calculateItemStatus(item);
}

export function formatExpiryDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatExpiryUrgency(item) {
  if (!item?.expiryDate) return null;
  const days = daysUntilExpiry(item.expiryDate);
  const dateLabel = formatExpiryDate(item.expiryDate);
  if (days < 0) return `Expired ${dateLabel}`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days (${dateLabel})`;
}

export function sortByUrgencyThenName(a, b) {
  if (a.expiryDate && b.expiryDate) {
    const cmp = a.expiryDate.localeCompare(b.expiryDate);
    if (cmp !== 0) return cmp;
  } else if (a.expiryDate) return -1;
  else if (b.expiryDate) return 1;
  return a.name.localeCompare(b.name);
}
