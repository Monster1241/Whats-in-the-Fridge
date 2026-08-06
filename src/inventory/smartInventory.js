import { FOOD_CATEGORY } from './constants.js';

/** @typedef {'Produce' | 'Dairy' | 'Meat' | 'Pantry' | 'Bakery' | 'Other'} FoodGroup */
/** @typedef {'Fridge' | 'Freezer' | 'Pantry'} StorageLocation */

export const FOOD_GROUP = {
  PRODUCE: 'Produce',
  DAIRY: 'Dairy',
  MEAT: 'Meat',
  PANTRY: 'Pantry',
  BAKERY: 'Bakery',
  OTHER: 'Other',
};

export const FOOD_GROUP_OPTIONS = [
  FOOD_GROUP.PRODUCE,
  FOOD_GROUP.DAIRY,
  FOOD_GROUP.MEAT,
  FOOD_GROUP.PANTRY,
  FOOD_GROUP.BAKERY,
  FOOD_GROUP.OTHER,
];

export const STORAGE_LOCATION = {
  FRIDGE: 'Fridge',
  FREEZER: 'Freezer',
  PANTRY: 'Pantry',
};

export const STORAGE_LOCATION_OPTIONS = [
  STORAGE_LOCATION.FRIDGE,
  STORAGE_LOCATION.FREEZER,
  STORAGE_LOCATION.PANTRY,
];

const COUNT_UNITS = new Set(['', 'item', 'items', 'piece', 'pieces', 'pc', 'pcs', 'each', 'unit', 'units']);

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeUnit(value) {
  const unit = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!unit || COUNT_UNITS.has(unit)) return '';
  return unit;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 */
