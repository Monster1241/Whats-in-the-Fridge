import {
  BABY_CATEGORY,
  FOOD_CATEGORY,
  HOUSEHOLD_CATEGORY,
  ITEM_TYPE,
} from './constants.js';
import { normalizeName } from './itemUtils.js';

/** Branded, personal care, or niche — prefer major supermarkets */
const WOOLWORTHS_COLES_KEYWORDS = [
  'face mask',
  'sheet mask',
  'serum',
  'retinol',
  'moisturiser',
  'moisturizer',
  'sunscreen',
  'spf',
  'shampoo',
  'conditioner',
  'hair mask',
  'hair bleach',
  'bleach for hair',
  'hair dye',
  'colour shampoo',
  'color shampoo',
  'pet treat',
  'dog treat',
  'cat treat',
  'organic skincare',
  'electric toothbrush head',
  'whitening',
  'cosmetic',
  'perfume',
  'cologne',
  'razor blade',
  'gillette',
  'oral b',
  'colgate optic',
  'pantene',
  'head & shoulders',
  'dove body wash',
  'aveeno',
  'cetaphil',
  'la roche',
  'neutrogena',
];

/** Bulk packs and warehouse sizes — Costco */
const COSTCO_KEYWORDS = [
  'bulk',
  'kirkland',
  'warehouse',
  'large pack',
  'multipack',
  'multi pack',
  'family pack',
  'jumbo',
  'case of',
  '24 pack',
  '48 pack',
];

/** Staples & value basics — default ALDI */
const ALDI_KEYWORDS = [
  'dishwashing tablet',
  'dish tablet',
  'dishwashing liquid',
  'dish soap',
  'sponge',
  'scourer',
  'multi-surface',
  'surface spray',
  'glass cleaner',
  'garbage bag',
  'bin bag',
  'rubbish bag',
  'paper towel',
  'toilet paper',
  'laundry liquid',
  'laundry powder',
  'washing powder',
  'fabric softener',
  'bleach',
  'disinfectant',
  'floor cleaner',
  'mop',
  'broom',
  'duster',
  'chux',
  'cloth',
  'foil',
  'baking paper',
  'wrap',
  'milk',
  'butter',
  'egg',
  'bread',
  'rice',
  'pasta',
  'flour',
  'oil',
  'onion',
  'garlic',
  'potato',
  'carrot',
  'mince',
  'chicken thigh',
  'chicken breast',
  'pork',
  'sausage',
  'frozen pea',
  'frozen corn',
  'ice cream',
  'chips',
  'water',
  'sparkling water',
];

/** @typedef {{ store: string, detail: string }} ShoppingSuggestion */

