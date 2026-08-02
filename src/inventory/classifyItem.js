import { FOOD_CATEGORY, ITEM_TYPE } from './constants.js';
import { resolveSubCategory } from './subcategories.js';

/** User-facing storage hints mapped to app food categories (Fresh = fridge, Ambient = pantry/spices). */
export const CLASSIFICATION_HINT = {
  FRIDGE: 'fridge',
  SPICES: 'spices',
  PANTRY: 'pantry',
  FREEZER: 'freezer',
};

const CLASSIFICATION_RULES = [
  {
    hint: CLASSIFICATION_HINT.FREEZER,
    category: FOOD_CATEGORY.FREEZER,
    keywords: [
      'frozen',
      'ice cream',
      'gelato',
      'sorbet',
      'freezer',
      'popsicle',
      'icy pole',
    ],
  },
  {
    hint: CLASSIFICATION_HINT.FRIDGE,
    category: FOOD_CATEGORY.FRESH,
    keywords: [
      'milk',
      'butter',
      'cheese',
      'yogurt',
      'yoghurt',
      'chicken',
      'meat',
      'beef',
      'cream',
      'dip',
      'tofu',
      'bacon',
      'salmon',
      'prawn',
      'egg',
      'lettuce',
      'tomato',
      'broccoli',
    ],
  },
  {
    hint: CLASSIFICATION_HINT.SPICES,
    category: FOOD_CATEGORY.AMBIENT,
    keywords: [
      'salt',
      'cumin',
      'powder',
      'paprika',
      'pepper',
      'oregano',
      'turmeric',
      'spice',
      'chili',
      'chilli',
      'cinnamon',
      'tajin',
      'masala',
    ],
  },
  {
    hint: CLASSIFICATION_HINT.PANTRY,
    category: FOOD_CATEGORY.AMBIENT,
    keywords: [
      'rice',
      'pasta',
      'sauce',
      'oil',
      'flour',
      'sugar',
      'can',
      'beans',
      'cereal',
      'oats',
      'biscuit',
      'tuna',
      'ramen',
      'noodle',
    ],
  },
];

/**
 * @param {string} name
 * @returns {string}
 */
function normalizeForMatch(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, ' ');
}

/**
 * Match item title against storage keyword lists.
 * @param {string} name
 * @returns {{ category: string, itemType: string, hint: string, subCategory: string } | null}
 */
export function classifyItem(name) {
  const normalized = normalizeForMatch(name);
  if (!normalized) return null;

  for (const rule of CLASSIFICATION_RULES) {
    const matched = rule.keywords.some((keyword) => {
      if (normalized.includes(keyword)) return true;
      return normalized.split(' ').some((word) => word === keyword || word.startsWith(keyword));
    });
    if (matched) {
      return {
        category: rule.category,
        itemType: ITEM_TYPE.FOOD,
        hint: rule.hint,
        subCategory: resolveSubCategory(name, ITEM_TYPE.FOOD, rule.category),
      };
    }
  }

  return null;
}

/**
 * Resolve storage category for intake (manual or barcode), preferring keyword match.
 * @param {string} name
 * @param {{ itemType?: string, category?: string }} [fallback]
 * @returns {{ itemType: string, category: string, subCategory: string, classified: boolean, hint?: string }}
 */
export function resolveIntakeCategory(name, fallback = {}) {
  const classified = classifyItem(name);
  if (classified) {
    return {
      itemType: classified.itemType,
      category: classified.category,
      subCategory: classified.subCategory,
      classified: true,
      hint: classified.hint,
    };
  }

  const itemType = fallback.itemType ?? ITEM_TYPE.FOOD;
  const category = fallback.category ?? FOOD_CATEGORY.FRESH;

  return {
    itemType,
    category,
    subCategory: resolveSubCategory(name, itemType, category),
    classified: false,
  };
}

export {
  buildConsumptionFields,
  calculateItemStatus,
  getDefaultConsumptionDuration,
  isAlmostFinished,
} from './consumption.js';
