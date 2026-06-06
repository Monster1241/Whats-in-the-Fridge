import {
  BABY_CATEGORY,
  FOOD_CATEGORY,
  HOUSEHOLD_CATEGORY,
  ITEM_TYPE,
} from './constants.js';
import { normalizePreferredStore } from './storeOptions.js';

const DEAL_STORE_TO_PREFERRED = {
  coles: 'Coles',
  woolworths: 'Woolworths',
  aldi: 'ALDI',
  harrisfarm: 'Harris Farm',
  costco: 'Costco',
};

/**
 * @param {{ category?: string, name?: string }} deal
 */
export function mapDealToInventory(deal) {
  const categoryKey = String(deal.category ?? '').trim().toLowerCase();
  const name = String(deal.name ?? '').toLowerCase();

  if (categoryKey === 'household') {
    return {
      itemType: ITEM_TYPE.HOUSEHOLD,
      category: HOUSEHOLD_CATEGORY.CLEANING,
    };
  }

  if (categoryKey === 'baby') {
    if (/napp|diaper|huggies|pampers/.test(name)) {
      return { itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.DIAPERS };
    }
    if (/formula|puree|pouch|rusk|cereal|food/.test(name)) {
      return { itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.FOOD };
    }
    return { itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.ESSENTIALS };
  }

  if (categoryKey === 'pantry') {
    return { itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT };
  }

  return { itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH };
}

/**
 * @param {string} store
 */
export function dealStoreToPreferred(store) {
  const label = DEAL_STORE_TO_PREFERRED[String(store ?? '').toLowerCase()];
  return label ? normalizePreferredStore(label) : null;
}
