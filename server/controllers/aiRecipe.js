import { GoogleGenAI, Type } from '@google/genai';
import { getHouseholdMeta, getInventoryForHousehold, upsertHouseholdRecipes } from '../db.js';
import { EXPIRY_ALERT_DAYS, findExpiringSoonItems } from '../expiryAlerts.js';
import { enrichRecipeWithMatchMeta, findMatchingLibraryRecipes } from '../recipeMatching.js';
import {
  createAiRecipeId,
  createRemixRecipeId,
  QUICK_TAG_CONSTRAINTS,
  sanitizeRecipeEntry,
  sanitizeRecipeLibrary,
} from '../recipeSchema.js';
import { getRecipeMainIngredient } from '../../src/recipes/recipeUtils.js';

const MODEL_ID = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';
const AI_RECIPE_COUNT = 3;

const REMIX_MODES = new Set(['higher_protein', 'lower_calorie', 'quick_speed']);

const MACROS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    protein: { type: Type.STRING },
    carbs: { type: Type.STRING },
    fat: { type: Type.STRING },
    calories: { type: Type.INTEGER },
  },
};

const RECIPE_OBJECT_SCHEMA = {
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
    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
    missingIngredients: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'title',
    'prepTime',
    'cookTime',
    'ingredients',
    'instructions',
    'missingIngredients',
    'tags',
    'macros',
  ],
};

const RECIPE_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: RECIPE_OBJECT_SCHEMA,
};

const REMIX_RESPONSE_SCHEMA = RECIPE_OBJECT_SCHEMA;

const SYSTEM_INSTRUCTION = `You are a practical home-cooking assistant for Australian households.
Given a list of in-stock pantry and fridge items, create exactly 3 original, fully-formed recipes a family could cook this week.
Prioritize using items marked EXPIRING SOON to reduce food waste.
Each recipe must include realistic prepTime and cookTime (e.g. "15 min"), a cuisine, a category, a full ingredient list, step-by-step instructions, estimated calories, macros (protein/carbs/fat as strings like "25g"), a tags array (e.g. "One-Pan", "High Protein", "Under 15 Mins"), and missingIngredients for staples not in the inventory.
Use clear ingredient names that match common Australian pantry labels.
Do not duplicate any recipe titles provided in the user message.
Return strict JSON only — no markdown fences or commentary.`;

