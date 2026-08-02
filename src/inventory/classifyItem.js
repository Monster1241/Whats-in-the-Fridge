import {
  FOOD_CATEGORY,
  HOUSEHOLD_CATEGORY,
  ITEM_TYPE,
} from './constants.js';
import { resolveSubCategory } from './subcategories.js';

/** User-facing storage hints mapped to app food categories (Fresh = fridge, Ambient = pantry/spices). */
export const CLASSIFICATION_HINT = {
  FRIDGE: 'fridge',
  SPICES: 'spices',
  PANTRY: 'pantry',
  FREEZER: 'freezer',
  CLEANING: 'cleaning',
  LAUNDRY: 'laundry',
  BATHROOM: 'bathroom',
};

/** @type {Array<{ hint: string, category: string, itemType?: string, keywords: string[] }>} */
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
      'frozen chips',
      'frozen fish',
      'frozen pizza',
    ],
  },
  {
    hint: CLASSIFICATION_HINT.PANTRY,
    category: FOOD_CATEGORY.AMBIENT,
    keywords: [
      'potato chips',
      'corn chips',
      'tortilla chips',
      'kettle chips',
      'crisps',
      'nachos',
      'popcorn',
      'rice crackers',
      'muesli bar',
    ],
  },
  {
    hint: CLASSIFICATION_HINT.CLEANING,
    category: HOUSEHOLD_CATEGORY.CLEANING,
    itemType: ITEM_TYPE.HOUSEHOLD,
    keywords: [
      'toilet cleaner',
      'toilet bowl',
      'bathroom cleaner',
      'shower cleaner',
      'oven cleaner',
      'floor cleaner',
      'glass cleaner',
      'window cleaner',
      'drain cleaner',
      'dishwashing',
      'dishwasher',
      'multi surface',
      'disinfectant',
      'bleach',
      'mould remover',
      'mold remover',
      'sponge',
      'dishcloth',
      'garbage bag',
      'bin bag',
      'paper towel',
      'aluminium foil',
      'baking paper',
      'antibacterial spray',
    ],
  },
  {
    hint: CLASSIFICATION_HINT.LAUNDRY,
    category: HOUSEHOLD_CATEGORY.LAUNDRY,
    itemType: ITEM_TYPE.HOUSEHOLD,
    keywords: [
      'laundry',
      'fabric softener',
      'stain remover',
      'dryer sheet',
      'washing powder',
      'washing liquid',
      'washing peg',
      'lint roller',
    ],
  },
  {
    hint: CLASSIFICATION_HINT.BATHROOM,
    category: HOUSEHOLD_CATEGORY.BATHROOM,
    itemType: ITEM_TYPE.HOUSEHOLD,
    keywords: [
      'toilet',
      'toilet paper',
      'hand soap',
      'shampoo',
      'conditioner',
      'body wash',
      'toothpaste',
      'deodorant',
      'moisturiser',
      'moisturizer',
      'razor',
      'tissue',
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
      'cottage',
      'cottage cheese',
      'yogurt pouch',
      'yoghurt pouch',
      'drinking yogurt',
      'chicken',
      'meat',
      'beef',
      'lamb',
      'pork',
      'mince',
      'sausage',
      'bacon',
      'chorizo',
      'steak',
      'brisket',
      'fillet',
      'sirloin',
      'rump',
      'porterhouse',
      'chuck',
      'oyster blade',
      'cream',
      'dip',
      'hummus',
      'tofu',
      'salmon',
      'barramundi',
      'baramundi',
      'barra',
      'snapper',
      'flathead',
      'prawn',
      'shrimp',
      'calamari',
      'squid',
      'fish fillet',
      'tuna steak',
      'seafood',
      'egg',
      'lettuce',
      'tomato',
      'broccoli',
      'spinach',
      'carrot',
      'cucumber',
      'mushroom',
      'capsicum',
      'bell pepper',
      'zucchini',
      'orange',
      'mandarin',
      'clementine',
      'grapefruit',
      'lemon',
      'lime',
      'apple',
      'banana',
      'berry',
      'strawberry',
      'blueberry',
      'raspberry',
      'blackberry',
      'cranberry',
      'cherry',
      'peach',
      'nectarine',
      'plum',
      'apricot',
      'pear',
      'kiwi',
      'mango',
      'pineapple',
      'papaya',
      'passionfruit',
      'pomegranate',
      'fig',
      'grape',
      'avocado',
      'potato',
      'sweet potato',
      'kumara',
      'corn cob',
      'ginger',
      'basil',
      'celery',
      'cauliflower',
      'cabbage',
      'bok choy',
      'kale',
      'silverbeet',
      'chard',
      'eggplant',
      'asparagus',
      'green bean',
      'snow pea',
      'pumpkin',
      'leek',
      'beetroot',
      'parsnip',
      'brussels',
      'rocket',
      'arugula',
      'coriander',
      'parsley',
      'mint',
      'cos lettuce',
      'iceberg',
      'ham',
      'prosciutto',
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
      'chips',
      'cracker',
      'snack',
      'stock',
      'vinegar',
      'honey',
      'peanut butter',
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
    .replace(/yoghurt/g, 'yogurt')
    .replace(/[^a-z0-9]+/g, ' ');
}

function matchesKeyword(normalized, keyword) {
  if (keyword.includes(' ')) {
    return normalized.includes(keyword);
  }
  return normalized.split(' ').some((word) => word === keyword || word.startsWith(keyword));
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
    const matched = rule.keywords.some((keyword) => matchesKeyword(normalized, keyword));
    if (matched) {
      const itemType = rule.itemType ?? ITEM_TYPE.FOOD;
      return {
        category: rule.category,
        itemType,
        hint: rule.hint,
        subCategory: resolveSubCategory(name, itemType, rule.category),
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
