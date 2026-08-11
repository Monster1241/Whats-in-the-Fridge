import { getDefaultConsumptionDuration } from './consumption.js';
import {
  getLearnedDurationDays,
  recordConsumptionInterval,
  recordRestockEvent,
} from './restockHistory.js';

/**
 * @param {import('./restockHistory.js').RestockHistoryEntry[]} restockHistory
 * @param {{ name: string, itemType: string, category: string, preferredStore?: string|null }} item
 */
export function processItemRestock(restockHistory, item) {
  const nextHistory = recordRestockEvent(restockHistory, item);
  const learnedDays = getLearnedDurationDays(nextHistory, item);
  const defaultDays = getDefaultConsumptionDuration(
    item.name,
    item.itemType,
    item.category,
  );

  return {
    restockHistory: nextHistory,
    consumptionDuration: learnedDays ?? defaultDays,
    consumptionLearned: learnedDays != null,
  };
}

/**
 * @param {import('./restockHistory.js').RestockHistoryEntry[]} restockHistory
 * @param {{ name: string, itemType: string, category: string, preferredStore?: string|null, stockedAt?: string, createdAt?: string, status?: string }} item
 */
export function processItemDepletion(restockHistory, item) {
  return {
    restockHistory: recordConsumptionInterval(restockHistory, item),
  };
}

/**
 * @param {Record<string, unknown>} item
 * @param {{ consumptionDuration: number, consumptionLearned?: boolean, now?: string }} fields
 */
export function applyConsumptionLearningFields(item, fields) {
  const now = fields.now ?? new Date().toISOString();
  return {
    ...item,
    consumptionDuration: fields.consumptionDuration,
    consumptionLearned: fields.consumptionLearned ?? false,
    stockedAt: now,
    createdAt: now,
    dateAdded: item.dateAdded ?? now,
  };
}

/**
 * @param {import('./restockHistory.js').RestockHistoryEntry[]} restockHistory
 * @param {Record<string, unknown>} item
 * @param {string} [now]
 */
export function applyRestockLearningToItem(restockHistory, item, now = new Date().toISOString()) {
  const learning = processItemRestock(restockHistory, {
    name: String(item.name ?? ''),
    itemType: item.itemType,
    category: item.category,
    preferredStore: item.preferredStore ?? null,
  });

  return {
    item: applyConsumptionLearningFields(item, {
      consumptionDuration: learning.consumptionDuration,
      consumptionLearned: learning.consumptionLearned,
      now,
    }),
    restockHistory: learning.restockHistory,
  };
}