/** @type {{ keywords: string[], store: string, detail: string }[]} */
const KEYWORD_RULES = [
  {
    keywords: ['dishwashing tablet', 'dish tablet', 'dishwashing liquid', 'dish soap', 'sponge', 'scourer'],
    store: 'ALDI',
    detail:
      'ALDI home-brand cleaning is hard to beat on price. Grab multi-surface spray and sponges in the same aisle run.',
  },
  {
    keywords: ['laundry liquid', 'laundry powder', 'washing powder', 'fabric softener', 'stain remover'],
    store: 'ALDI',
    detail:
      'ALDI laundry liquids and powders are strong value. Woolworths/Coles only if you need a specific sensitive-skin or fragrance-free brand.',
  },
  {
    keywords: ['garbage bag', 'bin bag', 'rubbish bag', 'paper towel', 'toilet paper'],
    store: 'ALDI',
    detail:
      'Bulk packs: Costco or ALDI for big rolls; compare unit price — Woolworths/Coles specials can win on smaller packs.',
  },
  {
    keywords: COSTCO_KEYWORDS,
    store: 'Costco',
    detail:
      "Bulk and family sizes are Costco's strength — membership pays off on pantry, cleaning, and frozen multipacks.",
  },
  {
    keywords: ['face mask', 'sheet mask', 'serum', 'retinol', 'moisturiser', 'moisturizer', 'sunscreen', 'spf'],
    store: 'Woolworths/Coles',
    detail:
      'Skincare and SPF have better range at Woolworths or Coles (Priceline aisle). ALDI occasionally has basics but brands are limited.',
  },
  {
    keywords: ['shampoo', 'conditioner', 'hair dye', 'hair bleach', 'bleach for hair'],
    store: 'Woolworths/Coles',
    detail:
      'Hair care and colour kits are easier to match at Woolworths/Coles. ALDI shampoo is fine for everyday; specialty products need the big chains.',
  },
  {
    keywords: ['pet treat', 'dog treat', 'cat treat'],
    store: 'Woolworths/Coles',
    detail:
      'Pet treats and niche flavours are stocked more reliably at Woolworths/Coles. Check the pet aisle end caps for weekly specials.',
  },
  {
    keywords: ['milk', 'butter', 'cream', 'yogurt', 'cheese', 'parmesan', 'cheddar', 'feta'],
    store: 'ALDI',
    detail:
      'ALDI or Coles for everyday dairy. Harris Farm or Woolworths Macro when you want premium or organic.',
  },
  {
    keywords: ['egg', 'eggs'],
    store: 'ALDI',
    detail:
      'ALDI or Coles home-brand eggs are great value; farmers markets for free-range top quality.',
  },
  {
    keywords: ['chicken', 'beef', 'pork', 'chorizo', 'salmon', 'bacon', 'mince', 'thigh', 'breast'],
    store: 'ALDI',
    detail:
      'ALDI or Coles for budget cuts. Local butcher, Costco, or Harris Farm for the best meat and seafood.',
  },
  {
    keywords: ['basil', 'herb', 'herbs', 'lettuce', 'tomato', 'pepper', 'broccoli', 'veg', 'fruit', 'lemon'],
    store: 'ALDI',
    detail:
      'ALDI or weekend produce markets for cheap fresh veg. Harris Farm or Woolworths Macro for organic quality.',
  },
  {
    keywords: ['pasta', 'rice', 'bread', 'flour', 'oil', 'spice', 'sauce', 'soy', 'garlic', 'onion'],
    store: 'ALDI',
    detail:
      'ALDI aisles — lowest pantry prices. Asian grocers for sauces and spices; Coles Finest or Woolworths for upgrades.',
  },
  {
    keywords: [
      'miso',
      'gochujang',
      'kimchi',
      'noodle',
      'noodles',
      'sesame',
      'fish sauce',
      'oyster',
      'mirin',
      'rice vinegar',
    ],
    store: 'Woolworths/Coles',
    detail:
      'Asian supermarkets (Tong Li, Wing Tai, Tokyo Mart) for authentic sauces. Coles/Woolworths Asian aisle for basics.',
  },
  {
    keywords: [
      'lentil',
      'lentils',
      'dal',
      'ghee',
      'turmeric',
      'cumin',
      'coriander',
      'momos',
      'gundruk',
      'timur',
      'mustard oil',
      'bamboo',
    ],
    store: 'Woolworths/Coles',
    detail:
      'Nepali and South Asian grocers for dal, spices, and mustard oil. Coles/Woolworths for lentils and everyday staples.',
  },
  {
    keywords: ['ice cream', 'frozen', 'pizza', 'peas', 'chips'],
    store: 'ALDI',
    detail:
      'ALDI frozen — strong value. Costco for bulk packs; Woolworths or Coles for wider brands and premium lines.',
  },
  {
    keywords: ['napp', 'diaper', 'diapers', 'huggies', 'pampers'],
    store: 'Woolworths/Coles',
    detail:
      'Nappies: compare unit price on Woolworths/Coles multibuy. ALDI nappies are budget-friendly if your store stocks your size.',
  },
  {
    keywords: ['baby formula', 'infant formula', 'puree', 'purees', 'baby food', 'rusk', 'rusks', 'infant cereal'],
    store: 'Woolworths/Coles',
    detail:
      'Baby food and formula — widest range at Woolworths or Coles baby aisle. ALDI for some pouches and snacks when in stock.',
  },
  {
    keywords: ['baby tissue', 'nappy rash', 'baby powder', 'infant'],
    store: 'Woolworths/Coles',
    detail:
      'Baby toiletries and creams — better range at Woolworths or Coles pharmacy aisle. Chemist Warehouse for specialist items.',
  },
];