const REMIX_SYSTEM_INSTRUCTION = `You are FitChef, a nutrition-savvy recipe remix assistant for Australian households.
Given an existing recipe, create one improved variant that follows the requested remix mode while keeping the dish recognisable and delicious.
Return a fully-formed recipe with title, prepTime, cookTime, cuisine, category, ingredients, instructions, calories, macros, tags, and missingIngredients.
Use clear Australian pantry ingredient names.
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

function buildFilterInstructions({ cravings, quickTag }) {
  const parts = [];

  if (cravings) {
    parts.push(
      `The cook is craving: "${cravings}". Prioritize recipes that match this craving style, flavour profile, or dish type.`,
    );
  }

  if (quickTag) {
    const constraint =
      QUICK_TAG_CONSTRAINTS[quickTag] ??
      `Follow the quick-cook filter "${quickTag}" for every recipe.`;
    parts.push(constraint);
    parts.push(`Include "${quickTag}" in the tags array for each recipe.`);
  }

  if (!parts.length) return '';
  return `\n\nSpecial requirements:\n${parts.map((line) => `- ${line}`).join('\n')}`;
}

function extractJsonValue(text, { expectArray = true } = {}) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    const err = new Error('AI returned an empty response.');
    err.status = 502;
    throw err;
  }

  let raw = trimmed;
  const startsCorrectly = expectArray ? raw.startsWith('[') : raw.startsWith('{');
  if (!startsCorrectly) {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) raw = fenced[1].trim();
    else if (expectArray) {
      const arrayMatch = raw.match(/\[[\s\S]*\]/);
      if (arrayMatch) raw = arrayMatch[0];
    } else {
      const objectMatch = raw.match(/\{[\s\S]*\}/);
      if (objectMatch) raw = objectMatch[0];
    }
  }

  try {
    const parsed = JSON.parse(raw);
    if (expectArray && !Array.isArray(parsed)) {
      const err = new Error('AI response was not a recipe array.');
      err.status = 502;
      throw err;
    }
    if (!expectArray && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
      const err = new Error('AI response was not a recipe object.');
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

function normalizeGeneratedRecipe(entry, index, items, expiringIds, { idFactory = createAiRecipeId, extra = {} } = {}) {
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
  const tags = Array.isArray(entry?.tags)
    ? entry.tags.map((v) => String(v).trim()).filter(Boolean)
    : [];

  if (!ingredients.length || !instructions.length) {
    const err = new Error(`AI recipe "${title}" is missing ingredients or instructions.`);
    err.status = 502;
    throw err;
  }

  const draft = {
    id: idFactory(title),
    title,
    prepTime: String(entry?.prepTime ?? '15 min').trim(),
    cookTime: String(entry?.cookTime ?? '20 min').trim(),
    cuisine: entry?.cuisine ? String(entry.cuisine).trim() : 'Australian',
    category: entry?.category ? String(entry.category).trim() : 'Dinner',
    ingredients,
    instructions,
    calories: Number(entry?.calories),
    macros: entry?.macros,
    tags,
    missingIngredients: Array.isArray(entry?.missingIngredients)
      ? entry.missingIngredients.map((v) => String(v).trim()).filter(Boolean)
      : [],
    isAiGenerated: true,
    source: 'gemini',
    mainIngredient: getRecipeMainIngredient({ ingredients, title }),
    ...extra,
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
  const parsed = extractJsonValue(text, { expectArray: true });
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

function parseRemixResponse(text, items, expiringIds, originalRecipeId) {
  const parsed = extractJsonValue(text, { expectArray: false });
  return normalizeGeneratedRecipe(parsed, 0, items, expiringIds, {
    idFactory: createRemixRecipeId,
    extra: { originalRecipeId },
  });
}

function dedupeRecipesById(recipes) {
  const byId = new Map();
  for (const recipe of recipes) {
    if (recipe?.id) byId.set(recipe.id, recipe);
  }
  return [...byId.values()];
}

function stripPersistedMeta(recipe) {
  const { matchingInventoryCount, expiringItemsUsed, ...persisted } = recipe;
  void matchingInventoryCount;
  void expiringItemsUsed;
  return persisted;
}

function getRemixModeInstruction(mode) {
  switch (mode) {
    case 'higher_protein':
      return 'Remix for HIGHER PROTEIN: increase protein by adjusting quantities or substituting ingredients (e.g. Greek yogurt, extra lean meat, legumes, tofu) while maintaining taste. Update macros accordingly. Add "High Protein" to tags.';
    case 'lower_calorie':
      return 'Remix for LOWER CALORIE: swap high-calorie items for lighter alternatives (e.g. reduce oil/cream, use lean proteins, more vegetables). Update calories and macros. Add "Lower Calorie" to tags.';
    case 'quick_speed':
      return 'Remix for QUICK SPEED: simplify preparation steps and cooking techniques to reduce total prep + cook time. Add "Under 15 Mins" or similar to tags if applicable.';
    default:
      return 'Improve the recipe while keeping it practical.';
  }
}

function resolveHouseholdId(req) {
  const authHouseholdId = req.user?.household_id;
  if (!authHouseholdId) return null;

  const bodyHouseholdId = String(req.body?.householdId ?? '').trim();
  if (bodyHouseholdId && bodyHouseholdId !== String(authHouseholdId)) {
    const err = new Error('Household access denied.');
    err.status = 403;
    throw err;
  }

  return String(authHouseholdId);
}

export async function generateAILiveMatches(req, res) {
  const householdId = resolveHouseholdId(req);
  if (!householdId) {
    res.status(403).json({ error: 'Join or create a household to continue.' });
    return;
  }

  const cravings = String(req.body?.cravings ?? '').trim().slice(0, 120);
  const quickTag = String(req.body?.quickTag ?? '').trim().slice(0, 48);

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
  const filterInstructions = buildFilterInstructions({ cravings, quickTag });
  const ai = getGenAI();

  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: `Household inventory (only plentiful and expiring-soon items):\n\n${inventoryList}\n\nExisting recipe titles to avoid duplicating:\n${
      existingTitles.length
        ? existingTitles.map((title) => `- ${title}`).join('\n')
        : '- (none yet)'
    }${filterInstructions}\n\nCreate 3 new, original recipes using these items. Prioritize expiring-soon ingredients.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: RECIPE_RESPONSE_SCHEMA,
      temperature: 0.65,
    },
  });

  const generatedRecipes = parseAiRecipesResponse(response.text, allItems, expiringIds);
  const recipesToSave = generatedRecipes.map(stripPersistedMeta);

  await upsertHouseholdRecipes(householdId, recipesToSave);

  const combined = dedupeRecipesById([...matchedFromLibrary, ...generatedRecipes]);
  res.json({ recipes: combined });
}

