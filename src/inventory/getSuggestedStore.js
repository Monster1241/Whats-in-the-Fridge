import { HOUSEHOLD_CATEGORY } from './constants.js';
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
  'niche',
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

/**
 * @param {string} itemName
 * @param {string} category
 * @param {string} [itemType]
 * @returns {string} Retail store suggestion for shopping list badge
 */
export function getSuggestedStore(itemName, category, itemType = 'Food') {
  const name = normalizeName(itemName);

  if (WOOLWORTHS_COLES_KEYWORDS.some((kw) => name.includes(kw))) {
    return 'Woolworths/Coles';
  }

  if (itemType === 'Household' && category === HOUSEHOLD_CATEGORY.BATHROOM) {
    if (
      name.includes('toothpaste') ||
      name.includes('mouthwash') ||
      name.includes('deodorant') ||
      name.includes('soap bar')
    ) {
      return 'ALDI';
    }
    return 'Woolworths/Coles';
  }

  if (ALDI_KEYWORDS.some((kw) => name.includes(kw))) {
    return 'ALDI';
  }

  if (itemType === 'Household') {
    return 'ALDI';
  }

  return 'ALDI';
}
