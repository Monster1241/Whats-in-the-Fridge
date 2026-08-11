import { GoogleGenAI, Type } from '@google/genai';
import {
  BABY_CATEGORY,
  FOOD_CATEGORY,
  FOOD_CATEGORY_OPTIONS,
  HOUSEHOLD_CATEGORY,
  ITEM_TYPE,
} from '../../src/inventory/constants.js';
import { classifyItem } from '../../src/inventory/classifyItem.js';
import { getDefaultConsumptionDuration } from '../../src/inventory/consumption.js';
import {
  applyItemKnowledgeToIntake,
  findItemKnowledge,
  upsertItemKnowledge,
} from '../../src/inventory/itemKnowledge.js';
import { recordUsageInsightEvent } from '../../src/inventory/usageInsights.js';
import { resolveSubCategory } from '../../src/inventory/subcategories.js';
import { STORAGE_LOCATION } from '../../src/inventory/smartInventory.js';
import { getHouseholdMeta, updateHouseholdAppState } from '../db.js';

const MODEL_ID = process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite';

const CLASSIFY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    itemType: { type: Type.STRING },
    category: { type: Type.STRING },
    subCategory: { type: Type.STRING },
    storageLocation: { type: Type.STRING },
    consumptionDurationDays: { type: Type.NUMBER },
    expiryDays: { type: Type.NUMBER },
    confidence: { type: Type.NUMBER },
  },
  required: [
    'itemType',
    'category',
    'subCategory',
    'storageLocation',
    'consumptionDurationDays',
    'confidence',
  ],
};

const CLASSIFY_INSTRUCTION = `You classify grocery and household items for Australian home inventory apps.
Given a product name, return JSON with:
- itemType: Food, Household, or Baby
- category: for Food use Fresh, Ambient, or Freezer; for Household use Cleaning, Laundry, or Bathroom; for Baby use Diapers, Food, or Essentials
- subCategory: a short shelf group like Dairy, Meat & Seafood, Pantry Staples, or Other
- storageLocation: Fridge, Freezer, or Pantry
- consumptionDurationDays: typical days until a household runs out (1-365)
- expiryDays: optional chilled/frozen shelf life estimate for food (omit if ambient long-life)
- confidence: 0.0 to 1.0

Use Australian household norms. Return strict JSON only.`;

let genaiClient;

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('Smart item learning is not configured (missing GEMINI_API_KEY).');
    err.status = 503;
    throw err;
  }
  if (!genaiClient) {
    genaiClient = new GoogleGenAI({ apiKey });
  }
  return genaiClient;
}

function normalizeItemType(value) {
  const text = String(value ?? '').trim();
  if (text === ITEM_TYPE.HOUSEHOLD) return ITEM_TYPE.HOUSEHOLD;
  if (text === ITEM_TYPE.BABY) return ITEM_TYPE.BABY;
  return ITEM_TYPE.FOOD;
}

function normalizeFoodCategory(value) {
  const text = String(value ?? '').trim();
  if (FOOD_CATEGORY_OPTIONS.includes(text)) return text;
  if (/freezer/i.test(text)) return FOOD_CATEGORY.FREEZER;
  if (/ambient|pantry/i.test(text)) return FOOD_CATEGORY.AMBIENT;
  return FOOD_CATEGORY.FRESH;
}

function normalizeHouseholdCategory(value) {
  const text = String(value ?? '').trim();
  if (Object.values(HOUSEHOLD_CATEGORY).includes(text)) return text;
  if (/laundry/i.test(text)) return HOUSEHOLD_CATEGORY.LAUNDRY;
  if (/bathroom|toilet/i.test(text)) return HOUSEHOLD_CATEGORY.BATHROOM;
  return HOUSEHOLD_CATEGORY.CLEANING;
}

function normalizeBabyCategory(value) {
  const text = String(value ?? '').trim();
  if (Object.values(BABY_CATEGORY).includes(text)) return text;
  if (/napp|diaper/i.test(text)) return BABY_CATEGORY.DIAPERS;
  if (/food|formula/i.test(text)) return BABY_CATEGORY.FOOD;
  return BABY_CATEGORY.ESSENTIALS;
}

function normalizeCategory(itemType, value) {
  if (itemType === ITEM_TYPE.HOUSEHOLD) return normalizeHouseholdCategory(value);
  if (itemType === ITEM_TYPE.BABY) return normalizeBabyCategory(value);
  return normalizeFoodCategory(value);
}

function normalizeStorageLocation(value, category, itemType) {
  const text = String(value ?? '').trim();
  if (text === STORAGE_LOCATION.FRIDGE) return STORAGE_LOCATION.FRIDGE;
  if (text === STORAGE_LOCATION.FREEZER) return STORAGE_LOCATION.FREEZER;
  if (text === STORAGE_LOCATION.PANTRY) return STORAGE_LOCATION.PANTRY;
  if (itemType !== ITEM_TYPE.FOOD) return STORAGE_LOCATION.PANTRY;
  if (category === FOOD_CATEGORY.FREEZER) return STORAGE_LOCATION.FREEZER;
  if (category === FOOD_CATEGORY.FRESH) return STORAGE_LOCATION.FRIDGE;
  return STORAGE_LOCATION.PANTRY;
}

