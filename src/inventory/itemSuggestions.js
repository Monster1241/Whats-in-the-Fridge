import {
  BABY_CATEGORY,
  FOOD_CATEGORY,
  HOUSEHOLD_CATEGORY,
  ITEM_TYPE,
} from './constants.js';
import { isItemTypeEnabled } from './modules.js';
import { resolveSubCategory } from './subcategories.js';

/** @typedef {{ name: string, itemType: 'Food'|'Household'|'Baby', category: string, subCategory?: string }} ItemSuggestion */

export function enrichSuggestion(entry) {
  return {
    ...entry,
    subCategory:
      entry.subCategory ?? resolveSubCategory(entry.name, entry.itemType, entry.category),
  };
}

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
  { name: 'Multi-Purpose Wipes', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Microfiber Cloths', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Bleach', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Window Cleaner', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Drain Cleaner', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Rubber Gloves', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Aluminium Foil', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  { name: 'Baking Paper', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.CLEANING },
  // Household — Laundry
  { name: 'Laundry Powder', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.LAUNDRY },
  { name: 'Laundry Liquid', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.LAUNDRY },
  { name: 'Fabric Softener', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.LAUNDRY },
  { name: 'Stain Remover', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.LAUNDRY },
  { name: 'Dryer Sheets', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.LAUNDRY },
  { name: 'Washing Pegs', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.LAUNDRY },
  { name: 'Laundry Pods', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.LAUNDRY },
  { name: 'Fabric Stain Remover Spray', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.LAUNDRY },
  { name: 'Lint Roller', itemType: ITEM_TYPE.HOUSEHOLD, category: HOUSEHOLD_CATEGORY.LAUNDRY },
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
  // Food — Ambient (pantry & spices)
  { name: 'Pasta', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Rice', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Bread', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Olive Oil', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Vegetable Oil', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Soy Sauce', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Tomato Sauce', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Pasta Sauce', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Garlic', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Onions', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Flour', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Sugar', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Honey', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Oats', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Cereal', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Baked Beans', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Tuna', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Biscuits', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Salt', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Sea Salt', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Black Pepper', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Ground Pepper', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Paprika', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Cumin', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Turmeric', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Oregano', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Cinnamon', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Chili Powder', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Chili Flakes', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Garlic Powder', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Onion Powder', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Curry Powder', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Mixed Herbs', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Italian Herbs', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Stock Cubes', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Baking Powder', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Sriracha', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Maple Syrup', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Peanut Butter', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Rolled Oats', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'White Vinegar', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Apple Cider Vinegar', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Panko Breadcrumbs', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Canned Chickpeas', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Canned Black Beans', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Coconut Milk', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Tuna Cans', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Chicken Stock', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
  { name: 'Vegetable Stock', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.AMBIENT },
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
  { name: 'Beef Mince', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Pork Chops', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Cheddar Cheese', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Parmesan', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Mozzarella', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Sour Cream', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Cream Cheese', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Spinach', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Avocados', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Carrots', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Cucumbers', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Mushrooms', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Onions', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Garlic', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Ginger', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Lemons', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Limes', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Apples', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  { name: 'Bananas', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FRESH },
  // Food — Freezer
  { name: 'Frozen Peas', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FREEZER },
  { name: 'Frozen Berries', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FREEZER },
  { name: 'Ice Cream', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FREEZER },
  { name: 'Frozen Pizza', itemType: ITEM_TYPE.FOOD, category: FOOD_CATEGORY.FREEZER },
  // Baby Care
  { name: 'Nappies Size 1', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.DIAPERS },
  { name: 'Nappies Size 2', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.DIAPERS },
  { name: 'Nappies Size 3', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.DIAPERS },
  { name: 'Nappies Size 4', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.DIAPERS },
  { name: 'Nappies Size 5', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.DIAPERS },
  { name: 'Baby Formula', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.FOOD },
  { name: 'Baby Puree Pouches', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.FOOD },
  { name: 'Baby Rusks', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.FOOD },
  { name: 'Infant Cereal', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.FOOD },
  { name: 'Baby Lotion', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.ESSENTIALS },
  { name: 'Nappy Rash Cream', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.ESSENTIALS },
  { name: 'Baby Powder', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.ESSENTIALS },
  { name: 'Biodegradable Baby Wipes', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.ESSENTIALS },
  { name: 'Baby Body Wash', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.ESSENTIALS },
  { name: 'Baby Shampoo', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.ESSENTIALS },
  { name: 'Teething Gel', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.ESSENTIALS },
  { name: 'Dummy / Pacifier', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.ESSENTIALS },
  { name: 'Baby Sunscreen', itemType: ITEM_TYPE.BABY, category: BABY_CATEGORY.ESSENTIALS },
];

function suggestionMatchesQuery(name, needle) {
  const normalized = name.toLowerCase();
  if (normalized.includes(needle)) return true;
  return normalized.split(/\s+/).some(
    (word) => word.startsWith(needle) || needle.startsWith(word),
  );
}

export function filterItemSuggestions(query, enabledModules, limit = 8) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle || needle.length < 1) return [];

  const ranked = ITEM_SUGGESTIONS.filter(
    (entry) =>
      isItemTypeEnabled(enabledModules, entry.itemType) &&
      suggestionMatchesQuery(entry.name, needle),
  ).sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const aStarts = aName.startsWith(needle) ? 0 : 1;
    const bStarts = bName.startsWith(needle) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    const aWord = aName.split(/\s+/).some((w) => w.startsWith(needle)) ? 0 : 1;
    const bWord = bName.split(/\s+/).some((w) => w.startsWith(needle)) ? 0 : 1;
    if (aWord !== bWord) return aWord - bWord;
    return aName.localeCompare(bName);
  });

  return ranked.slice(0, limit).map(enrichSuggestion);
}
