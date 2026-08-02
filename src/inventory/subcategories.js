import {
  BABY_CATEGORY,
  FOOD_CATEGORY,
  HOUSEHOLD_CATEGORY,
  ITEM_TYPE,
} from './constants.js';

export const SUBCATEGORY_OTHER = 'Other';

/** @type {Record<string, { emoji: string, label: string }>} */
export const SUBCATEGORY_META = {
  // Food — Fresh
  Dairy: { emoji: '🥛', label: 'Dairy' },
  'Meat & Seafood': { emoji: '🥩', label: 'Meat & Seafood' },
  Fruit: { emoji: '🍎', label: 'Fruit' },
  Vegetables: { emoji: '🥬', label: 'Vegetables' },
  Eggs: { emoji: '🥚', label: 'Eggs' },
  'Deli & Prepared': { emoji: '🥪', label: 'Deli & Prepared' },
  // Food — Ambient
  'Pantry Staples': { emoji: '🧺', label: 'Pantry Staples' },
  'Spices & Seasonings': { emoji: '🌶️', label: 'Spices & Seasonings' },
  Baking: { emoji: '🍞', label: 'Baking' },
  'Canned & Jarred': { emoji: '🥫', label: 'Canned & Jarred' },
  'Snacks & Breakfast': { emoji: '🥣', label: 'Snacks & Breakfast' },
  'Sauces & Condiments': { emoji: '🍯', label: 'Sauces & Condiments' },
  Beverages: { emoji: '🥤', label: 'Beverages' },
  // Food — Freezer
  'Frozen Vegetables': { emoji: '🥦', label: 'Frozen Vegetables' },
  'Frozen Fruit': { emoji: '🫐', label: 'Frozen Fruit' },
  'Frozen Meals': { emoji: '🍱', label: 'Frozen Meals' },
  'Frozen Meat & Seafood': { emoji: '🐟', label: 'Frozen Meat & Seafood' },
  'Ice Cream & Desserts': { emoji: '🍦', label: 'Ice Cream & Desserts' },
  // Household — Cleaning
  'Kitchen Cleaning': { emoji: '🧽', label: 'Kitchen Cleaning' },
  'Surface & Floor': { emoji: '🧴', label: 'Surface & Floor' },
  'Bags & Wrap': { emoji: '🗑️', label: 'Bags & Wrap' },
  // Household — Laundry
  Detergent: { emoji: '🧺', label: 'Detergent' },
  'Laundry Additives': { emoji: '✨', label: 'Laundry Additives' },
  // Household — Bathroom
  Toiletries: { emoji: '🧼', label: 'Toiletries' },
  'Paper & Tissues': { emoji: '🧻', label: 'Paper & Tissues' },
  'Personal Care': { emoji: '💆', label: 'Personal Care' },
  // Baby
  Nappies: { emoji: '📦', label: 'Nappies' },
  'Baby Formula & Food': { emoji: '🍼', label: 'Baby Formula & Food' },
  'Baby Skincare': { emoji: '🧴', label: 'Baby Skincare' },
  [SUBCATEGORY_OTHER]: { emoji: '📌', label: 'Other' },
};

const FOOD_SUBCATEGORIES = {
  [FOOD_CATEGORY.FRESH]: [
    'Dairy',
    'Meat & Seafood',
    'Fruit',
    'Vegetables',
    'Eggs',
    'Deli & Prepared',
    SUBCATEGORY_OTHER,
  ],
  [FOOD_CATEGORY.AMBIENT]: [
    'Pantry Staples',
    'Spices & Seasonings',
    'Baking',
    'Canned & Jarred',
    'Snacks & Breakfast',
    'Sauces & Condiments',
    'Beverages',
    SUBCATEGORY_OTHER,
  ],
  [FOOD_CATEGORY.FREEZER]: [
    'Frozen Vegetables',
    'Frozen Fruit',
    'Frozen Meals',
    'Frozen Meat & Seafood',
    'Ice Cream & Desserts',
    SUBCATEGORY_OTHER,
  ],
};

