import { searchExternalRecipes, lookupExternalRecipe, searchRecipesByIngredient } from '../api.js';
import { mapMealToRecipe } from './themealdbMapper.js';

export { mapMealToRecipe, parseMealIngredients, formatMealInstructions } from './themealdbMapper.js';

/**
 * @param {string} query
 * @returns {Promise<import('./recipeCatalog.js').Recipe[]>}
 */
export async function fetchRecipesBySearch(query) {
  const meals = await searchExternalRecipes(query);
  return (meals ?? []).map(mapMealToRecipe);
}

/**
 * @param {string} ingredient
 * @returns {Promise<import('./recipeCatalog.js').Recipe[]>}
 */
export async function fetchRecipesByIngredient(ingredient) {
  const meals = await searchRecipesByIngredient(ingredient);
  const summaries = meals ?? [];
  const detailed = await Promise.all(
    summaries.slice(0, 8).map(async (meal) => {
      const full = await lookupExternalRecipe(meal.idMeal);
      return full ? mapMealToRecipe(full) : mapMealToRecipe(meal);
    }),
  );
  return detailed;
}

/**
 * @param {string} mealId
 * @returns {Promise<import('./recipeCatalog.js').Recipe|null>}
 */
export async function fetchRecipeByMealId(mealId) {
  const meal = await lookupExternalRecipe(mealId);
  return meal ? mapMealToRecipe(meal) : null;
}
