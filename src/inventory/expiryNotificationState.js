import { isExpired, isExpiringSoon } from './expiryDisplay.js';
import { ITEM_TYPE, STATUS } from './constants.js';

const STORAGE_KEY = 'fridge.expiryAlertAck';

export function expiryAlertStorageKey(item, kind) {
  const id = String(item?.id ?? '').trim() || String(item?.name ?? '').trim().toLowerCase();
  const expiry = String(item?.expiryDate ?? '').trim();
  return `${kind}:${id}|${expiry}`;
}

function loadAckMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveAckMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * @param {Array<{ id?: string, name?: string, itemType?: string, status?: string, expiryDate?: string|null }>} items
 */
export function collectExpiryAlertCandidates(items) {
  const expiringSoon = [];
  const expired = [];

  for (const item of items ?? []) {
    if (!item?.expiryDate || item.status === STATUS.OUT) continue;
    if (item.itemType && item.itemType !== ITEM_TYPE.FOOD) continue;
    if (isExpired(item)) {
      expired.push(item);
    } else if (isExpiringSoon(item)) {
      expiringSoon.push(item);
    }
  }

  return { expiringSoon, expired };
}

/**
 * @param {Array<Record<string, unknown>>} expiringSoon
 * @param {Array<Record<string, unknown>>} expired
 */
export function findUnacknowledgedExpiryAlerts(expiringSoon, expired) {
  const ack = loadAckMap();
  const pendingSoon = expiringSoon.filter((item) => !ack[expiryAlertStorageKey(item, 'soon')]);
  const pendingExpired = expired.filter((item) => !ack[expiryAlertStorageKey(item, 'expired')]);
  return { pendingSoon, pendingExpired };
}

/** @param {string[]} keys */
export function acknowledgeExpiryAlertKeys(keys) {
  if (!keys.length) return;
  const ack = loadAckMap();
  const now = new Date().toISOString();
  for (const key of keys) {
    if (key) ack[key] = now;
  }
  saveAckMap(ack);
}

/** @param {Array<Record<string, unknown>>} expiringSoon @param {Array<Record<string, unknown>>} expired */
export function acknowledgeExpiryAlerts(expiringSoon, expired) {
  const keys = [
    ...expiringSoon.map((item) => expiryAlertStorageKey(item, 'soon')),
    ...expired.map((item) => expiryAlertStorageKey(item, 'expired')),
  ];
  acknowledgeExpiryAlertKeys(keys);
}
