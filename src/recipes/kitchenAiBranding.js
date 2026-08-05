/** Shared branding for the in-app AI kitchen assistant (Fridge Scout). */

export const FRIDGE_SCOUT_NAME = 'Fridge Scout';
export const FRIDGE_SCOUT_PERSONA = 'Scout';

export const FRIDGE_SCOUT_TAGLINE = 'Your fridge-side cooking guide — chat, crave, and cook.';

export const FRIDGE_SCOUT_WELCOME =
  "Hey! I'm Scout. Tell me what's in your fridge mood, and I'll help with meals, swaps, and using things up before they expire.";

export const FRIDGE_SCOUT_CHAT_CACHE_KEY = 'fridge.fridgeScoutChat';

export const FRIDGE_SCOUT_QUICK_PROMPTS = [
  "What's for dinner tonight?",
  'Use my expiring items',
  'Quick 15-min meal idea',
  'Healthy high-protein option',
];

export const RECIPE_TWEAK_MODES = {
  higher_protein: {
    label: 'Boost Protein',
    emoji: '💪',
    instruction: 'boost the protein while keeping the dish delicious and practical for a home cook',
  },
  lower_calorie: {
    label: 'Lower Calorie',
    emoji: '🥗',
    instruction: 'lower the calories with sensible ingredient swaps while keeping it tasty and satisfying',
  },
};

/**
 * @param {import('../recipes/recipeUtils.js').Recipe | Record<string, unknown>} recipe
 * @param {'higher_protein' | 'lower_calorie'} mode
 */
export function buildRecipeTweakPrompt(recipe, mode) {
  const tweak = RECIPE_TWEAK_MODES[mode];
  if (!tweak || !recipe) return '';

  const title = String(recipe.title ?? 'Untitled recipe').trim();
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map((entry) => String(entry).trim()).filter(Boolean).join(', ')
    : '';
  const instructions = Array.isArray(recipe.instructions)
    ? recipe.instructions
        .map((step, index) => `${index + 1}. ${String(step).trim()}`)
        .filter(Boolean)
        .join('\n')
    : '';

  const meta = [
    recipe.prepTime ? `Prep: ${recipe.prepTime}` : '',
    recipe.cookTime ? `Cook: ${recipe.cookTime}` : '',
    recipe.calories ? `~${recipe.calories} cal` : '',
    recipe.macros?.protein ? `Protein: ${recipe.macros.protein}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return `Please tweak this recipe to ${tweak.instruction}.

**${title}**
${meta ? `${meta}\n` : ''}
Ingredients: ${ingredients || '(not listed)'}

Steps:
${instructions || '(not listed)'}

Give me the updated recipe with adjusted ingredients, clear steps, and estimated macros. Prefer ingredients I already have in my fridge where possible.`;
}

/** Short label shown in chat bubbles for tweak requests. */
export function buildRecipeTweakSummary(recipe, mode) {
  const tweak = RECIPE_TWEAK_MODES[mode];
  const title = String(recipe?.title ?? 'this recipe').trim();
  if (!tweak) return title;
  return `${tweak.emoji} ${tweak.label}: ${title}`;
}