const HOUSEHOLD_SUBCATEGORIES = {
  [HOUSEHOLD_CATEGORY.CLEANING]: [
    'Kitchen Cleaning',
    'Surface & Floor',
    'Bags & Wrap',
    SUBCATEGORY_OTHER,
  ],
  [HOUSEHOLD_CATEGORY.LAUNDRY]: ['Detergent', 'Laundry Additives', SUBCATEGORY_OTHER],
  [HOUSEHOLD_CATEGORY.BATHROOM]: ['Toiletries', 'Paper & Tissues', 'Personal Care', SUBCATEGORY_OTHER],
};

const BABY_SUBCATEGORIES = {
  [BABY_CATEGORY.DIAPERS]: ['Nappies', SUBCATEGORY_OTHER],
  [BABY_CATEGORY.FOOD]: ['Baby Formula & Food', SUBCATEGORY_OTHER],
  [BABY_CATEGORY.ESSENTIALS]: ['Baby Skincare', SUBCATEGORY_OTHER],
};

/**
 * @param {string} itemType
 * @param {string} category
 * @returns {string[]}
 */
export function getSubcategoriesForCategory(itemType, category) {
  if (itemType === ITEM_TYPE.FOOD) {
    return FOOD_SUBCATEGORIES[category] ?? [SUBCATEGORY_OTHER];
  }
  if (itemType === ITEM_TYPE.HOUSEHOLD) {
    return HOUSEHOLD_SUBCATEGORIES[category] ?? [SUBCATEGORY_OTHER];
  }
  if (itemType === ITEM_TYPE.BABY) {
    return BABY_SUBCATEGORIES[category] ?? [SUBCATEGORY_OTHER];
  }
  return [SUBCATEGORY_OTHER];
}

/**
 * @param {string} subCategory
 * @param {string} [itemType]
 * @param {string} [category]
 */
export function getSubcategoryMeta(subCategory, itemType, category) {
  const meta = SUBCATEGORY_META[subCategory];
  if (meta) return meta;
  return SUBCATEGORY_META[SUBCATEGORY_OTHER];
}

function normalizeForMatch(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, ' ');
}

function matchesKeywords(normalized, keywords) {
  return keywords.some((keyword) => {
    if (keyword.includes(' ')) {
      return normalized.includes(keyword);
    }
    return normalized.split(' ').some((word) => word === keyword || word.startsWith(keyword));
  });
}