/** @type {Record<string, ShoppingSuggestion>} */
const FOOD_CATEGORY_DEFAULTS = {
  [FOOD_CATEGORY.AMBIENT]: {
    store: 'ALDI',
    detail:
      'Pantry staples: ALDI for the lowest basket. Coles or Woolworths own-brand when you want a specific product line.',
  },
  [FOOD_CATEGORY.FRESH]: {
    store: 'ALDI',
    detail:
      'Fridge aisle: Coles or Woolworths for range and specials. Harris Farm when you want premium freshness.',
  },
  [FOOD_CATEGORY.FREEZER]: {
    store: 'ALDI',
    detail:
      'Frozen: ALDI or Costco for bulk value. Woolworths for wider brand choice on pizza, berries, and meals.',
  },
};

/** @type {Record<string, ShoppingSuggestion>} */
const BABY_CATEGORY_DEFAULTS = {
  [BABY_CATEGORY.DIAPERS]: {
    store: 'Woolworths/Coles',
    detail:
      'Diapers: check multibuy at Woolworths or Coles. ALDI nappies work well for many families if your size is in stock.',
  },
  [BABY_CATEGORY.FOOD]: {
    store: 'Woolworths/Coles',
    detail:
      'Baby food, formula, and pouches — best selection at Woolworths or Coles. Check pharmacy aisle for specialty formulas.',
  },
  [BABY_CATEGORY.ESSENTIALS]: {
    store: 'Woolworths/Coles',
    detail:
      'Baby essentials — creams, lotion, and nursery goods at Woolworths/Coles pharmacy or Chemist Warehouse.',
  },
};

/** @type {Record<string, ShoppingSuggestion>} */
const HOUSEHOLD_CATEGORY_DEFAULTS = {
  [HOUSEHOLD_CATEGORY.CLEANING]: {
    store: 'ALDI',
    detail:
      'Cleaning basics (spray, cloths, bags, dish tablets) — start at ALDI. Woolworths/Coles for specialty or eco brands.',
  },
  [HOUSEHOLD_CATEGORY.LAUNDRY]: {
    store: 'ALDI',
    detail:
      'Laundry liquid, powder, and softener — ALDI home-brand is usually best value. Major chains for sensitive-skin ranges.',
  },
  [HOUSEHOLD_CATEGORY.BATHROOM]: {
    store: 'Woolworths/Coles',
    detail:
      'Personal care and bathroom: Woolworths or Coles for range. ALDI for toothpaste, soap, and toilet paper staples.',
  },
};

const FOOD_FALLBACK = {
  store: 'ALDI',
  detail:
    'Everyday groceries: ALDI for the cheapest basket; Woolworths or Coles for reliable quality, specials, and harder-to-find items.',
};

const HOUSEHOLD_FALLBACK = {
  store: 'ALDI',
  detail:
    'Household essentials: ALDI for cleaning and laundry staples; Woolworths or Coles for personal care and branded products.',
};

function matchesWoolworthsColes(name) {
  return WOOLWORTHS_COLES_KEYWORDS.some((kw) => name.includes(kw));
}

function matchesAldi(name) {
  return ALDI_KEYWORDS.some((kw) => name.includes(kw));
}

function matchesCostco(name) {
  return COSTCO_KEYWORDS.some((kw) => name.includes(kw));
}

