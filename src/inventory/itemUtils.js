import {
  defaultCategoryForItemType,
  FOOD_CATEGORY_OPTIONS,
  getCategoriesForItemType,
  inferItemTypeFromCategory,
  ITEM_TYPE,
  STATUS,
} from './constants.js';

export function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ');
}

export function migrateItem(item) {
  let itemType = ITEM_TYPE.FOOD;
  if (item.itemType === ITEM_TYPE.HOUSEHOLD) itemType = ITEM_TYPE.HOUSEHOLD;
  else if (item.itemType === ITEM_TYPE.BABY) itemType = ITEM_TYPE.BABY;
  else if (!item.itemType) {
    itemType = inferItemTypeFromCategory(item.category);
  }
  const categoryOptions = getCategoriesForItemType(itemType);
  const category = categoryOptions.includes(item.category)
    ? item.category
    : defaultCategoryForItemType(itemType);
  const status = item.status === STATUS.OUT ? STATUS.OUT : STATUS.FRESH;

  return {
    ...item,
    itemType,
    category,
    status,
    expiryDate: item.expiryDate ?? null,
  };
}

export function migrateItems(items) {
  return Array.isArray(items) ? items.map(migrateItem) : [];
}
