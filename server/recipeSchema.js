/**
 * Household recipe library shape (persisted on households.recipeLibrary).
 * @typedef {{
 *   id: string,
 *   title: string,
 *   prepTime: string,
 *   cookTime?: string,
 *   ingredients: string[],
 *   instructions: string[],
 *   cuisine?: string,
 *   category?: string,
 *   calories?: number,
 *   macros?: { protein?: string, carbs?: string, fat?: string, calories?: number },
 *   tags?: string[],
 *   missingIngredients?: string[],
 *   isAiGenerated?: boolean,
 *   originalRecipeId?: string,
 *   matchingInventoryCount?: number,
 *   expiringItemsUsed?: string[],
 *   mainIngredient?: string,
 *   source?: string,
 *   sourceUrl?: string,
 *   imageUrl?: string,
 * }} HouseholdRecipe
 */

function sanitizeMacros(macros) {
  if (!macros || typeof macros !== 'object') return undefined;
  const protein = macros.protein ? String(macros.protein).trim().slice(0, 16) : undefined;
  const carbs = macros.carbs ? String(macros.carbs).trim().slice(0, 16) : undefined;
  const fat = macros.fat ? String(macros.fat).trim().slice(0, 16) : undefined;
  const calories = Number(macros.calories);
  const normalized = {
    ...(protein ? { protein } : {}),
    ...(carbs ? { carbs } : {}),
    ...(fat ? { fat } : {}),
    ...(Number.isFinite(calories) && calories > 0 ? { calories: Math.round(calories) } : {}),
  };
  return Object.keys(normalized).length ? normalized : undefined;
}

function sanitizeStringArray(value, { maxItems = 30, maxLen = 500 } = {}) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry ?? '').trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

/**
 * @param {unknown} entry
 * @param {{ allowPartial?: boolean }} [options]
 * @returns {HouseholdRecipe | null}
 */
export function sanitizeRecipeEntry(entry, { allowPartial = false } = {}) {
  const id = String(entry?.id ?? '').trim().slice(0, 80);
  const title = String(entry?.title ?? '').trim().slice(0, 160);
  if (!title && !allowPartial) return null;
  if (!id && !allowPartial) return null;

  const ingredients = sanitizeStringArray(entry?.ingredients, { maxItems: 30, maxLen: 120 });
  const instructions = sanitizeStringArray(entry?.instructions, { maxItems: 30, maxLen: 500 });
  const missingIngredients = sanitizeStringArray(entry?.missingIngredients, {
    maxItems: 20,
    maxLen: 120,
  });
  const expiringItemsUsed = sanitizeStringArray(entry?.expiringItemsUsed, {
    maxItems: 20,
    maxLen: 80,
  });
  const tags = sanitizeStringArray(entry?.tags, { maxItems: 12, maxLen: 48 });

  const calories = Number(entry?.calories);
  const matchingInventoryCount = Number(entry?.matchingInventoryCount);

  /** @type {HouseholdRecipe} */
  const recipe = {
    id: id || `recipe:${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
    title,
    prepTime: String(entry?.prepTime ?? 'See instructions').trim().slice(0, 40),
    ingredients,
    instructions,
  };

  const cookTime = entry?.cookTime ? String(entry.cookTime).trim().slice(0, 40) : undefined;
  if (cookTime) recipe.cookTime = cookTime;

  const cuisine = entry?.cuisine ? String(entry.cuisine).trim().slice(0, 48) : undefined;
  if (cuisine) recipe.cuisine = cuisine;

  const category = entry?.category ? String(entry.category).trim().slice(0, 48) : undefined;
  if (category) recipe.category = category;

  if (Number.isFinite(calories) && calories > 0) recipe.calories = Math.round(calories);

  const macros = sanitizeMacros(entry?.macros);
  if (macros) recipe.macros = macros;

  if (missingIngredients.length) recipe.missingIngredients = missingIngredients;
  if (expiringItemsUsed.length) recipe.expiringItemsUsed = expiringItemsUsed;
  if (tags.length) recipe.tags = tags;

  if (entry?.isAiGenerated === true) recipe.isAiGenerated = true;

  const originalRecipeId = entry?.originalRecipeId
    ? String(entry.originalRecipeId).trim().slice(0, 80)
    : undefined;
  if (originalRecipeId) recipe.originalRecipeId = originalRecipeId;

  if (Number.isFinite(matchingInventoryCount) && matchingInventoryCount >= 0) {
    recipe.matchingInventoryCount = Math.round(matchingInventoryCount);
  }

  const mainIngredient = entry?.mainIngredient
    ? String(entry.mainIngredient).trim().slice(0, 80)
    : undefined;
  if (mainIngredient) recipe.mainIngredient = mainIngredient;

  const source = entry?.source ? String(entry.source).trim().slice(0, 32) : undefined;
  if (source) recipe.source = source;

  const sourceUrl = entry?.sourceUrl ? String(entry.sourceUrl).trim().slice(0, 500) : undefined;
  if (sourceUrl) recipe.sourceUrl = sourceUrl;

  const imageUrl = entry?.imageUrl ? String(entry.imageUrl).trim().slice(0, 500) : undefined;
  if (imageUrl) recipe.imageUrl = imageUrl;

  if (!allowPartial && (!recipe.id || !recipe.title)) return null;
  return recipe;
}

/**
 * @param {unknown} library
 * @returns {HouseholdRecipe[]}
 */
export function sanitizeRecipeLibrary(library) {
  if (!Array.isArray(library)) return [];
  return library.map((entry) => sanitizeRecipeEntry(entry)).filter(Boolean).slice(0, 80);
}

export function slugifyRecipeTitle(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function createAiRecipeId(title) {
  const slug = slugifyRecipeTitle(title) || 'recipe';
  return `ai:${slug}:${Date.now().toString(36)}`;
}

export function createRemixRecipeId(title) {
  const slug = slugifyRecipeTitle(title) || 'recipe';
  return `remix:${slug}:${Date.now().toString(36)}`;
}

export const QUICK_TAG_CONSTRAINTS = {
  'Under 15 Mins':
    'Each recipe MUST have combined prepTime + cookTime totalling under 15 minutes. Use fast techniques and minimal steps.',
  'One-Pan':
    'Each recipe MUST be cooked in a single pan, pot, or skillet only (one-pan / one-pot).',
  'High Protein':
    'Each recipe MUST be high in protein (lean meats, eggs, legumes, tofu, Greek yogurt, etc.). Macros must reflect elevated protein.',
};
