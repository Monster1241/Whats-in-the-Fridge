import {
  BABY_CATEGORY,
  defaultCategoryForItemType,
  FOOD_CATEGORY_OPTIONS,
  getCategoriesForItemType,
  inferItemTypeFromCategory,
  ITEM_TYPE,
  LEGACY_BABY_CATEGORY_TISSUES,
  LEGACY_BABY_CATEGORY_WIPES,
  STATUS,
} from './constants.js';
import { normalizePreferredStore } from './storeOptions.js';
import { getDefaultConsumptionDuration } from './consumption.js';

function backfillStockedAt(item, consumptionDuration) {
  const existing = item.stockedAt ?? item.createdAt;
  if (existing) return existing;
  const midpoint = new Date();
  midpoint.setDate(midpoint.getDate() - Math.floor(consumptionDuration * 0.5));
  return midpoint.toISOString();
}

export function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ');
}

/** Stable id for inventory rows (client uuid or MongoDB _id). */
export function getItemId(item) {
  if (!item) return '';
  const raw = item.id ?? item._id;
  if (raw == null || raw === '') return '';
  return typeof raw === 'string' ? raw : String(raw);
}

export function matchesItemId(item, id) {
  const needle = String(id ?? '').trim();
  if (!needle) return false;
  return getItemId(item) === needle;
}

export function migrateItem(item) {
  let itemType = ITEM_TYPE.FOOD;
  if (item.itemType === ITEM_TYPE.HOUSEHOLD) itemType = ITEM_TYPE.HOUSEHOLD;
  else if (item.itemType === ITEM_TYPE.BABY) itemType = ITEM_TYPE.BABY;
  else if (!item.itemType) {
    itemType = inferItemTypeFromCategory(item.category);
  }
  let category = item.category;
  if (category === LEGACY_BABY_CATEGORY_TISSUES) {
    category = BABY_CATEGORY.ESSENTIALS;
  }
  if (category === LEGACY_BABY_CATEGORY_WIPES) {
    category = BABY_CATEGORY.FOOD;
  }
  const categoryOptions = getCategoriesForItemType(itemType);
  const resolvedCategory = categoryOptions.includes(category)
    ? category
    : defaultCategoryForItemType(itemType);
  const status = item.status === STATUS.OUT ? STATUS.OUT : STATUS.FRESH;
  const consumptionDuration =
    typeof item.consumptionDuration === 'number' && item.consumptionDuration > 0
      ? item.consumptionDuration
      : getDefaultConsumptionDuration(item.name ?? '', itemType, resolvedCategory);
  const stockedAt = backfillStockedAt(item, consumptionDuration);

  const id = getItemId(item);

  return {
    ...item,
    ...(id ? { id } : {}),
    itemType,
    category: resolvedCategory,
    status,
    expiryDate: item.expiryDate ?? null,
    preferredStore: normalizePreferredStore(item.preferredStore),
    consumptionDuration,
    stockedAt,
    createdAt: stockedAt,
  };
}

export function migrateItems(items) {
  return Array.isArray(items) ? items.map(migrateItem) : [];
}