/** @type {Array<{ itemType: string, category: string, subCategory: string, keywords: string[] }>} */
const SUBCATEGORY_RULES = [
  // Fresh
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.FRESH,
    subCategory: 'Dairy',
    keywords: [
      'milk',
      'butter',
      'cheese',
      'yogurt',
      'yoghurt',
      'cream',
      'custard',
      'mozzarella',
      'parmesan',
      'cheddar',
      'feta',
      'ricotta',
      'cottage',
      'pouch',
      'drinking yogurt',
    ],
  },
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.FRESH,
    subCategory: 'Meat & Seafood',
    keywords: [
      'chicken',
      'beef',
      'pork',
      'lamb',
      'mince',
      'steak',
      'sausage',
      'bacon',
      'chorizo',
      'salmon',
      'prawn',
      'shrimp',
      'fish',
      'turkey',
      'ham',
      'prosciutto',
      'barramundi',
      'baramundi',
      'barra',
      'snapper',
      'flathead',
      'calamari',
      'squid',
      'tuna steak',
    ],
  },
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.FRESH,
    subCategory: 'Fruit',
    keywords: [
      'apple',
      'banana',
      'orange',
      'mandarin',
      'clementine',
      'berry',
      'berries',
      'grape',
      'mango',
      'melon',
      'pear',
      'peach',
      'plum',
      'lemon',
      'lime',
      'grapefruit',
      'avocado',
      'kiwi',
      'pineapple',
      'watermelon',
      'rockmelon',
    ],
  },
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.FRESH,
    subCategory: 'Vegetables',
    keywords: [
      'lettuce',
      'tomato',
      'broccoli',
      'carrot',
      'spinach',
      'cucumber',
      'capsicum',
      'pepper',
      'mushroom',
      'onion',
      'garlic',
      'ginger',
      'potato',
      'pumpkin',
      'zucchini',
      'cabbage',
      'celery',
      'corn',
      'basil',
      'herb',
    ],
  },
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.FRESH,
    subCategory: 'Eggs',
    keywords: ['egg', 'eggs'],
  },
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.FRESH,
    subCategory: 'Deli & Prepared',
    keywords: ['dip', 'hummus', 'tofu', 'deli', 'salad', 'sushi', 'wrap'],
  },
  // Ambient
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.AMBIENT,
    subCategory: 'Spices & Seasonings',
    keywords: [
      'salt',
      'pepper',
      'cumin',
      'paprika',
      'turmeric',
      'spice',
      'chili',
      'chilli',
      'cinnamon',
      'oregano',
      'herb',
      'seasoning',
      'tajin',
      'masala',
    ],
  },
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.AMBIENT,
    subCategory: 'Baking',
    keywords: ['flour', 'sugar', 'baking', 'yeast', 'vanilla', 'cocoa', 'icing'],
  },
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.AMBIENT,
    subCategory: 'Canned & Jarred',
    keywords: ['can', 'canned', 'tuna', 'beans', 'chickpea', 'jar', 'pickle'],
  },
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.AMBIENT,
    subCategory: 'Snacks & Breakfast',
    keywords: [
      'cereal',
      'oats',
      'biscuit',
      'cracker',
      'chip',
      'chips',
      'crisps',
      'popcorn',
      'nacho',
      'ramen',
      'noodle',
      'snack',
      'granola',
      'muesli',
    ],
  },
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.AMBIENT,
    subCategory: 'Sauces & Condiments',
    keywords: [
      'sauce',
      'ketchup',
      'mayo',
      'mustard',
      'vinegar',
      'sriracha',
      'soy',
      'peanut butter',
      'jam',
      'honey',
      'maple',
      'oil',
      'olive',
    ],
  },
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.AMBIENT,
    subCategory: 'Beverages',
    keywords: ['coffee', 'tea', 'juice', 'cordial', 'cola', 'drink', 'water'],
  },
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.AMBIENT,
    subCategory: 'Pantry Staples',
    keywords: ['rice', 'pasta', 'lentil', 'dal', 'grain', 'quinoa', 'couscous', 'stock'],
  },
  // Freezer
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.FREEZER,
    subCategory: 'Frozen Fruit',
    keywords: ['frozen berry', 'frozen mango', 'frozen fruit', 'berries'],
  },
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.FREEZER,
    subCategory: 'Frozen Vegetables',
    keywords: ['frozen pea', 'frozen veg', 'frozen corn', 'frozen broccoli'],
  },
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.FREEZER,
    subCategory: 'Frozen Meals',
    keywords: ['frozen pizza', 'frozen meal', 'frozen dinner', 'dim sim', 'gyoza'],
  },
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.FREEZER,
    subCategory: 'Frozen Meat & Seafood',
    keywords: ['frozen chicken', 'frozen fish', 'frozen prawn', 'frozen meat'],
  },
  {
    itemType: ITEM_TYPE.FOOD,
    category: FOOD_CATEGORY.FREEZER,
    subCategory: 'Ice Cream & Desserts',
    keywords: ['ice cream', 'gelato', 'sorbet', 'frozen dessert', 'popsicle'],
  },
  // Household
  {
    itemType: ITEM_TYPE.HOUSEHOLD,
    category: HOUSEHOLD_CATEGORY.CLEANING,
    subCategory: 'Kitchen Cleaning',
    keywords: ['dish', 'sponge', 'dishcloth', 'dishwashing'],
  },
  {
    itemType: ITEM_TYPE.HOUSEHOLD,
    category: HOUSEHOLD_CATEGORY.CLEANING,
    subCategory: 'Surface & Floor',
    keywords: ['spray', 'wipe', 'disinfect', 'floor', 'glass', 'bleach', 'cleaner', 'toilet', 'bathroom', 'oven', 'mould', 'mold', 'shower'],
  },
  {
    itemType: ITEM_TYPE.HOUSEHOLD,
    category: HOUSEHOLD_CATEGORY.CLEANING,
    subCategory: 'Bags & Wrap',
    keywords: ['garbage', 'bin bag', 'foil', 'wrap', 'paper towel'],
  },
  {
    itemType: ITEM_TYPE.HOUSEHOLD,
    category: HOUSEHOLD_CATEGORY.LAUNDRY,
    subCategory: 'Detergent',
    keywords: ['laundry powder', 'laundry liquid', 'laundry pod', 'washing powder'],
  },
  {
    itemType: ITEM_TYPE.HOUSEHOLD,
    category: HOUSEHOLD_CATEGORY.LAUNDRY,
    subCategory: 'Laundry Additives',
    keywords: ['softener', 'stain', 'peg', 'dryer sheet', 'lint'],
  },
  {
    itemType: ITEM_TYPE.HOUSEHOLD,
    category: HOUSEHOLD_CATEGORY.BATHROOM,
    subCategory: 'Paper & Tissues',
    keywords: ['toilet paper', 'tissue', 'paper towel'],
  },
  {
    itemType: ITEM_TYPE.HOUSEHOLD,
    category: HOUSEHOLD_CATEGORY.BATHROOM,
    subCategory: 'Toiletries',
    keywords: ['soap', 'shampoo', 'conditioner', 'body wash', 'toothpaste', 'deodorant'],
  },
  {
    itemType: ITEM_TYPE.HOUSEHOLD,
    category: HOUSEHOLD_CATEGORY.BATHROOM,
    subCategory: 'Personal Care',
    keywords: ['moistur', 'razor', 'mask', 'lotion', 'skincare', 'sunscreen'],
  },
  // Baby
  {
    itemType: ITEM_TYPE.BABY,
    category: BABY_CATEGORY.DIAPERS,
    subCategory: 'Nappies',
    keywords: ['napp', 'diaper'],
  },
  {
    itemType: ITEM_TYPE.BABY,
    category: BABY_CATEGORY.FOOD,
    subCategory: 'Baby Formula & Food',
    keywords: ['formula', 'puree', 'rusk', 'infant cereal', 'baby food'],
  },
  {
    itemType: ITEM_TYPE.BABY,
    category: BABY_CATEGORY.ESSENTIALS,
    subCategory: 'Baby Skincare',
    keywords: ['baby lotion', 'nappy rash', 'baby powder', 'wipe', 'teething', 'dummy', 'pacifier'],
  },
];

