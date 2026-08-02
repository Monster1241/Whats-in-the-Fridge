import { searchExternalRecipes, lookupExternalRecipe, searchRecipesByIngredient } from '../api.js';

/**
 * @param {Record<string, unknown>} meal
 * @returns {import('./recipeCatalog.js').Recipe}
 */
export function mapMealToRecipe(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i += 1) {
    const name = String(meal[`strIngredient${i}`] ?? '').trim();
    const measure = String(meal[`strMeasure${i}`] ?? '').trim();
    if (!name) continue;
    ingredients.push(measure ? `${measure} ${name}` : name);
  }

  let instructions = String(meal.strInstructions ?? '')
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (instructions.length === 0 && meal.strInstructions) {
    instructions = [String(meal.strInstructions).trim()];
  }

  const id = `themealdb:${meal.idMeal}`;

  return {
    id,
    title: String(meal.strMeal ?? 'Untitled recipe'),
    prepTime: 'See instructions',
    cuisine: meal.strArea ? String(meal.strArea) : undefined,
    category: meal.strCategory ? String(meal.strCategory) : undefined,
    ingredients,
    instructions,
    source: 'themealdb',
    sourceUrl:
      String(meal.strSource || '').trim() ||
      String(meal.strYoutube || '').trim() ||
      `https://www.themealdb.com/meal/${meal.idMeal}`,
    imageUrl: meal.strMealThumb ? String(meal.strMealThumb) : undefined,
  };
}

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