export async function remixRecipe(req, res) {
  const householdId = resolveHouseholdId(req);
  if (!householdId) {
    res.status(403).json({ error: 'Join or create a household to continue.' });
    return;
  }

  const recipeId = String(req.body?.recipeId ?? '').trim();
  const mode = String(req.body?.mode ?? '').trim();

  if (!recipeId) {
    res.status(400).json({ error: 'recipeId is required.' });
    return;
  }

  if (!REMIX_MODES.has(mode)) {
    res.status(400).json({
      error: 'mode must be one of: higher_protein, lower_calorie, quick_speed.',
    });
    return;
  }

  const [allItems, householdMeta] = await Promise.all([
    getInventoryForHousehold(householdId),
    getHouseholdMeta(householdId),
  ]);

  const recipeLibrary = sanitizeRecipeLibrary(householdMeta?.recipeLibrary ?? []);
  let sourceRecipe = recipeLibrary.find((recipe) => recipe.id === recipeId);

  if (!sourceRecipe && req.body?.recipe) {
    const inlineRecipe = sanitizeRecipeEntry(req.body.recipe, { allowPartial: true });
    if (inlineRecipe && inlineRecipe.id === recipeId) {
      await upsertHouseholdRecipes(householdId, [inlineRecipe]);
      sourceRecipe = inlineRecipe;
    }
  }

  if (!sourceRecipe) {
    res.status(404).json({ error: 'Recipe not found in household library.' });
    return;
  }

  const expiringItems = findExpiringSoonItems(allItems, EXPIRY_ALERT_DAYS);
  const expiringIds = new Set(
    expiringItems.map((item) => String(item.id ?? item.name ?? '').trim()).filter(Boolean),
  );

  const inventoryList = formatInventoryForPrompt(
    allItems
      .filter((item) => !isOnShoppingList(item))
      .map((item) => {
        const id = String(item.id ?? item.name ?? '').trim();
        return {
          ...item,
          _matchStatus: expiringIds.has(id) ? 'ExpiringSoon' : 'Plentiful',
        };
      }),
  );

  const modeInstruction = getRemixModeInstruction(mode);
  const ai = getGenAI();

  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: `Original recipe to remix:\n${JSON.stringify(sourceRecipe, null, 2)}\n\nAvailable household inventory:\n${inventoryList}\n\nRemix mode: ${mode}\n${modeInstruction}\n\nPrefer on-hand inventory where possible. List any missing staples in missingIngredients.`,
    config: {
      systemInstruction: REMIX_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: REMIX_RESPONSE_SCHEMA,
      temperature: 0.55,
    },
  });

  const remixedRecipe = parseRemixResponse(response.text, allItems, expiringIds, recipeId);
  await upsertHouseholdRecipes(householdId, [stripPersistedMeta(remixedRecipe)]);

  res.json({ recipe: remixedRecipe });
}

const CHAT_SYSTEM_INSTRUCTION = `You are Pantry Chef, a friendly AI cooking assistant for Australian households.
Help users decide what to cook with their current fridge and pantry items.
Be practical, concise, and warm. Suggest recipes, substitutions, meal ideas, and ways to use expiring ingredients.
Use Australian English and common AU supermarket ingredient names.
Keep replies short: 2–4 sentences or brief bullet points unless the user asks for detail.
You may suggest a small shopping list only when staples are missing.
Do not claim to see inventory items that are not listed below.`;

function sanitizeChatMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m?.role === 'user' || m?.role === 'assistant')
    .map((m) => ({
      role: m.role,
      content: String(m.content ?? '').trim().slice(0, 2000),
    }))
    .filter((m) => m.content)
    .slice(-24);
}

export async function chatPantryChef(req, res) {
  const householdId = resolveHouseholdId(req);
  if (!householdId) {
    res.status(403).json({ error: 'Join or create a household to continue.' });
    return;
  }

  const messages = sanitizeChatMessages(req.body?.messages);
  if (!messages.length || messages.at(-1)?.role !== 'user') {
    res.status(400).json({ error: 'Send at least one user message.' });
    return;
  }

  const allItems = await getInventoryForHousehold(householdId);
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
    .filter(Boolean);

  const inventoryList = formatInventoryForPrompt(matchedItems);
  const ai = getGenAI();

  const contents = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents,
    config: {
      systemInstruction: `${CHAT_SYSTEM_INSTRUCTION}\n\nCurrent household inventory:\n${inventoryList}`,
      temperature: 0.7,
    },
  });

  const reply = String(response.text ?? '').trim();
  if (!reply) {
    const err = new Error('AI returned an empty response.');
    err.status = 502;
    throw err;
  }

  res.json({ reply });
}
