import { isOnShoppingList } from './constants.js';
import { isItemTypeEnabled } from './modules.js';
import { getItemId, normalizeName } from './itemUtils.js';

/**
 * @param {Array<{ name: string, itemType: string, status: string }>} items
 * @param {string} query
 * @param {Record<string, boolean>} enabledModules
 * @param {number} [limit]
 */
export function searchInventoryItems(items, query, enabledModules, limit = 20) {
  const needle = normalizeName(query);
  if (!needle || needle.length < 1) return [];

  const scored = [];

  for (const item of items ?? []) {
    if (!isItemTypeEnabled(enabledModules, item.itemType)) continue;
    const name = normalizeName(item.name);
    if (!name) continue;

    let score = 0;
    if (name === needle) score = 100;
    else if (name.startsWith(needle)) score = 80;
    else if (name.includes(needle)) score = 60;
    else {
      const words = needle.split(' ').filter(Boolean);
      if (words.length > 1 && words.every((w) => name.includes(w))) score = 50;
    }
    if (score === 0) continue;

    scored.push({ item, score });
  }

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (isOnShoppingList(a.item) && !isOnShoppingList(b.item)) return 1;
      if (isOnShoppingList(b.item) && !isOnShoppingList(a.item)) return -1;
      return a.item.name.localeCompare(b.item.name);
    })
    .slice(0, limit)
    .map(({ item }) => item);
}

export function inventorySearchKey(item) {
  return getItemId(item) || normalizeName(item.name);
}
