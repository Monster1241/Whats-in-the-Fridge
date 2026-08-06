/**
 * Shared TheMealDB → household recipe mapping (used by client search + server seed).
 * Ingredients are stored as display strings; use parseMealIngredients() for structured data.
 */

/**
 * @param {Record<string, unknown>} meal
 * @returns {{ name: string, quantity: string }[]}
 */
export function parseMealIngredients(meal) {
  const items = [];
  for (let i = 1; i <= 20; i += 1) {
    const name = String(meal[`strIngredient${i}`] ?? '').trim();
    const quantity = String(meal[`strMeasure${i}`] ?? '').trim();
    if (!name) continue;
    items.push({ name, quantity });
  }
  return items;
}

/**
 * @param {{ name: string, quantity: string }[]} parsed
 * @returns {string[]}
 */
export function formatIngredientLines(parsed) {
  return parsed.map(({ name, quantity }) => (quantity ? `${quantity} ${name}` : name));
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function formatMealInstructions(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return [];

  let lines = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1 && text.length > 120) {
    lines = text
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  if (lines.length === 0) return [text];

  return lines.map((line, index) => {
    if (/^\d+[\).\s]/.test(line)) return line;
    return `${index + 1}. ${line}`;
  });
}

/**
 * @param {Record<string, unknown>} meal
 * @returns {import('./recipeCatalog.js').Recipe}
 */
export function mapMealToRecipe(meal) {
  const parsed = parseMealIngredients(meal);
  const category = meal.strCategory ? String(meal.strCategory) : undefined;
  const cuisine = meal.strArea ? String(meal.strArea) : undefined;

  return {
    id: `themealdb:${meal.idMeal}`,
    title: String(meal.strMeal ?? 'Untitled recipe'),
    prepTime: 'See instructions',
    cookTime: undefined,
    category,
    cuisine,
    ingredients: formatIngredientLines(parsed),
    instructions: formatMealInstructions(meal.strInstructions),
    source: 'themealdb',
    sourceUrl:
      String(meal.strSource || '').trim() ||
      String(meal.strYoutube || '').trim() ||
      `https://www.themealdb.com/meal/${meal.idMeal}`,
    imageUrl: meal.strMealThumb ? String(meal.strMealThumb) : undefined,
    isAiGenerated: false,
  };
}
