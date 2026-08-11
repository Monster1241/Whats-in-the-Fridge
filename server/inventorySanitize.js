import { FOOD_GROUP_OPTIONS, STORAGE_LOCATION_OPTIONS, enrichInventoryFields, sanitizeQuantity } from '../src/inventory/smartInventory.js';

function sanitizeConsumptionDuration(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.max(Math.round(n), 1), 3650);
}

function sanitizeStockedAt(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function sanitizeDateOnly(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return text;
}

function normalizeInventoryName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ');
}

function sanitizeSourceRecipe(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const title = value.trim();
    return title ? { title } : null;
  }
  if (typeof value === 'object') {
    const title = String(value.title ?? '').trim();
    const id = value.id == null || value.id === '' ? null : String(value.id);
    if (!title && !id) return null;
    return { ...(id ? { id } : {}), ...(title ? { title } : {}) };
  }
  return null;
}

/**
 * @param {unknown} items
 * @returns {Array<Record<string, unknown>>}
 */
export function sanitizeInventoryItems(items) {
  if (!Array.isArray(items)) return [];

  const now = new Date().toISOString();
  const normalized = items.map((item) => {
    const stockedAt = sanitizeStockedAt(item?.stockedAt ?? item?.createdAt ?? item?.dateAdded) ?? now;
    const rawStatus = item?.status;
    const status =
      rawStatus != null && String(rawStatus).trim().toLowerCase() === 'out' ? 'out' : 'fresh';
    const enriched = enrichInventoryFields({
      ...item,
      stockedAt,
      createdAt: stockedAt,
      dateAdded: item?.dateAdded ?? stockedAt,
    });

    return {
      id: item?.id,
      name: item?.name,
      itemType:
        item?.itemType === 'Household'
          ? 'Household'
          : item?.itemType === 'Baby'
            ? 'Baby'
            : 'Food',
      category: item?.category,
      subCategory: item?.subCategory ?? null,
      status,
      expiryDate: sanitizeDateOnly(item?.expiryDate),
      preferredStore:
        item?.preferredStore === null || item?.preferredStore === undefined
          ? null
          : String(item.preferredStore).trim() || null,
      consumptionDuration: sanitizeConsumptionDuration(item?.consumptionDuration),
      consumptionLearned: item?.consumptionLearned === true,
      stockedAt,
      createdAt: stockedAt,
      dateAdded: enriched.dateAdded,
      quantity: enriched.quantity,
      unit: enriched.unit,
      foodGroup: FOOD_GROUP_OPTIONS.includes(enriched.foodGroup) ? enriched.foodGroup : 'Other',
      storageLocation: STORAGE_LOCATION_OPTIONS.includes(enriched.storageLocation)
        ? enriched.storageLocation
        : 'Pantry',
      isLow: enriched.isLow,
      checked: status === 'out' ? enriched.checked : false,
      sourceRecipe: status === 'out' ? sanitizeSourceRecipe(item?.sourceRecipe) : null,
    };
  });

  const byKey = new Map();
  for (const item of normalized) {
    const name = normalizeInventoryName(item.name);
    if (!name) continue;
    const key = `${name}|${item.itemType}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, item);
      continue;
    }
    const mergedStatus =
      prev.status === 'fresh' || item.status === 'fresh'
        ? 'fresh'
        : prev.status === 'out' || item.status === 'out'
          ? 'out'
          : 'fresh';
    byKey.set(key, {
      ...prev,
      ...item,
      id: prev.id || item.id,
      status: mergedStatus,
      expiryDate: prev.expiryDate || item.expiryDate || null,
      preferredStore: prev.preferredStore ?? item.preferredStore ?? null,
      quantity: sanitizeQuantity(prev.quantity) + sanitizeQuantity(item.quantity),
      unit: prev.unit || item.unit || '',
      checked: mergedStatus === 'out' ? prev.checked || item.checked : false,
      sourceRecipe:
        mergedStatus === 'out' ? prev.sourceRecipe ?? item.sourceRecipe ?? null : null,
    });
  }
  return [...byKey.values()];
}

/**
 * @param {Record<string, unknown>} item
 */
export function sanitizeInventoryItemInput(item) {
  const [sanitized] = sanitizeInventoryItems([item]);
  return sanitized ?? null;
}
