import { GoogleGenAI, Type } from '@google/genai';
import { getHouseholdMeta, getInventoryForHousehold, upsertHouseholdRecipes } from '../db.js';
import { EXPIRY_ALERT_DAYS, findExpiringSoonItems } from '../expiryAlerts.js';
import { enrichRecipeWithMatchMeta, findMatchingLibraryRecipes } from '../recipeMatching.js';
import {
  createAiRecipeId,
  sanitizeRecipeEntry,
  sanitizeRecipeLibrary,
} from '../recipeSchema.js';
import { getRecipeMainIngredient } from '../../src/recipes/recipeUtils.js';

const MODEL_ID = 'gemini-2.0-flash';
const AI_RECIPE_COUNT = 3;

const MACROS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    protein: { type: Type.STRING },
    carbs: { type: Type.STRING },
    fat: { type: Type.STRING },
    calories: { type: Type.INTEGER },
  },
};

const RECIPE_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      prepTime: { type: Type.STRING },
      cookTime: { type: Type.STRING },
      cuisine: { type: Type.STRING },
      category: { type: Type.STRING },
      ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
      instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
      calories: { type: Type.INTEGER },
      macros: MACROS_SCHEMA,
      missingIngredients: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: [
      'title',
      'prepTime',
      'cookTime',
      'ingredients',
      'instructions',
      'missingIngredients',
    ],
    propertyOrdering: [
      'title',
      'prepTime',
      'cookTime',
      'cuisine',
      'category',
      'ingredients',
      'instructions',
      'calories',
      'macros',
      'missingIngredients',
    ],
  },
};

const SYSTEM_INSTRUCTION = `You are a practical home-cooking assistant for Australian households.
Given a list of in-stock pantry and fridge items, create exactly 3 original, fully-formed recipes a family could cook this week.
Prioritize using items marked EXPIRING SOON to reduce food waste.
Each recipe must include realistic prepTime and cookTime (e.g. "15 min"), a cuisine, a category, a full ingredient list, step-by-step instructions, estimated calories, macros (protein/carbs/fat as strings like "25g"), and missingIngredients for staples not in the inventory.
Use clear ingredient names that match common Australian pantry labels.
Do not duplicate any recipe titles provided in the user message.
Return strict JSON only — no markdown fences or commentary.`;

let genaiClient;

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('AI recipe matching is not configured.');
    err.status = 503;
    throw err;
  }
  if (!genaiClient) {
    genaiClient = new GoogleGenAI({ apiKey });
  }
  return genaiClient;
}

function isOnShoppingList(item) {
  const status = String(item?.status ?? '').trim().toLowerCase();
  return status === 'out' || status === 'need to buy' || status === 'shopping';
}

function classifyForRecipeMatching(item, expiringIds) {
  if (!item || isOnShoppingList(item)) return null;
  const id = String(item.id ?? item.name ?? '').trim();
  if (expiringIds.has(id)) return 'ExpiringSoon';
  return 'Plentiful';
}

function formatInventoryForPrompt(items) {
  if (!items.length) {
    return 'No plentiful or expiring-soon items are currently in stock.';
  }

  const lines = items.map((item) => {
    const name = String(item.name ?? 'Unknown').trim();
    const category = [item.itemType, item.category].filter(Boolean).join(' / ') || 'General';
    const expiry = item.expiryDate ? `, expires ${item.expiryDate}` : '';
    const flag =
      item._matchStatus === 'ExpiringSoon' ? ' [EXPIRING SOON — prioritize]' : ' [Plentiful]';
    return `- ${name} (${category}${expiry})${flag}`;
  });

  return lines.join('\n');
}

function extractJsonArray(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    const err = new Error('AI returned an empty response.');
    err.status = 502;
    throw err;
  }

  let raw = trimmed;
  if (!raw.startsWith('[')) {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) raw = fenced[1].trim();
    else {
      const arrayMatch = raw.match(/\[[\s\S]*\]/);
      if (arrayMatch) raw = arrayMatch[0];
    }
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const err = new Error('AI response was not a recipe array.');
      err.status = 502;
      throw err;
    }
    return parsed;
  } catch (error) {
    if (error?.status) throw error;
    const err = new Error('AI returned invalid JSON.');
    err.status = 502;
    throw err;
  }
}