export function areUnitsCompatible(a, b) {
  const left = normalizeUnit(a);
  const right = normalizeUnit(b);
  if (!left && !right) return true;
  if (!left || !right) return true;
  return left === right;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function sanitizeQuantity(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.round(n * 100) / 100;
}

/**
 * @param {unknown} a
 * @param {unknown} qa
 * @param {unknown} b
 * @param {unknown} qb
 */
export function sumQuantities(a, qa, b, qb) {
  if (!areUnitsCompatible(a, b)) return sanitizeQuantity(qa);
  return sanitizeQuantity(sanitizeQuantity(qa) + sanitizeQuantity(qb));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** @returns {string} YYYY-MM-DD */
export function toIsoDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Estimate shelf life from food group and storage location.
 * @param {string} foodGroup
 * @param {string} storageLocation
 * @param {Date} [fromDate]
 * @returns {string} YYYY-MM-DD
 */
export function calculateExpiryDate(foodGroup, storageLocation, fromDate = new Date()) {
  const group = String(foodGroup || FOOD_GROUP.OTHER).trim();
  const location = String(storageLocation || STORAGE_LOCATION.PANTRY).trim();
  let days = 7;

  if (group === FOOD_GROUP.PRODUCE) {
    days = location === STORAGE_LOCATION.FRIDGE ? 7 : 3;
  } else if (group === FOOD_GROUP.DAIRY || group === FOOD_GROUP.MEAT) {
    if (group === FOOD_GROUP.MEAT && location === STORAGE_LOCATION.FREEZER) {
      days = 90;
    } else if (location === STORAGE_LOCATION.FRIDGE) {
      days = 5;
    } else {
      days = group === FOOD_GROUP.MEAT ? 3 : 5;
    }
  } else if (group === FOOD_GROUP.PANTRY) {
    days = 180;
  } else if (group === FOOD_GROUP.BAKERY) {
    days = location === STORAGE_LOCATION.FRIDGE ? 7 : 5;
  } else if (location === STORAGE_LOCATION.FREEZER) {
    days = 90;
  } else if (location === STORAGE_LOCATION.FRIDGE) {
    days = 7;
  } else {
    days = 30;
  }

  return toIsoDateOnly(addDays(fromDate, days));
}

/**
 * @param {string} [category]
 * @param {string} [foodGroup]
 * @param {string} [storageLocation]
 * @returns {StorageLocation}
 */
export function inferStorageLocation(category, foodGroup, storageLocation) {
  const explicit = String(storageLocation || '').trim();
  if (STORAGE_LOCATION_OPTIONS.includes(explicit)) return explicit;

  if (category === FOOD_CATEGORY.FREEZER) return STORAGE_LOCATION.FREEZER;
  if (category === FOOD_CATEGORY.FRESH) return STORAGE_LOCATION.FRIDGE;
  if (category === FOOD_CATEGORY.AMBIENT) return STORAGE_LOCATION.PANTRY;

  if (foodGroup === FOOD_GROUP.MEAT) return STORAGE_LOCATION.FRIDGE;
  if (foodGroup === FOOD_GROUP.PRODUCE) return STORAGE_LOCATION.FRIDGE;
  if (foodGroup === FOOD_GROUP.DAIRY) return STORAGE_LOCATION.FRIDGE;
  if (foodGroup === FOOD_GROUP.PANTRY) return STORAGE_LOCATION.PANTRY;
  if (foodGroup === FOOD_GROUP.BAKERY) return STORAGE_LOCATION.PANTRY;

  return STORAGE_LOCATION.PANTRY;
}

/**
 * @param {string} name
 * @param {string} [subCategory]
 * @returns {FoodGroup}
 */
export function inferFoodGroup(name, subCategory) {
  const text = `${name || ''} ${subCategory || ''}`.toLowerCase();

  if (/\b(milk|cheese|yogurt|yoghurt|butter|cream|custard)\b/.test(text)) {
    return FOOD_GROUP.DAIRY;
  }
  if (
    /\b(chicken|beef|pork|lamb|mince|steak|bacon|sausage|fish|salmon|prawn|shrimp|meat|turkey|ham)\b/.test(
      text,
    )
  ) {
    return FOOD_GROUP.MEAT;
  }
  if (/\b(bread|bun|roll|croissant|muffin|bagel|pastry|cake)\b/.test(text)) {
    return FOOD_GROUP.BAKERY;
  }
  if (
    /\b(rice|pasta|flour|sugar|salt|oil|spice|lentil|bean|can|tin|noodle|stock|vinegar|sauce jar)\b/.test(
      text,
    )
  ) {
    return FOOD_GROUP.PANTRY;
  }
  if (
    /\b(apple|banana|orange|tomato|lettuce|spinach|carrot|onion|potato|broccoli|capsicum|pepper|fruit|vegetable|herb|avocado|cucumber|zucchini|mushroom|berry)\b/.test(
      text,
    )
  ) {
    return FOOD_GROUP.PRODUCE;
  }

  return FOOD_GROUP.OTHER;
}

/**
 * @param {Record<string, unknown>} item
 */
export function enrichInventoryFields(item) {
  const foodGroup = FOOD_GROUP_OPTIONS.includes(String(item.foodGroup))
    ? String(item.foodGroup)
    : inferFoodGroup(String(item.name || ''), String(item.subCategory || ''));
  const storageLocation = inferStorageLocation(
    String(item.category || ''),
    foodGroup,
    item.storageLocation,
  );
  const now = new Date().toISOString();

  return {
    quantity: sanitizeQuantity(item.quantity),
    unit: normalizeUnit(item.unit) ? String(item.unit).trim() : '',
    foodGroup,
    storageLocation,
    dateAdded:
      typeof item.dateAdded === 'string' && item.dateAdded.trim()
        ? item.dateAdded
        : item.stockedAt || item.createdAt || now,
    isLow: Boolean(item.isLow),
    checked: Boolean(item.checked),
    sourceRecipe:
      item.sourceRecipe == null || item.sourceRecipe === ''
        ? null
        : typeof item.sourceRecipe === 'object'
          ? item.sourceRecipe
          : { title: String(item.sourceRecipe) },
  };
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @param {string} name
 * @param {number} [neededQuantity]
 */
export function findInStockMatch(items, name, neededQuantity = 1) {
  const needle = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ');
  if (!needle) return null;

  const match = (items ?? []).find((entry) => {
    if (entry?.status === 'out') return false;
    const entryName = String(entry?.name || '')
      .trim()
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/\s+/g, ' ');
    return entryName === needle;
  });

  if (!match) return null;

  const available = sanitizeQuantity(match.quantity);
  const needed = sanitizeQuantity(neededQuantity);
  if (available >= needed) {
    return {
      item: match,
      sufficient: true,
      message: `You already have ${available}${match.unit ? ` ${match.unit}` : ''} of ${match.name} in your pantry.`,
    };
  }

  return {
    item: match,
    sufficient: false,
    message: `You have ${available}${match.unit ? ` ${match.unit}` : ''} of ${match.name}; you may not need the full amount.`,
  };
}
