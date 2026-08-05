import { isOnShoppingList, ITEM_TYPE } from '../inventory/constants.js';
import { normalizeName } from '../inventory/itemUtils.js';
import { PRODUCT_CATALOG } from '../inventory/productCatalog.js';

/** @type {Map<string, string>} normalized variant → match key */
const VARIANT_TO_KEY = new Map();

/** @type {Map<string, string>} match key → preferred display name */
const KEY_TO_DISPLAY = new Map();

function catalogNormalize(text) {
  return normalizeName(text)
    .replace(/yoghurt/g, 'yogurt')
    .replace(/\btomatos\b/g, 'tomatoes')
    .replace(/\bpotatos\b/g, 'potatoes');
}

function singularizeToken(token) {
  if (token.length < 3) return token;
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('oes')) return token.slice(0, -2);
  if (
    token.endsWith('ses') ||
    token.endsWith('xes') ||
    token.endsWith('zes') ||
    token.endsWith('ches') ||
    token.endsWith('shes')
  ) {
    return token.slice(0, -2);
  }
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

/** Stable key for comparing recipe ingredients to pantry names. */
export function ingredientMatchKey(name) {
  const norm = catalogNormalize(name);
  if (!norm) return '';
  return norm
    .split(' ')
    .map(singularizeToken)
    .join(' ');
}

function registerVariant(variant, canonicalName) {
  const display = String(canonicalName || '').trim();
  if (!display) return;

  const key = ingredientMatchKey(display);
  if (!key) return;

  KEY_TO_DISPLAY.set(key, display);

  const forms = new Set([
    display,
    variant,
    catalogNormalize(display),
    catalogNormalize(variant),
    ingredientMatchKey(display),
    ingredientMatchKey(variant),
  ]);

  for (const form of forms) {
    if (form) VARIANT_TO_KEY.set(form, key);
  }
}

function registerEquivalentGroup(canonicalName, variants = []) {
  registerVariant(canonicalName, canonicalName);
  for (const variant of variants) {
    registerVariant(variant, canonicalName);
  }
}

for (const entry of PRODUCT_CATALOG) {
  if (entry.itemType !== ITEM_TYPE.FOOD) continue;
  registerVariant(entry.name, entry.name);
  for (const alias of entry.aliases ?? []) {
    registerVariant(alias, entry.name);
  }
}

/** Recipe wording ↔ pantry catalogue names */
const RECIPE_EQUIVALENTS = [
  ['Tomatoes', ['tomato', 'tomatos', 'cherry tomato', 'cherry tomatoes']],
  ['Onions', ['onion', 'brown onion', 'red onion']],
  ['Potatoes', ['potato']],
  ['Carrots', ['carrot']],
  ['Bell Peppers', ['bell pepper', 'capsicum', 'red capsicum', 'green capsicum']],
  ['Capsicum', ['bell pepper', 'bell peppers']],
  ['Mushrooms', ['mushroom']],
  ['Frozen Peas', ['peas', 'green peas', 'pea']],
  ['Beef Mince', ['ground beef', 'minced beef']],
  ['Cheddar Cheese', ['cheddar']],
  ['Feta Cheese', ['feta']],
  ['Coriander', ['cilantro', 'fresh coriander']],
  ['Spring Onions', ['green onion', 'green onions', 'scallion', 'scallions']],
  ['Thick Cream', ['heavy cream', 'double cream', 'whipping cream']],
  ['Prawns', ['prawn', 'shrimp', 'shrimps']],
  ['Chicken Mince', ['ground chicken', 'minced chicken']],
  ['Baby Spinach', ['spinach']],
  ['Greek Yogurt', ['yogurt', 'yoghurt', 'natural yogurt']],
  ['Apples', ['apple']],
  ['Walnuts', ['walnut']],
  ['Mixed Berries', ['berries', 'berry mix']],
  ['Dried Rosemary', ['rosemary']],
  ['Parsley', ['fresh parsley']],
  ['Basil', ['fresh basil']],
  ['Mint', ['fresh mint']],
  ['Dill', ['fresh dill', 'dill weed']],
  ['Dried Dill', ['dried dill weed']],
  ['Garlic', ['garlic clove', 'garlic cloves']],
  ['Ginger', ['fresh ginger', 'ginger root']],
  ['Lemon', ['lemons']],
  ['Eggs', ['egg']],
  ['Olives', ['black olives', 'green olives', 'kalamata olives']],
];

for (const [canonical, variants] of RECIPE_EQUIVALENTS) {
  registerEquivalentGroup(canonical, variants);
}

/**
 * @param {string} name
 * @returns {string}
 */
export function resolveIngredientKey(name) {
  const norm = catalogNormalize(name);
  const stem = ingredientMatchKey(name);
  return VARIANT_TO_KEY.get(norm) ?? VARIANT_TO_KEY.get(stem) ?? stem;
}

/**
 * @param {string} a
 * @param {string} b
 */
export function ingredientsMatch(a, b) {
  const keyA = resolveIngredientKey(a);
  const keyB = resolveIngredientKey(b);
  if (keyA && keyB && keyA === keyB) return true;

  const normA = catalogNormalize(a);
  const normB = catalogNormalize(b);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const stemA = ingredientMatchKey(a);
  const stemB = ingredientMatchKey(b);
  if (stemA && stemB && stemA === stemB) return true;

  const minLen = 4;
  if (stemA.length >= minLen && stemB.length >= minLen) {
    if (stemA.includes(stemB) || stemB.includes(stemA)) return true;
  }

  return false;
}

/**
 * Prefer the pantry / catalogue display label for a recipe ingredient string.
 * @param {string} ingredientName
 */
export function getCanonicalIngredientLabel(ingredientName) {
  const key = resolveIngredientKey(ingredientName);
  return KEY_TO_DISPLAY.get(key) ?? String(ingredientName || '').trim();
}

/**
 * @param {string} ingredientName
 * @param {Array<{ name: string, itemType: string, status?: string }>} items
 */
export function findFoodItemForIngredient(ingredientName, items) {
  const list = Array.isArray(items) ? items : [];
  return (
    list.find((item) => {
      if (item.itemType !== ITEM_TYPE.FOOD || isOnShoppingList(item)) return false;
      return ingredientsMatch(ingredientName, item.name);
    }) ?? null
  );
}