function normalizeGeneratedRecipe(entry, index, items, expiringIds) {
  const title = String(entry?.title ?? '').trim();
  if (!title) {
    const err = new Error(`AI recipe at index ${index} is missing a title.`);
    err.status = 502;
    throw err;
  }

  const ingredients = Array.isArray(entry?.ingredients)
    ? entry.ingredients.map((v) => String(v).trim()).filter(Boolean)
    : [];
  const instructions = Array.isArray(entry?.instructions)
    ? entry.instructions.map((v) => String(v).trim()).filter(Boolean)
    : [];

  if (!ingredients.length || !instructions.length) {
    const err = new Error(`AI recipe "${title}" is missing ingredients or instructions.`);
    err.status = 502;
    throw err;
  }

  const draft = {
    id: createAiRecipeId(title),
    title,
    prepTime: String(entry?.prepTime ?? '15 min').trim(),
    cookTime: String(entry?.cookTime ?? '20 min').trim(),
    cuisine: entry?.cuisine ? String(entry.cuisine).trim() : 'Australian',
    category: entry?.category ? String(entry.category).trim() : 'Dinner',
    ingredients,
    instructions,
    calories: Number(entry?.calories),
    macros: entry?.macros,
    missingIngredients: Array.isArray(entry?.missingIngredients)
      ? entry.missingIngredients.map((v) => String(v).trim()).filter(Boolean)
      : [],
    isAiGenerated: true,
    source: 'gemini',
    mainIngredient: getRecipeMainIngredient({ ingredients, title }),
  };

  const sanitized = sanitizeRecipeEntry(draft, { allowPartial: true });
  if (!sanitized) {
    const err = new Error(`AI recipe "${title}" could not be normalized.`);
    err.status = 502;
    throw err;
  }

  return enrichRecipeWithMatchMeta(sanitized, items, expiringIds);
}

function parseAiRecipesResponse(text, items, expiringIds) {
  const parsed = extractJsonArray(text);
  const recipes = parsed
    .slice(0, AI_RECIPE_COUNT)
    .map((entry, index) => normalizeGeneratedRecipe(entry, index, items, expiringIds));

  if (recipes.length < 2) {
    const err = new Error('AI did not return enough recipes.');
    err.status = 502;
    throw err;
  }

  return recipes;
}

function dedupeRecipesById(recipes) {
  const byId = new Map();
  for (const recipe of recipes) {
    if (recipe?.id) byId.set(recipe.id, recipe);
  }
  return [...byId.values()];
}

export async function generateAILiveMatches(req, res) {
  const householdId = req.user?.household_id;
  if (!householdId) {
    res.status(403).json({ error: 'Join or create a household to continue.' });
    return;
  }

  const [allItems, householdMeta] = await Promise.all([
    getInventoryForHousehold(householdId),
    getHouseholdMeta(householdId),
  ]);

  const recipeLibrary = sanitizeRecipeLibrary(householdMeta?.recipeLibrary ?? []);
  const expiringItems = findExpiringSoonItems(allItems, EXPIRY_ALERT_DAYS);
  const expiringIds = new Set(
    expiringItems.map((item) => String(item.id ?? item.name ?? '').trim()).filter(Boolean),
  );

  const matchedItems = allItems
    .map((item) => {
      const matchStatus = classifyForRecipeMatching(item, expiringIds);
      if (!matchStatus) return null;
      return { ...item, _matchStatus: matchStatus };
    })
    .filter(Boolean)
    .filter((item) => item._matchStatus === 'Plentiful' || item._matchStatus === 'ExpiringSoon');

  const matchedFromLibrary = findMatchingLibraryRecipes(
    recipeLibrary,
    allItems,
    expiringIds,
    { limit: 6 },
  );

  const existingTitles = [
    ...recipeLibrary.map((recipe) => recipe.title),
    ...matchedFromLibrary.map((recipe) => recipe.title),
  ]
    .filter(Boolean)
    .slice(0, 40);

  const inventoryList = formatInventoryForPrompt(matchedItems);
  const ai = getGenAI();

  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: `Household inventory (only plentiful and expiring-soon items):\n\n${inventoryList}\n\nExisting recipe titles to avoid duplicating:\n${
      existingTitles.length
        ? existingTitles.map((title) => `- ${title}`).join('\n')
        : '- (none yet)'
    }\n\nCreate 3 new, original recipes using these items. Prioritize expiring-soon ingredients.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: RECIPE_RESPONSE_SCHEMA,
      temperature: 0.65,
    },
  });

  const generatedRecipes = parseAiRecipesResponse(response.text, allItems, expiringIds);
  const recipesToSave = generatedRecipes.map((recipe) => {
    const { matchingInventoryCount, expiringItemsUsed, ...persisted } = recipe;
    void matchingInventoryCount;
    void expiringItemsUsed;
    return persisted;
  });

  await upsertHouseholdRecipes(householdId, recipesToSave);

  const combined = dedupeRecipesById([...matchedFromLibrary, ...generatedRecipes]);
  res.json({ recipes: combined });
}
