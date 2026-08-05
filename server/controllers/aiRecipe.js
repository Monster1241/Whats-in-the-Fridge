import { GoogleGenAI, Type } from '@google/genai';
import { getInventoryForHousehold } from '../db.js';
import { EXPIRY_ALERT_DAYS, findExpiringSoonItems } from '../expiryAlerts.js';
import { toFriendlyGeminiError } from '../errors.js';

const MODEL_ID = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';

const RECIPE_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      recipeName: { type: Type.STRING },
      matchingInventoryCount: { type: Type.INTEGER },
      expiringItemsUsed: { type: Type.ARRAY, items: { type: Type.STRING } },
      missingIngredients: { type: Type.ARRAY, items: { type: Type.STRING } },
      briefDescription: { type: Type.STRING },
    },
    required: [
      'recipeName',
      'matchingInventoryCount',
      'expiringItemsUsed',
      'missingIngredients',
      'briefDescription',
    ],
    propertyOrdering: [
      'recipeName',
      'matchingInventoryCount',
      'expiringItemsUsed',
      'missingIngredients',
      'briefDescription',
    ],
  },
};

const SYSTEM_INSTRUCTION = `You are a practical home-cooking assistant for Australian households.
Given a list of in-stock pantry and fridge items, suggest exactly 3 realistic recipes a family could cook this week.
Prioritize using items marked EXPIRING SOON to reduce food waste.
Each recipe must be achievable with mostly on-hand ingredients; list only genuinely missing staples in missingIngredients.
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

function parseRecipesResponse(text) {
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

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const err = new Error('AI returned invalid JSON.');
    err.status = 502;
    throw err;
  }

  if (!Array.isArray(parsed)) {
    const err = new Error('AI response was not a recipe array.');
    err.status = 502;
    throw err;
  }

  const recipes = parsed.slice(0, 3).map((entry, index) => {
    const recipeName = String(entry?.recipeName ?? '').trim();
    const briefDescription = String(entry?.briefDescription ?? '').trim();
    const matchingInventoryCount = Number(entry?.matchingInventoryCount);
    const expiringItemsUsed = Array.isArray(entry?.expiringItemsUsed)
      ? entry.expiringItemsUsed.map((v) => String(v).trim()).filter(Boolean)
      : [];
    const missingIngredients = Array.isArray(entry?.missingIngredients)
      ? entry.missingIngredients.map((v) => String(v).trim()).filter(Boolean)
      : [];

    if (!recipeName || !briefDescription || !Number.isFinite(matchingInventoryCount)) {
      const err = new Error(`AI recipe at index ${index} is missing required fields.`);
      err.status = 502;
      throw err;
    }

    return {
      recipeName,
      matchingInventoryCount: Math.max(0, Math.round(matchingInventoryCount)),
      expiringItemsUsed,
      missingIngredients,
      briefDescription,
    };
  });

  if (recipes.length === 0) {
    const err = new Error('AI did not return any recipes.');
    err.status = 502;
    throw err;
  }

  return recipes;
}

export async function generateAILiveMatches(req, res) {
  const householdId = req.user?.household_id;
  if (!householdId) {
    res.status(403).json({ error: 'Join or create a household to continue.' });
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
    .filter(Boolean)
    .filter((item) => item._matchStatus === 'Plentiful' || item._matchStatus === 'ExpiringSoon');

  const inventoryList = formatInventoryForPrompt(matchedItems);
  const ai = getGenAI();

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: `Household inventory (only plentiful and expiring-soon items):\n\n${inventoryList}\n\nSuggest 3 practical recipes using these items. Prioritize expiring-soon ingredients.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: RECIPE_RESPONSE_SCHEMA,
        temperature: 0.6,
      },
    });
  } catch (err) {
    console.error('POST /api/recipes/ai-match Gemini error:', err);
    throw toFriendlyGeminiError(err);
  }

  const recipes = parseRecipesResponse(response.text);
  res.json({ recipes });
}
