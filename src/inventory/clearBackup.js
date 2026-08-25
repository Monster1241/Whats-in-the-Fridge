export const INVENTORY_CLEAR_BACKUP_DAYS = 7;
export const INVENTORY_CLEAR_BACKUP_MS =
  INVENTORY_CLEAR_BACKUP_DAYS * 24 * 60 * 60 * 1000;

/**
 * @param {{ expiresAt?: string } | null | undefined} backup
 * @param {number} [now]
 */
export function isInventoryClearBackupActive(backup, now = Date.now()) {
  if (!backup?.expiresAt) return false;
  const expires = new Date(backup.expiresAt).getTime();
  return Number.isFinite(expires) && expires > now;
}

/**
 * @param {{ expiresAt?: string } | null | undefined} backup
 * @param {number} [now]
 */
export function daysUntilInventoryClearBackupExpires(backup, now = Date.now()) {
  if (!isInventoryClearBackupActive(backup, now)) return 0;
  const expires = new Date(backup.expiresAt).getTime();
  return Math.max(1, Math.ceil((expires - now) / (24 * 60 * 60 * 1000)));
}

/**
 * Client-safe summary (no item payloads).
 * @param {{ clearedAt?: string, expiresAt?: string, itemCount?: number, items?: unknown[] } | null | undefined} backup
 * @param {number} [now]
 */
export function toInventoryClearBackupSummary(backup, now = Date.now()) {
  if (!isInventoryClearBackupActive(backup, now)) return null;
  const itemCount = Number(backup.itemCount);
  return {
    clearedAt: backup.clearedAt,
    expiresAt: backup.expiresAt,
    itemCount: Number.isFinite(itemCount) && itemCount >= 0 ? itemCount : 0,
  };
}

/**
 * @param {{ itemCount?: number, expiresAt?: string } | null | undefined} backup
 * @param {number} [now]
 */
export function formatClearBackupSubtitle(backup, now = Date.now()) {
  if (!isInventoryClearBackupActive(backup, now)) return '';
  const days = daysUntilInventoryClearBackupExpires(backup, now);
  const count = Number(backup.itemCount) || 0;
  const itemLabel = count === 1 ? 'item' : 'items';
  const dayLabel = days === 1 ? 'day' : 'days';
  return `Restore ${count} ${itemLabel} · ${days} ${dayLabel} left`;
}
