import { calculateItemStatus } from '../inventory/consumption.js';
import { ITEM_TYPE, STATUS } from '../inventory/constants.js';
import {
  findFoodItemForIngredient,
  getCanonicalIngredientLabel,
} from './ingredientMatching.js';
import { BUILTIN_RECIPES } from './recipeCatalog.js';

export const MIN_STOCKED_INGREDIENTS_FOR_RECIPE = 2;
export const MIN_MATCHED_RECIPES_TO_SHOW = 4;

export const MAIN_INGREDIENT_PATTERN =
  /chicken|beef|salmon|barramundi|barra|chorizo|egg|pork|mince|tofu|lentil|potato|noodle|shrimp|prawn|fish|turkey|lamb|sausage|bacon/i;

function findStockedFoodMatch(ingredientName, items) {
  return findFoodItemForIngredient(ingredientName, items);
}

export function getRecipeMainIngredient(recipe) {
  if (recipe.mainIngredient) return recipe.mainIngredient;
  const protein = recipe.ingredients.find((ing) => MAIN_INGREDIENT_PATTERN.test(ing));
  return protein ?? recipe.ingredients[0];
}

function isStockedIngredient(ingredientName, items) {
  return Boolean(findStockedFoodMatch(ingredientName, items));
}

function getDisplayStatus(item) {
  return calculateItemStatus(item);
}

/**
 * @param {import('./recipeCatalog.js').Recipe} recipe
 * @param {Array<{ name: string, itemType: string, status: string }>} items
 */
export function analyzeRecipe(recipe, items) {
  const have = [];
  const need = [];

  for (const ingredient of recipe.ingredients) {
    const match = findStockedFoodMatch(ingredient, items);
    const label = getCanonicalIngredientLabel(ingredient);
    if (!match) {
      need.push(label);
    } else {
      have.push({ name: match.name, status: getDisplayStatus(match) });
    }
  }

  const stockedCount = have.filter(
    (entry) =>
      entry.status === STATUS.FRESH ||
      entry.status === STATUS.EXPIRING ||
      entry.status === STATUS.ALMOST_FINISHED,
  ).length;
  const mainIngredient = getRecipeMainIngredient(recipe);
  const hasMainIngredient = isStockedIngredient(mainIngredient, items);
  const qualifiesForMatch =
    hasMainIngredient && stockedCount >= MIN_STOCKED_INGREDIENTS_FOR_RECIPE;

  return {
    have,
    need,
    canCook: need.length === 0,
    mainIngredient,
    hasMainIngredient,
    stockedCount,
    qualifiesForMatch,
  };
}

export function recipeMatchesInventory(analysis) {
  return analysis.qualifiesForMatch;
}

/**
 * @param {string} id
 * @param {import('./recipeCatalog.js').Recipe[]} [recipeLibrary]
 */
export function getRecipeById(id, recipeLibrary = []) {
  const builtin = BUILTIN_RECIPES.find((recipe) => recipe.id === id);
  if (builtin) return builtin;
  return recipeLibrary.find((recipe) => recipe.id === id) ?? null;
}

/**
 * @param {import('./recipeCatalog.js').Recipe[]} recipeLibrary
 */
export function getAllKnownRecipes(recipeLibrary = []) {
  const byId = new Map();
  for (const recipe of BUILTIN_RECIPES) byId.set(recipe.id, recipe);
  for (const recipe of recipeLibrary) byId.set(recipe.id, recipe);
  return [...byId.values()];
}

function normalizeSearch(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ');
}

/**
 * @param {string} query
 * @param {import('./recipeCatalog.js').Recipe[]} recipeLibrary
 */
export function searchLocalRecipes(query, recipeLibrary = []) {
  const needle = normalizeSearch(query);
  if (!needle || needle.length < 2) return [];

  const words = needle.split(/\s+/).filter(Boolean);

  return getAllKnownRecipes(recipeLibrary)
    .map((recipe) => {
      const haystack = normalizeSearch(
        [
          recipe.title,
          recipe.cuisine,
          recipe.category,
          ...(recipe.ingredients ?? []),
        ].join(' '),
      );
      const title = normalizeSearch(recipe.title);
      let score = 0;
      if (title === needle) score = 100;
      else if (title.startsWith(needle)) score = 85;
      else if (title.includes(needle)) score = 70;
      else if (words.every((word) => haystack.includes(word))) score = 55;
      else if (words.some((word) => haystack.includes(word))) score = 35;
      return { recipe, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title))
    .map((entry) => entry.recipe);
}
