import { isOnShoppingList } from './constants.js';
import { isItemTypeEnabled } from './modules.js';
import { normalizeName } from './itemUtils.js';

/** @typedef {{ name: string, itemType: string, category: string, preferredStore?: string|null, count: number, lastAt: string }} RestockHistoryEntry */

const MAX_HISTORY_ENTRIES = 50;
const DEFAULT_SUGGESTION_LIMIT = 10;

/**
 * @param {{ name: string, itemType: string }} item
 */
export function restockHistoryKey(item) {
  return `${normalizeName(item.name)}|${item.itemType}`;
}

/**
 * @param {RestockHistoryEntry[]} history
 * @param {{ name: string, itemType: string, category: string, preferredStore?: string|null }} item
 * @returns {RestockHistoryEntry[]}
 */
export function recordRestockEvent(history, item) {
  const name = String(item.name ?? '').trim();
  if (!name) return history;

  const key = restockHistoryKey(item);
  const existing = (history ?? []).find((entry) => restockHistoryKey(entry) === key);
  const entry = {
    name,
    itemType: item.itemType,
    category: item.category,
    preferredStore: item.preferredStore ?? null,
    count: (existing?.count ?? 0) + 1,
    lastAt: new Date().toISOString(),
  };

  const next = (history ?? []).filter((h) => restockHistoryKey(h) !== key);
  next.unshift(entry);
  return next.slice(0, MAX_HISTORY_ENTRIES);
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
