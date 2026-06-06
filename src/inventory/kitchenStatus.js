import { STATUS } from './constants.js';
import { isItemTypeEnabled } from './modules.js';

/** Items expiring within this window appear on the Kitchen Status banner. */
export const KITCHEN_STATUS_MAX_HOURS = 48;

/**
 * Hours until end of the expiry calendar day (local time).
 * @param {string} iso YYYY-MM-DD
 */
export function hoursUntilExpiryEnd(iso) {
  const now = new Date();
  const expiry = new Date(`${iso}T23:59:59`);
  return (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
}

/**
 * In-stock item with an expiry inside 48h or showing the amber Expiring Soon badge.
 * @param {{ status: string, expiryDate?: string|null }} item
 * @param {number} [expiringSoonDays]
 */
export function isKitchenStatusItem(item, expiringSoonDays = 3) {
  if (!item || item.status === STATUS.OUT || !item.expiryDate) return false;

  if (hoursUntilExpiryEnd(item.expiryDate) <= KITCHEN_STATUS_MAX_HOURS) {
    return true;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${item.expiryDate}T12:00:00`);
  expiry.setHours(0, 0, 0, 0);
  const days = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return days >= 0 && days <= expiringSoonDays;
}

/**
 * @param {Array<{ status: string, expiryDate?: string|null, itemType: string, name: string }>} items
 * @param {Record<string, boolean>} enabledModules
 * @param {number} [expiringSoonDays]
 */
export function filterKitchenStatusItems(items, enabledModules, expiringSoonDays = 3) {
  return (items ?? [])
    .filter(
      (item) =>
        isItemTypeEnabled(enabledModules, item.itemType) && isKitchenStatusItem(item, expiringSoonDays),
    )
    .sort((a, b) => {
      if (a.expiryDate && b.expiryDate) {
        const cmp = a.expiryDate.localeCompare(b.expiryDate);
        if (cmp !== 0) return cmp;
      } else if (a.expiryDate) return -1;
      else if (b.expiryDate) return 1;
      return a.name.localeCompare(b.name);
    });
}
