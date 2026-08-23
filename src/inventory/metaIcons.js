import {
  AlertCircle,
  Apple,
  Baby,
  Bath,
  Beef,
  Box,
  Candy,
  Carrot,
  CheckCircle2,
  Coffee,
  Cookie,
  CupSoda,
  Droplets,
  Egg,
  Fish,
  Flame,
  Flower2,
  Grape,
  Hand,
  Home,
  IceCreamCone,
  Leaf,
  Milk,
  Package,
  Pin,
  Refrigerator,
  Sandwich,
  ScrollText,
  Shirt,
  ShoppingCart,
  Snowflake,
  Soup,
  Sparkles,
  SprayCan,
  ToyBrick,
  Trash2,
  UtensilsCrossed,
  Wheat,
} from 'lucide-react';
import { ITEM_TYPE } from '../inventory/constants.js';
import { MODULE_KEYS } from '../inventory/modules.js';

/** @type {Record<string, import('lucide-react').LucideIcon>} */
export const META_ICONS = {
  // Modules / item types
  food: Apple,
  homeEssentials: Home,
  babyCare: Baby,
  [ITEM_TYPE.FOOD]: Apple,
  [ITEM_TYPE.HOUSEHOLD]: Home,
  [ITEM_TYPE.BABY]: Baby,
  [MODULE_KEYS.FOOD]: Apple,
  [MODULE_KEYS.HOME_ESSENTIALS]: Home,
  [MODULE_KEYS.BABY_CARE]: Baby,

  // Food storage
  Ambient: Package,
  Fresh: Refrigerator,
  Freezer: Snowflake,

  // Household storage
  Cleaning: SprayCan,
  Laundry: Shirt,
  Bathroom: Bath,

  // Baby storage
  Diapers: Box,
  'Baby Food': Soup,
  'Baby Essentials': ToyBrick,

  // Subcategories — Food Fresh
  Dairy: Milk,
  'Meat & Seafood': Beef,
  Fruit: Apple,
  Vegetables: Carrot,
  Eggs: Egg,
  'Deli & Prepared': Sandwich,

  // Subcategories — Food Ambient
  'Pantry Staples': Package,
  'Spices & Seasonings': Flame,
  Baking: Wheat,
  'Canned & Jarred': Soup,
  'Snacks & Breakfast': Cookie,
  'Sauces & Condiments': Candy,
  Beverages: CupSoda,

  // Subcategories — Food Freezer
  'Frozen Vegetables': Leaf,
  'Frozen Fruit': Grape,
  'Frozen Meals': UtensilsCrossed,
  'Frozen Meat & Seafood': Fish,
  'Ice Cream & Desserts': IceCreamCone,

  // Subcategories — Household
  'Kitchen Cleaning': SprayCan,
  'Surface & Floor': Droplets,
  'Bags & Wrap': Trash2,
  Detergent: Shirt,
  'Laundry Additives': Sparkles,
  Toiletries: Bath,
  'Paper & Tissues': ScrollText,
  'Personal Care': Hand,
  'Feminine Hygiene': Flower2,

  // Subcategories — Baby
  Nappies: Box,
  'Baby Formula & Food': Milk,
  'Baby Skincare': Droplets,
  Other: Pin,

  // Sections / misc
  shopping: ShoppingCart,
  expiring: AlertCircle,
  stocked: CheckCircle2,
  coffee: Coffee,
  'Boost Protein': Beef,
  'Lower Calorie': Leaf,
};

/**
 * Resolve a Lucide icon component from a semantic key (module, category, subcategory, etc.).
 * @param {string | null | undefined} key
 * @returns {import('lucide-react').LucideIcon}
 */
export function resolveMetaIcon(key) {
  if (!key) return Pin;
  return META_ICONS[key] || Pin;
}
