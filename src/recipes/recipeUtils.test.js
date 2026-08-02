import { describe, expect, it } from 'vitest';
import { STATUS } from '../inventory/constants.js';
import { BUILTIN_RECIPES } from './recipeCatalog.js';
import {
  analyzeRecipe,
  getRecipeById,
  MIN_STOCKED_INGREDIENTS_FOR_RECIPE,
  recipeMatchesInventory,
  searchLocalRecipes,
} from './recipeUtils.js';

describe('step 4 — recipes upgrade', () => {
  it('ships an expanded built-in catalogue', () => {
    expect(BUILTIN_RECIPES.length).toBeGreaterThanOrEqual(20);
  });

  it('finds recipes by title search', () => {
    const hits = searchLocalRecipes('carbonara');
    expect(hits.some((r) => /carbonara/i.test(r.title))).toBe(true);
  });

  it('looks up recipes by id', () => {
    const recipe = getRecipeById('creamy-basil-chicken');
    expect(recipe?.title).toMatch(/basil chicken/i);
  });

  it('matches recipes when main ingredient and minimum stock are met', () => {
    const recipe = getRecipeById('creamy-basil-chicken');
    const items = recipe.ingredients.map((name, index) => ({
      id: String(index),
      name,
      itemType: 'Food',
      category: 'Fresh',
      status: STATUS.FRESH,
    }));

    const analysis = analyzeRecipe(recipe, items);
    expect(analysis.hasMainIngredient).toBe(true);
    expect(analysis.stockedCount).toBeGreaterThanOrEqual(MIN_STOCKED_INGREDIENTS_FOR_RECIPE);
    expect(recipeMatchesInventory(analysis)).toBe(true);
  });

  it('does not match when ingredients are on the shopping list', () => {
    const recipe = getRecipeById('creamy-basil-chicken');
    const items = [
      {
        id: '1',
        name: 'Chicken Thighs',
        itemType: 'Food',
        category: 'Fresh',
        status: STATUS.OUT,
      },
      {
        id: '2',
        name: 'Basil',
        itemType: 'Food',
        category: 'Fresh',
        status: STATUS.FRESH,
      },
    ];
    const analysis = analyzeRecipe(recipe, items);
    expect(analysis.need).toContain('Chicken Thighs');
  });
});