function normalizeAiClassification(name, raw, preferredItemType) {
  const itemType = preferredItemType
    ? normalizeItemType(preferredItemType)
    : normalizeItemType(raw?.itemType);
  const category = normalizeCategory(itemType, raw?.category);
  const subCategory =
    String(raw?.subCategory ?? '').trim() ||
    resolveSubCategory(name, itemType, category);
  const storageLocation = normalizeStorageLocation(raw?.storageLocation, category, itemType);
  const defaultDays = getDefaultConsumptionDuration(name, itemType, category);
  const consumptionDurationDays = Math.max(
    1,
    Math.min(
      365,
      Math.round(Number(raw?.consumptionDurationDays) || defaultDays),
    ),
  );
  const confidence = Math.max(0, Math.min(1, Number(raw?.confidence) || 0.6));

  return {
    name,
    itemType,
    category,
    subCategory,
    storageLocation,
    consumptionDurationDays,
    expiryDays:
      typeof raw?.expiryDays === 'number' && raw.expiryDays > 0
        ? Math.min(365, Math.round(raw.expiryDays))
        : null,
    confidence,
    source: 'ai',
  };
}

function classificationFromRules(name, preferredItemType) {
  const rules = classifyItem(name);
  if (!rules) return null;

  const itemType = preferredItemType ? normalizeItemType(preferredItemType) : rules.itemType;
  const category = normalizeCategory(itemType, rules.category);
  return {
    name,
    itemType,
    category,
    subCategory: rules.subCategory,
    storageLocation: normalizeStorageLocation(null, category, itemType),
    consumptionDurationDays: getDefaultConsumptionDuration(name, itemType, category),
    expiryDays: null,
    confidence: 0.75,
    source: 'rules',
  };
}

/**
 * @param {string} name
 * @param {{ itemType?: string, itemKnowledge?: import('../../src/inventory/itemKnowledge.js').ItemKnowledgeEntry[], persist?: boolean, householdId?: string }} [options]
 */
export async function classifyItemIntelligently(name, options = {}) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) {
    const err = new Error('Item name is required.');
    err.status = 400;
    throw err;
  }

  const preferredItemType = options.itemType
    ? normalizeItemType(options.itemType)
    : ITEM_TYPE.FOOD;
  const knowledge = options.itemKnowledge ?? [];

  const remembered = applyItemKnowledgeToIntake(knowledge, {
    name: trimmed,
    itemType: preferredItemType,
  });
  if (remembered) {
    return {
      ...remembered,
      name: trimmed,
      expiryDays: null,
      confidence: remembered.source === 'user' ? 0.95 : 0.85,
      source: remembered.source === 'user' ? 'memory' : 'memory',
      persisted: false,
    };
  }

  const rules = classificationFromRules(trimmed, preferredItemType);
  if (rules && rules.confidence >= 0.75) {
    return { ...rules, persisted: false };
  }

  const ai = getGenAI();
  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: [
      {
        role: 'user',
        parts: [{ text: `Classify this household product for inventory: "${trimmed}"` }],
      },
    ],
    config: {
      systemInstruction: CLASSIFY_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: CLASSIFY_SCHEMA,
      temperature: 0.2,
    },
  });

  const parsed = JSON.parse(String(response.text ?? '{}'));
  const classified = normalizeAiClassification(trimmed, parsed, preferredItemType);

  let persisted = false;
  let nextKnowledge = knowledge;
  let nextInsights = null;

  if (options.persist && options.householdId) {
    nextKnowledge = upsertItemKnowledge(knowledge, classified, 'ai');
    const meta = await getHouseholdMeta(options.householdId);
    nextInsights = recordUsageInsightEvent(meta?.usageInsights, 'itemAiClassified');
    await updateHouseholdAppState(options.householdId, {
      itemKnowledge: nextKnowledge,
      usageInsights: nextInsights,
    });
    persisted = true;
  }

  return {
    ...classified,
    itemKnowledge: nextKnowledge,
    usageInsights: nextInsights,
    persisted,
  };
}

export async function handleClassifyItem(req, res) {
  const householdId = req.user?.household_id;
  if (!householdId) {
    res.status(403).json({ error: 'Join or create a household to continue.' });
    return;
  }

  const name = String(req.body?.name ?? '').trim();
  if (!name) {
    res.status(400).json({ error: 'Item name is required.' });
    return;
  }

  const meta = await getHouseholdMeta(householdId);
  const result = await classifyItemIntelligently(name, {
    itemType: req.body?.itemType,
    itemKnowledge: meta?.itemKnowledge ?? [],
    persist: req.body?.remember !== false,
    householdId,
  });

  res.status(200).json(result);
}

export async function handleRecordUsageInsight(req, res) {
  const householdId = req.user?.household_id;
  if (!householdId) {
    res.status(403).json({ error: 'Join or create a household to continue.' });
    return;
  }

  const event = String(req.body?.event ?? '').trim();
  const amount = Number(req.body?.amount ?? 1);
  const meta = await getHouseholdMeta(householdId);
  const usageInsights = recordUsageInsightEvent(meta?.usageInsights, event, amount);

  await updateHouseholdAppState(householdId, { usageInsights });
  res.status(200).json({ usageInsights });
}
