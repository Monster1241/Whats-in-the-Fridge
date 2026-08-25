import { FOOD_CATEGORY, ITEM_TYPE } from './constants.js';
import { normalizeName } from './itemUtils.js';
import { isItemTypeEnabled } from './modules.js';
import { resolveSubCategory } from './subcategories.js';
import { STORAGE_LOCATION } from './smartInventory.js';

/** @typedef {'ai'|'user'|'merged'} ItemKnowledgeSource */

/**
 * @typedef {Object} ItemKnowledgeEntry
 * @property {string} name
 * @property {string} itemType
 * @property {string} category
 * @property {string} subCategory
 * @property {string|null} [storageLocation]
 * @property {number|null} [consumptionDurationDays]
 * @property {ItemKnowledgeSource} source
 * @property {number} [confidence]
 * @property {string} updatedAt
 */

export const MAX_ITEM_KNOWLEDGE_ENTRIES = 120;

/**
 * @param {{ name: string, itemType: string }} item
 */
export function itemKnowledgeKey(item) {
  return `${normalizeName(item.name)}|${item.itemType}`;
}

/**
 * @param {ItemKnowledgeEntry[]} knowledge
 * @param {{ name: string, itemType: string }} item
 * @returns {ItemKnowledgeEntry|undefined}
 */
export function findItemKnowledge(knowledge, item) {
  const key = itemKnowledgeKey(item);
  return (knowledge ?? []).find((entry) => itemKnowledgeKey(entry) === key);
}

/**
 * Find learned item by normalized name across enabled modules (any item type).
 * @param {ItemKnowledgeEntry[]|null|undefined} knowledge
 * @param {string} name
 * @param {Record<string, boolean>|null|undefined} [enabledModules]
 */
export function findItemKnowledgeByName(knowledge, name, enabledModules) {
  const needle = normalizeName(name);
  if (!needle) return undefined;
  return (knowledge ?? []).find((entry) => {
    if (normalizeName(entry.name) !== needle) return false;
    if (!enabledModules) return true;
    return isItemTypeEnabled(enabledModules, entry.itemType);
  });
}

/**
 * @param {string} itemType
 * @param {string} category
 */
function defaultStorageLocation(itemType, category) {
  if (itemType !== ITEM_TYPE.FOOD) return STORAGE_LOCATION.PANTRY;
  if (category === FOOD_CATEGORY.FREEZER) return STORAGE_LOCATION.FREEZER;
  if (category === FOOD_CATEGORY.FRESH) return STORAGE_LOCATION.FRIDGE;
  return STORAGE_LOCATION.PANTRY;
}

/**
 * @param {ItemKnowledgeEntry[]} knowledge
 * @param {Partial<ItemKnowledgeEntry> & { name: string, itemType: string }} patch
 * @param {ItemKnowledgeSource} source
 */
export function upsertItemKnowledge(knowledge, patch, source) {
  const name = String(patch.name ?? '').trim();
  if (!name) return knowledge ?? [];

  const itemType =
    patch.itemType === ITEM_TYPE.HOUSEHOLD || patch.itemType === ITEM_TYPE.BABY
      ? patch.itemType
      : ITEM_TYPE.FOOD;
  const category = String(patch.category ?? FOOD_CATEGORY.FRESH).trim() || FOOD_CATEGORY.FRESH;
  const subCategory =
    patch.subCategory ??
    resolveSubCategory(name, itemType, category);
  const key = itemKnowledgeKey({ name, itemType });
  const existing = findItemKnowledge(knowledge, { name, itemType });
  const now = new Date().toISOString();

  const entry = {
    name: existing?.name ?? name,
    itemType,
    category,
    subCategory,
    storageLocation:
      patch.storageLocation ??
      existing?.storageLocation ??
      defaultStorageLocation(itemType, category),
    consumptionDurationDays:
      typeof patch.consumptionDurationDays === 'number' && patch.consumptionDurationDays > 0
        ? Math.round(patch.consumptionDurationDays)
        : existing?.consumptionDurationDays ?? null,
    source: existing && source === 'ai' && existing.source === 'user' ? 'merged' : source,
    confidence:
      typeof patch.confidence === 'number'
        ? Math.max(0, Math.min(1, patch.confidence))
        : existing?.confidence ?? null,
    updatedAt: now,
  };

  const next = (knowledge ?? []).filter((row) => itemKnowledgeKey(row) !== key);
  next.unshift(entry);
  return next.slice(0, MAX_ITEM_KNOWLEDGE_ENTRIES);
}

/**
 * Apply saved household knowledge to intake fields.
 * @param {ItemKnowledgeEntry[]|null|undefined} knowledge
 * @param {{ name: string, itemType?: string, category?: string, subCategory?: string, storageLocation?: string, consumptionDuration?: number, consumptionLearned?: boolean }} item
 */
export function applyItemKnowledgeToIntake(knowledge, item) {
  const entry = findItemKnowledge(knowledge, {
    name: item.name,
    itemType: item.itemType ?? ITEM_TYPE.FOOD,
  });
  if (!entry) return null;

  return {
    itemType: entry.itemType,
    category: entry.category,
    subCategory: entry.subCategory,
    storageLocation: entry.storageLocation ?? defaultStorageLocation(entry.itemType, entry.category),
    consumptionDurationDays: entry.consumptionDurationDays ?? null,
    source: entry.source,
    fromKnowledge: true,
  };
}

/**
 * @param {ItemKnowledgeEntry[]} knowledge
 * @param {{ name: string, itemType: string, category?: string, subCategory?: string, storageLocation?: string }} item
 * @param {Record<string, unknown>} updates
 */
export function recordUserItemCorrection(knowledge, item, updates) {
  return upsertItemKnowledge(
    knowledge,
    {
      name: item.name,
      itemType: updates.itemType ?? item.itemType,
      category: updates.category ?? item.category,
      subCategory: updates.subCategory ?? item.subCategory,
      storageLocation: updates.storageLocation ?? item.storageLocation,
    },
    'user',
  );
}