/**
 * Keyword-based sub-category for intake, migration, and suggestions.
 * @param {string} name
 * @param {string} itemType
 * @param {string} category
 * @returns {string}
 */
export function resolveSubCategory(name, itemType, category) {
  const normalized = normalizeForMatch(name);
  if (!normalized) return SUBCATEGORY_OTHER;

  const allowed = getSubcategoriesForCategory(itemType, category);

  for (const rule of SUBCATEGORY_RULES) {
    if (rule.itemType !== itemType || rule.category !== category) continue;
    if (!allowed.includes(rule.subCategory)) continue;
    if (matchesKeywords(normalized, rule.keywords)) {
      return rule.subCategory;
    }
  }

  if (
    itemType === ITEM_TYPE.FOOD &&
    category === FOOD_CATEGORY.FREEZER &&
    normalized.includes('frozen')
  ) {
    return allowed.includes('Frozen Vegetables') ? 'Frozen Vegetables' : SUBCATEGORY_OTHER;
  }

  return SUBCATEGORY_OTHER;
}

/**
 * Group inventory rows by sub-category in display order.
 * @param {Array<{ subCategory?: string|null, name: string }>} items
 * @param {string} itemType
 * @param {string} category
 */
export function groupItemsBySubCategory(items, itemType, category) {
  const order = getSubcategoriesForCategory(itemType, category);
  const buckets = new Map(order.map((sub) => [sub, []]));

  for (const item of items ?? []) {
    const sub = item.subCategory && buckets.has(item.subCategory) ? item.subCategory : SUBCATEGORY_OTHER;
    buckets.get(sub).push(item);
  }

  return order
    .map((subCategory) => ({
      subCategory,
      meta: getSubcategoryMeta(subCategory, itemType, category),
      items: (buckets.get(subCategory) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * @param {Array<{ subCategory?: string|null }>} items
 * @param {string} itemType
 * @param {string} category
 */
export function countItemsBySubCategory(items, itemType, category) {
  const counts = new Map();
  for (const sub of getSubcategoriesForCategory(itemType, category)) {
    counts.set(sub, 0);
  }
  for (const item of items ?? []) {
    const sub =
      item.subCategory && counts.has(item.subCategory) ? item.subCategory : SUBCATEGORY_OTHER;
    counts.set(sub, (counts.get(sub) ?? 0) + 1);
  }
  return counts;
}
