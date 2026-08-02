import {
  BABY_CATEGORY,
  BABY_CATEGORY_OPTIONS,
  defaultCategoryForItemType,
  FOOD_CATEGORY_OPTIONS,
  getCategoriesForItemType,
  HOUSEHOLD_CATEGORY_OPTIONS,
  inferItemTypeFromCategory,
  isOnShoppingList,
  ITEM_TYPE,
  LEGACY_BABY_CATEGORY_TISSUES,
  LEGACY_BABY_CATEGORY_WIPES,
  normalizeInventoryStatus,
  STATUS,
} from './constants.js';
import { getSubcategoriesForCategory, resolveSubCategory, SUBCATEGORY_OTHER } from './subcategories.js';
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

/** One row per household per normalized name + item type. */
export function inventoryItemKey(item) {
  return `${normalizeName(item?.name)}|${item?.itemType ?? ITEM_TYPE.FOOD}`;
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @param {Record<string, unknown>|string} ref Item row or display name
 * @param {string} [itemType] When ref is a string, scope duplicate lookup to this type
 */
export function findInventoryItem(items, ref, itemType) {
  if (!ref) return null;
  const list = Array.isArray(items) ? items : [];

  if (typeof ref !== 'string') {
    const id = getItemId(ref);
    if (id) {
      const byId = list.find((entry) => matchesItemId(entry, id));
      if (byId) return byId;
    }
    itemType = ref.itemType ?? itemType;
  }

  const needle = normalizeName(typeof ref === 'string' ? ref : ref.name);
  if (!needle) return null;
  const resolvedType = itemType ?? (typeof ref === 'object' ? ref.itemType : undefined);

  if (resolvedType) {
    return (
      list.find(
        (entry) =>
          normalizeName(entry.name) === needle && entry.itemType === resolvedType,
      ) ?? null
    );
  }

  return list.find((entry) => normalizeName(entry.name) === needle) ?? null;
}

function resolveLegacyCategory(category) {
  if (category === LEGACY_BABY_CATEGORY_TISSUES) return BABY_CATEGORY.ESSENTIALS;
  if (category === LEGACY_BABY_CATEGORY_WIPES) return BABY_CATEGORY.FOOD;
  return category;
}

function resolveItemTypeAndCategory(item) {
  const category = resolveLegacyCategory(item.category);

  let itemType;
  if (FOOD_CATEGORY_OPTIONS.includes(category)) {
    itemType = ITEM_TYPE.FOOD;
  } else if (HOUSEHOLD_CATEGORY_OPTIONS.includes(category)) {
    itemType = ITEM_TYPE.HOUSEHOLD;
  } else if (BABY_CATEGORY_OPTIONS.includes(category)) {
    itemType = ITEM_TYPE.BABY;
  } else if (item.itemType === ITEM_TYPE.HOUSEHOLD) {
    itemType = ITEM_TYPE.HOUSEHOLD;
  } else if (item.itemType === ITEM_TYPE.BABY) {
    itemType = ITEM_TYPE.BABY;
  } else if (item.itemType === ITEM_TYPE.FOOD) {
    itemType = ITEM_TYPE.FOOD;
  } else {
    itemType = inferItemTypeFromCategory(category);
  }

  const categoryOptions = getCategoriesForItemType(itemType);
  const resolvedCategory = categoryOptions.includes(category)
    ? category
    : defaultCategoryForItemType(itemType);

  return { itemType, category: resolvedCategory };
}

function hasProperCase(name) {
  return /[A-Z]/.test(String(name || ''));
}

function preferDisplayName(a, b) {
  if (hasProperCase(a.name) && !hasProperCase(b.name)) return a.name;
  if (hasProperCase(b.name) && !hasProperCase(a.name)) return b.name;
  return String(a.name || '').length >= String(b.name || '').length ? a.name : b.name;
}

function pickNewerStocked(a, b) {
  const ta = new Date(a.stockedAt ?? a.createdAt ?? 0).getTime();
  const tb = new Date(b.stockedAt ?? b.createdAt ?? 0).getTime();
  return tb > ta ? b : a;
}

function preferSubCategory(a, b, itemType, category) {
  const allowed = getSubcategoriesForCategory(itemType, category);
  const aOk = a.subCategory && allowed.includes(a.subCategory) ? a.subCategory : null;
  const bOk = b.subCategory && allowed.includes(b.subCategory) ? b.subCategory : null;
  if (aOk && aOk !== SUBCATEGORY_OTHER) return aOk;
  if (bOk && bOk !== SUBCATEGORY_OTHER) return bOk;
  return aOk ?? bOk ?? SUBCATEGORY_OTHER;
}

/** Item returned to inventory after shopping — fresh batch, no carried-over expiry. */
export function markItemBoughtFromShopping(item, now = new Date().toISOString()) {
  return {
    ...item,
    status: STATUS.FRESH,
    stockedAt: now,
    createdAt: now,
    expiryDate: null,
  };
}

/** Item sent to shopping / restock list — old expiry no longer applies. */
export function markItemOnShoppingList(item) {
  return {
    ...item,
    status: STATUS.OUT,
    expiryDate: null,
  };
}

function mergeDuplicateItems(a, b) {
  const status =
    isOnShoppingList(a) || isOnShoppingList(b) ? STATUS.OUT : STATUS.FRESH;
  const newer = pickNewerStocked(a, b);
  const id = getItemId(a) || getItemId(b);
  const itemType = a.itemType;
  const category = a.category;

  return {
    ...newer,
    ...(id ? { id } : {}),
    name: preferDisplayName(a, b),
    status,
    itemType,
    category,
    subCategory: preferSubCategory(a, b, itemType, category),
    expiryDate: status === STATUS.OUT ? null : a.expiryDate || b.expiryDate || null,
    preferredStore: a.preferredStore ?? b.preferredStore ?? null,
    consumptionDuration:
      (typeof a.consumptionDuration === 'number' && a.consumptionDuration > 0
        ? a.consumptionDuration
        : null) ??
      (typeof b.consumptionDuration === 'number' && b.consumptionDuration > 0
        ? b.consumptionDuration
        : null),
    stockedAt: newer.stockedAt ?? newer.createdAt,
    createdAt: newer.stockedAt ?? newer.createdAt,
  };
}

export function dedupeInventoryItems(items) {
  const byKey = new Map();
  for (const item of items ?? []) {
    if (!normalizeName(item?.name)) continue;
    const key = inventoryItemKey(item);
    const prev = byKey.get(key);
    byKey.set(key, prev ? mergeDuplicateItems(prev, item) : item);
  }
  return [...byKey.values()];
}

export function migrateItem(item) {
  const { itemType, category: resolvedCategory } = resolveItemTypeAndCategory(item);
  const status = normalizeInventoryStatus(item.status);
  const consumptionDuration =
    typeof item.consumptionDuration === 'number' && item.consumptionDuration > 0
      ? item.consumptionDuration
      : getDefaultConsumptionDuration(item.name ?? '', itemType, resolvedCategory);
  const stockedAt = backfillStockedAt(item, consumptionDuration);

  const id = getItemId(item);
  const allowedSubs = getSubcategoriesForCategory(itemType, resolvedCategory);
  const subCategory =
    item.subCategory && allowedSubs.includes(item.subCategory)
      ? item.subCategory
      : resolveSubCategory(item.name ?? '', itemType, resolvedCategory);

  return {
    ...item,
    ...(id ? { id } : {}),
    itemType,
    category: resolvedCategory,
    subCategory,
    status,
    expiryDate: item.expiryDate ?? null,
    preferredStore: normalizePreferredStore(item.preferredStore),
    consumptionDuration,
    stockedAt,
    createdAt: stockedAt,
  };
}

export function migrateItems(items) {
  if (!Array.isArray(items)) return [];
  const migrated = items.map(migrateItem).filter((item) => normalizeName(item.name));
  return dedupeInventoryItems(migrated);
}

function inventorySnapshot(items) {
  return (items ?? [])
    .map(
      (item) =>
        `${inventoryItemKey(item)}:${normalizeInventoryStatus(item.status)}:${item.category ?? ''}:${item.subCategory ?? ''}`,
    )
    .sort()
    .join('\n');
}

/** True when migrate/dedupe would change what is stored on the server. */
export function inventoryChangedByMigration(raw, migrated) {
  return inventorySnapshot(raw) !== inventorySnapshot(migrated);
}
