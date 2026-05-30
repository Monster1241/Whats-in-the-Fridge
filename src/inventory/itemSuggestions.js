import {
  BABY_CATEGORY,
  FOOD_CATEGORY,
  HOUSEHOLD_CATEGORY,
  ITEM_TYPE,
} from './constants.js';
import { isItemTypeEnabled } from './modules.js';

/** @typedef {{ name: string, itemType: 'Food'|'Household', category: string }} ItemSuggestion */

/** @type {ItemSuggestion[]} */
export const ITEM_SUGGESTIONS = [
  // Household — Cleaning
  { name: 'Dishwashing Liquid', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Dishwashing Tablets', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Multi-Surface Spray', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Sponges', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Paper Towels', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Garbage Bags', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Glass Cleaner', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Dishcloths', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Floor Cleaner', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Disinfectant Wipes', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Aluminium Foil', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Baking Paper', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  // Household — Laundry
  { name: 'Laundry Powder', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.LAUNDRY },
  { name: 'Laundry Liquid', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.LAUNDRY },
  { name: 'Fabric Softener', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.LAUNDRY },
  { name: 'Stain Remover', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.LAUNDRY },
  { name: 'Dryer Sheets', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.LAUNDRY },
  { name: 'Washing Pegs', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.LAUNDRY },
  // Household — Bathroom
  { name: 'Toilet Paper', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.BATHROOM },
  { name: 'Hand Soap', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.BATHROOM },
  { name: 'Shampoo', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.BATHROOM },
  { name: 'Conditioner', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.BATHROOM },
  { name: 'Body Wash', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.BATHROOM },
  { name: 'Toothpaste', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.BATHROOM },
  { name: 'Deodorant', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.BATHROOM },
  { name: 'Face Masks', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.BATHROOM },
  { name: 'Moisturiser', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.BATHROOM },
  { name: 'Razors', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.BATHROOM },
  // Food — Ambient
  { name: 'Pasta', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Rice', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Bread', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Olive Oil', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Soy Sauce', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Garlic', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Onions', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Flour', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Honey', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  // Food — Fresh
  { name: 'Milk', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Eggs', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Butter', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Chicken Thighs', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Chicken Breast', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Chorizo', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Basil', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Tomatoes', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Lettuce', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Bell Peppers', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Broccoli', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Salmon Fillet', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Greek Yogurt', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  // Food — Freezer
  { name: 'Frozen Peas', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FREEZER },
  { name: 'Frozen Berries', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FREEZER },
  { name: 'Ice Cream', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FREEZER },
  { name: 'Frozen Pizza', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FREEZER },
  // Baby Care
  { name: 'Nappies Size 1', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.DIAPERS },
  { name: 'Nappies Size 2', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.DIAPERS },
  { name: 'Nappies Size 3', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.DIAPERS },
  { name: 'Baby Wipes', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.WIPES },
  { name: 'Water Wipes', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.WIPES },
  { name: 'Baby Tissues', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.NURSERY },
  { name: 'Nappy Rash Cream', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.NURSERY },
  { name: 'Baby Powder', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.NURSERY },
];

export function filterItemSuggestions(query, enabledModules, limit = 8) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return [];
  return ITEM_SUGGESTIONS.filter(
    (entry) =>
      entry.name.toLowerCase().includes(needle) &&
      isItemTypeEnabled(enabledModules, entry.itemType),
  ).slice(0, limit);
}
