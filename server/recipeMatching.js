import {
  findFoodItemForIngredient,
  getCanonicalIngredientLabel,
} from '../src/recipes/ingredientMatching.js';
import {
  analyzeRecipe,
  recipeMatchesInventory,
} from '../src/recipes/recipeUtils.js';

/**
 * @param {import('./recipeSchema.js').HouseholdRecipe} recipe
 * @param {Array<Record<string, unknown>>} items
 * @param {Set<string>} expiringIds
 */
export function enrichRecipeWithMatchMeta(recipe, items, expiringIds) {
  const analysis = analyzeRecipe(recipe, items);
  const expiringItemsUsed = [];

  for (const ingredient of recipe.ingredients ?? []) {
    const match = findFoodItemForIngredient(ingredient, items);
    if (!match) continue;
    const id = String(match.id ?? match.name ?? '').trim();
    if (expiringIds.has(id)) {
      expiringItemsUsed.push(getCanonicalIngredientLabel(ingredient));
    }
  }

  return {
    ...recipe,
    matchingInventoryCount: analysis.stockedCount,
    missingIngredients: analysis.need,
    expiringItemsUsed,
  };
}

/**
 * @param {import('./recipeSchema.js').HouseholdRecipe[]} recipeLibrary
 * @param {Array<Record<string, unknown>>} items
 * @param {Set<string>} expiringIds
 * @param {{ limit?: number }} [options]
 */
export function findMatchingLibraryRecipes(recipeLibrary, items, expiringIds, { limit = 6 } = {}) {
  const scored = (Array.isArray(recipeLibrary) ? recipeLibrary : [])
    .map((recipe) => {
      const analysis = analyzeRecipe(recipe, items);
      return { recipe, analysis, score: analysis.stockedCount };
    })
    .filter(({ analysis }) => recipeMatchesInventory(analysis))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ recipe }) => enrichRecipeWithMatchMeta(recipe, items, expiringIds));
}
