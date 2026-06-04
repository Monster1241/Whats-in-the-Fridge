import { FOOD_CATEGORY, ITEM_TYPE } from './constants.js';

/** User-facing storage hints mapped to app food categories (Fresh = fridge, Ambient = pantry/spices). */
export const CLASSIFICATION_HINT = {
  FRIDGE: 'fridge',
  SPICES: 'spices',
  PANTRY: 'pantry',
};

const CLASSIFICATION_RULES = [
  {
    hint: CLASSIFICATION_HINT.FRIDGE,
    category: FOOD_CATEGORY.FRESH,
    keywords: [
      'milk',
      'butter',
      'cheese',
      'yogurt',
      'chicken',
      'meat',
      'beef',
      'cream',
      'dip',
      'tofu',
      'bacon',
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
      'cinnamon',
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
 * Match item title against fridge / spices / pantry keyword lists.
 * @param {string} name
 * @returns {{ category: string, itemType: string, hint: string } | null}
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
      };
    }
  }

  return null;
}

/**
 * Resolve storage category for intake (manual or barcode), preferring keyword match.
 * @param {string} name
 * @param {{ itemType?: string, category?: string }} [fallback]
 * @returns {{ itemType: string, category: string, classified: boolean, hint?: string }}
 */
export function resolveIntakeCategory(name, fallback = {}) {
  const classified = classifyItem(name);
  if (classified) {
    return {
      itemType: classified.itemType,
      category: classified.category,
      classified: true,
      hint: classified.hint,
    };
  }

  return {
    itemType: fallback.itemType ?? ITEM_TYPE.FOOD,
    category: fallback.category ?? FOOD_CATEGORY.FRESH,
    classified: false,
  };
}
