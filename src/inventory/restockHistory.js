import { isOnShoppingList } from './constants.js';
import { isItemTypeEnabled } from './modules.js';
import { normalizeName } from './itemUtils.js';

/** @typedef {{ name: string, itemType: string, category: string, preferredStore?: string|null, count: number, lastAt: string, intervalsDays?: number[], learnedDurationDays?: number|null }} RestockHistoryEntry */

export const MAX_HISTORY_ENTRIES = 50;
export const MAX_INTERVAL_SAMPLES = 6;
/** Need at least one completed consumption cycle before using a learned duration. */
export const MIN_INTERVALS_FOR_LEARNING = 1;
const DEFAULT_SUGGESTION_LIMIT = 10;

/**
 * @param {{ name: string, itemType: string }} item
 */
export function restockHistoryKey(item) {
  return `${normalizeName(item.name)}|${item.itemType}`;
}

/**
 * @param {RestockHistoryEntry[]} history
 * @param {{ name: string, itemType: string }} item
 * @returns {RestockHistoryEntry|undefined}
 */
export function findRestockHistoryEntry(history, item) {
  const key = restockHistoryKey(item);
  return (history ?? []).find((entry) => restockHistoryKey(entry) === key);
}

/**
 * @param {number[]} intervalsDays
 * @returns {number|null}
 */
export function computeLearnedDurationDays(intervalsDays) {
  if (!Array.isArray(intervalsDays) || intervalsDays.length < MIN_INTERVALS_FOR_LEARNING) {
    return null;
  }

  const sorted = [...intervalsDays].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  return Math.max(1, Math.min(365, Math.round(median)));
}

/**
 * @param {number} days
 */
function clampIntervalDays(days) {
  return Math.max(1, Math.min(365, Math.round(days)));
}

/**
 * @param {string|undefined|null} stockedAt ISO timestamp
 * @returns {number}
 */
function daysSinceStocked(stockedAt) {
  if (!stockedAt) return 0;
  const start = new Date(stockedAt);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  return Math.max(0, (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Track that an item was purchased/restocked (frequency + last purchase time).
 * @param {RestockHistoryEntry[]} history
 * @param {{ name: string, itemType: string, category: string, preferredStore?: string|null }} item
 * @returns {RestockHistoryEntry[]}
 */
export function recordRestockEvent(history, item) {
  const name = String(item.name ?? '').trim();
  if (!name) return history;

  const key = restockHistoryKey(item);
  const existing = findRestockHistoryEntry(history, item);
  const now = new Date().toISOString();
  const entry = {
    name,
    itemType: item.itemType,
    category: item.category,
    preferredStore: item.preferredStore ?? null,
    count: (existing?.count ?? 0) + 1,
    lastAt: now,
    intervalsDays: Array.isArray(existing?.intervalsDays) ? [...existing.intervalsDays] : [],
    learnedDurationDays:
      typeof existing?.learnedDurationDays === 'number' ? existing.learnedDurationDays : null,
  };

  const next = (history ?? []).filter((h) => restockHistoryKey(h) !== key);
  next.unshift(entry);
  return next.slice(0, MAX_HISTORY_ENTRIES);
}

/**
 * Record how long a stocked item lasted before running out.
 * @param {RestockHistoryEntry[]} history
 * @param {{ name: string, itemType: string, category: string, preferredStore?: string|null, stockedAt?: string, createdAt?: string }} item
 * @returns {RestockHistoryEntry[]}
 */
export function recordConsumptionInterval(history, item) {
  const name = String(item.name ?? '').trim();
  if (!name || isOnShoppingList(item)) return history;

  const elapsed = daysSinceStocked(item.stockedAt ?? item.createdAt);
  if (elapsed < 1) return history;

  const interval = clampIntervalDays(elapsed);
  const key = restockHistoryKey(item);
  const existing = findRestockHistoryEntry(history, item);
  const intervalsDays = [
    ...(Array.isArray(existing?.intervalsDays) ? existing.intervalsDays : []),
    interval,
  ].slice(-MAX_INTERVAL_SAMPLES);
  const learnedDurationDays = computeLearnedDurationDays(intervalsDays);

  const entry = {
    name,
    itemType: item.itemType,
    category: item.category ?? existing?.category ?? 'Ambient',
    preferredStore: item.preferredStore ?? existing?.preferredStore ?? null,
    count: existing?.count ?? 1,
    lastAt: existing?.lastAt ?? new Date().toISOString(),
    intervalsDays,
    learnedDurationDays,
  };

  const next = (history ?? []).filter((h) => restockHistoryKey(h) !== key);
  next.unshift(entry);
  return next.slice(0, MAX_HISTORY_ENTRIES);
}

/**
 * @param {RestockHistoryEntry[]} history
 * @param {{ name: string, itemType: string }} item
 * @returns {number|null}
 */
export function getLearnedDurationDays(history, item) {
  const entry = findRestockHistoryEntry(history, item);
  if (!entry) return null;
  if (!Array.isArray(entry.intervalsDays) || entry.intervalsDays.length < MIN_INTERVALS_FOR_LEARNING) {
    return null;
  }
  return (
    entry.learnedDurationDays ??
    computeLearnedDurationDays(entry.intervalsDays)
  );
}

/**
 * Top household restock picks not already on the active shopping list.
 * @param {RestockHistoryEntry[]} history
 * @param {Array<{ name: string, itemType: string, status: string }>} items
 * @param {Record<string, boolean>} enabledModules
 * @param {number} [limit]
 * @returns {RestockHistoryEntry[]}
 */
export function getFrequentlyRestocked(history, items, enabledModules, limit = DEFAULT_SUGGESTION_LIMIT) {
  const onShoppingList = new Set(
    (items ?? [])
      .filter((item) => isOnShoppingList(item))
      .map((item) => restockHistoryKey(item)),
  );

  return (history ?? [])
    .filter(
      (entry) =>
        entry.name &&
        isItemTypeEnabled(enabledModules, entry.itemType) &&
        !onShoppingList.has(restockHistoryKey(entry)),
    )
    .sort((a, b) => {
      const countDiff = (b.count ?? 0) - (a.count ?? 0);
      if (countDiff !== 0) return countDiff;
      return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
    })
    .slice(0, limit);
}