/**
 * @param {string} itemName
 * @param {string} category
 * @param {string} [itemType]
 * @returns {ShoppingSuggestion}
 */
export function getShoppingSuggestion(itemName, category, itemType = ITEM_TYPE.FOOD) {
  const name = normalizeName(itemName);

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => name.includes(kw))) {
      return { store: rule.store, detail: rule.detail };
    }
  }

  if (itemType === ITEM_TYPE.BABY) {
    if (BABY_CATEGORY_DEFAULTS[category]) {
      return BABY_CATEGORY_DEFAULTS[category];
    }
    return {
      store: matchesWoolworthsColes(name) ? 'Woolworths/Coles' : 'ALDI',
      detail:
        'Baby care: Woolworths or Coles for food and formula; ALDI for some basics; compare diaper unit prices.',
    };
  }

  if (itemType === ITEM_TYPE.HOUSEHOLD) {
    if (category === HOUSEHOLD_CATEGORY.BATHROOM) {
      if (
        name.includes('toothpaste') ||
        name.includes('mouthwash') ||
        name.includes('deodorant') ||
        name.includes('soap bar')
      ) {
        return {
          store: 'ALDI',
          detail:
            'Toiletries basics — ALDI keeps toothpaste, deodorant, and soap competitively priced.',
        };
      }
      if (matchesWoolworthsColes(name)) {
        return HOUSEHOLD_CATEGORY_DEFAULTS[HOUSEHOLD_CATEGORY.BATHROOM];
      }
    }

    if (HOUSEHOLD_CATEGORY_DEFAULTS[category]) {
      return HOUSEHOLD_CATEGORY_DEFAULTS[category];
    }

    return {
      store: matchesAldi(name) ? 'ALDI' : 'Woolworths/Coles',
      detail: HOUSEHOLD_FALLBACK.detail,
    };
  }

  if (FOOD_CATEGORY_DEFAULTS[category]) {
    const base = FOOD_CATEGORY_DEFAULTS[category];
    if (matchesWoolworthsColes(name) && base.store === 'ALDI') {
      return {
        store: 'Woolworths/Coles',
        detail:
          'This looks like a specialty or branded item — Woolworths or Coles will have better range than ALDI.',
      };
    }
    return base;
  }

  if (matchesCostco(name)) {
    return {
      store: 'Costco',
      detail:
        'Looks like a bulk buy — Costco often wins on unit price for large packs and Kirkland staples.',
    };
  }

  return {
    store: matchesWoolworthsColes(name) ? 'Woolworths/Coles' : matchesAldi(name) ? 'ALDI' : FOOD_FALLBACK.store,
    detail: FOOD_FALLBACK.detail,
  };
}

/**
 * @param {{ name: string, category: string, itemType?: string, preferredStore?: string|null }} item
 * @returns {ShoppingSuggestion & { isCustomStore: boolean }}
 */
export function getShoppingSuggestionForItem(item) {
  const suggested = getShoppingSuggestion(item.name, item.category, item.itemType);
  if (item.preferredStore) {
    return {
      store: item.preferredStore,
      detail: `Your household shops for this at ${item.preferredStore}.`,
      isCustomStore: true,
    };
  }
  return { ...suggested, isCustomStore: false };
}

/**
 * @param {{ preferredStore?: string|null, name: string, category: string, itemType?: string }} item
 * @returns {string}
 */
export function getStoreForItem(item) {
  if (item.preferredStore) return item.preferredStore;
  return getShoppingSuggestion(item.name, item.category, item.itemType).store;
}

/**
 * Short store label for compact UI (badge).
 * @param {string} itemName
 * @param {string} category
 * @param {string} [itemType]
 * @returns {string}
 */
export function getSuggestedStore(itemName, category, itemType = ITEM_TYPE.FOOD) {
  return getShoppingSuggestion(itemName, category, itemType).store;
}
