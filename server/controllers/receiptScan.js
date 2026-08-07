import { randomUUID } from 'node:crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { FOOD_CATEGORY, FOOD_CATEGORY_OPTIONS, ITEM_TYPE, STATUS } from '../../src/inventory/constants.js';
import { buildConsumptionFields } from '../../src/inventory/consumption.js';
import {
  calculateExpiryDate,
  FOOD_GROUP,
  sanitizeQuantity,
  STORAGE_LOCATION,
} from '../../src/inventory/smartInventory.js';
import { getInventoryForHousehold, saveInventoryItems } from '../db.js';
import { sanitizeInventoryItems } from '../inventorySanitize.js';

const RECEIPT_MODEL = process.env.RECEIPT_SCAN_MODEL?.trim() || 'gemini-2.0-flash';
const MAX_RECEIPT_ITEMS = 80;

const RECEIPT_CATEGORIES = new Set([
  'Produce',
  'Dairy',
  'Meat',
  'Pantry',
  'Bakery',
  'Frozen',
  'Beverage',
  'Other',
]);

const RECEIPT_ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    quantity: { type: Type.NUMBER },
    unit: { type: Type.STRING },
    category: { type: Type.STRING },
    storageLocation: { type: Type.STRING },
  },
  required: ['name', 'quantity', 'unit', 'category', 'storageLocation'],
};

const RECEIPT_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: RECEIPT_ITEM_SCHEMA,
};

const RECEIPT_INSTRUCTION = `Analyze this receipt or invoice image/PDF. Extract all purchased grocery and food items only.
Skip non-food lines (bags, discounts, loyalty, tax, subtotal, payment method, store branding).
Normalize abbreviated merchant product names into plain, clean household item names (e.g. "CHKN BRST 500G" -> "Chicken Breast", "APPL GALA 1KG" -> "Gala Apples").
Extract clean quantities and units (grams, g, kg, ml, L, packs, liters, or unit counts).
Categorize each item into exactly one of: Produce, Dairy, Meat, Pantry, Bakery, Frozen, Beverage, Other.
Set storageLocation to Fridge, Freezer, or Pantry using:
- Meat and Dairy -> Fridge (unless clearly frozen)
- Frozen category -> Freezer
- Pantry, Bakery, Beverage -> Pantry
- Produce -> Fridge by default (Pantry only for shelf-stable produce like onions/potatoes if obvious)
Return strict JSON only — an array of items, no markdown.`;

let genaiClient;

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('Receipt scanning is not configured (missing GEMINI_API_KEY).');
    err.status = 503;
    throw err;
  }
  if (!genaiClient) {
    genaiClient = new GoogleGenAI({ apiKey });
  }
  return genaiClient;
}

function normalizeReceiptCategory(value) {
  const text = String(value ?? '').trim();
  if (!text) return 'Other';
  const match = [...RECEIPT_CATEGORIES].find(
    (entry) => entry.toLowerCase() === text.toLowerCase(),
  );
  return match ?? 'Other';
}

function normalizeStorageLocation(value, category) {
  const text = String(value ?? '').trim();
  if (text === STORAGE_LOCATION.FRIDGE) return STORAGE_LOCATION.FRIDGE;
  if (text === STORAGE_LOCATION.FREEZER) return STORAGE_LOCATION.FREEZER;
  if (text === STORAGE_LOCATION.PANTRY) return STORAGE_LOCATION.PANTRY;

  switch (normalizeReceiptCategory(category)) {
    case 'Meat':
    case 'Dairy':
      return STORAGE_LOCATION.FRIDGE;
    case 'Frozen':
      return STORAGE_LOCATION.FREEZER;
    case 'Pantry':
    case 'Bakery':
    case 'Beverage':
      return STORAGE_LOCATION.PANTRY;
    case 'Produce':
      return STORAGE_LOCATION.FRIDGE;
    default:
      return STORAGE_LOCATION.PANTRY;
  }
}

function mapReceiptCategoryToFoodGroup(category) {
  switch (normalizeReceiptCategory(category)) {
    case 'Produce':
      return FOOD_GROUP.PRODUCE;
    case 'Dairy':
      return FOOD_GROUP.DAIRY;
    case 'Meat':
      return FOOD_GROUP.MEAT;
    case 'Pantry':
      return FOOD_GROUP.PANTRY;
    case 'Bakery':
      return FOOD_GROUP.BAKERY;
    case 'Beverage':
      return FOOD_GROUP.PANTRY;
    case 'Frozen':
      return FOOD_GROUP.OTHER;
    default:
      return FOOD_GROUP.OTHER;
  }
}

function mapStorageToFoodCategory(storageLocation) {
  if (storageLocation === STORAGE_LOCATION.FREEZER) return FOOD_CATEGORY.FREEZER;
  if (storageLocation === STORAGE_LOCATION.FRIDGE) return FOOD_CATEGORY.FRESH;
  return FOOD_CATEGORY.AMBIENT;
}

function parseReceiptResponse(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (!fenced) throw new Error('Could not parse receipt scan response.');
    parsed = JSON.parse(fenced[1].trim());
  }

  const list = Array.isArray(parsed) ? parsed : parsed?.items;
  if (!Array.isArray(list)) {
    throw new Error('Receipt scan returned an unexpected format.');
  }
  return list;
}

function enrichScannedItem(entry) {
  const name = String(entry?.name ?? '').trim();
  if (!name) return null;

  const category = normalizeReceiptCategory(entry.category);
  const storageLocation = normalizeStorageLocation(entry.storageLocation, category);
  const foodGroup = mapReceiptCategoryToFoodGroup(category);
  const expiryDate = calculateExpiryDate(foodGroup, storageLocation);

  return {
    name,
    quantity: sanitizeQuantity(entry.quantity),
    unit: String(entry.unit ?? '').trim(),
    category,
    storageLocation,
    foodGroup,
    inventoryCategory: mapStorageToFoodCategory(storageLocation),
    expiryDate,
  };
}

/**
 * @param {{ buffer: Buffer, mimetype: string }} file
 */
export async function scanReceiptFile(file) {
  if (!file?.buffer?.length) {
    const err = new Error('Receipt file is required.');
    err.status = 400;
    throw err;
  }

  const ai = getGenAI();
  const base64 = file.buffer.toString('base64');

  const response = await ai.models.generateContent({
    model: RECEIPT_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: file.mimetype,
              data: base64,
            },
          },
          { text: RECEIPT_INSTRUCTION },
        ],
      },
    ],
    config: {
      systemInstruction:
        'You are a precise grocery receipt OCR assistant for Australian households. Return only valid JSON matching the schema.',
      responseMimeType: 'application/json',
      responseSchema: RECEIPT_RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  });

  const parsed = parseReceiptResponse(response.text);
  const items = parsed
    .map(enrichScannedItem)
    .filter(Boolean)
    .slice(0, MAX_RECEIPT_ITEMS);

  if (!items.length) {
    const err = new Error('No grocery items were found on this receipt. Try a clearer photo or PDF.');
    err.status = 422;
    throw err;
  }

  return { items, model: RECEIPT_MODEL };
}

/**
 * @param {string} householdId
 * @param {Array<Record<string, unknown>>} scannedItems
 */
export async function confirmReceiptItems(householdId, scannedItems) {
  if (!Array.isArray(scannedItems) || scannedItems.length === 0) {
    const err = new Error('At least one item is required to confirm.');
    err.status = 400;
    throw err;
  }

  const existing = await getInventoryForHousehold(householdId);
  const now = new Date().toISOString();
  const drafts = [];

  for (const entry of scannedItems.slice(0, MAX_RECEIPT_ITEMS)) {
    const name = String(entry?.name ?? '').trim();
    if (!name) continue;

    const category = normalizeReceiptCategory(entry.category);
    const storageLocation = normalizeStorageLocation(
      entry.storageLocation ?? entry.storage,
      category,
    );
    const foodGroup = mapReceiptCategoryToFoodGroup(category);
    const inventoryCategory = FOOD_CATEGORY_OPTIONS.includes(entry.inventoryCategory)
      ? entry.inventoryCategory
      : mapStorageToFoodCategory(storageLocation);
    const expiryDate =
      entry.expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(String(entry.expiryDate))
        ? String(entry.expiryDate)
        : calculateExpiryDate(foodGroup, storageLocation);

    const consumption = buildConsumptionFields({
      name,
      itemType: ITEM_TYPE.FOOD,
      category: inventoryCategory,
    });

    drafts.push({
      id: randomUUID(),
      name,
      itemType: ITEM_TYPE.FOOD,
      category: inventoryCategory,
      status: STATUS.FRESH,
      quantity: sanitizeQuantity(entry.quantity),
      unit: String(entry.unit ?? '').trim(),
      foodGroup,
      storageLocation,
      expiryDate,
      dateAdded: now,
      stockedAt: now,
      createdAt: now,
      isLow: false,
      checked: false,
      sourceRecipe: null,
      ...consumption,
    });
  }

  if (!drafts.length) {
    const err = new Error('No valid items to add.');
    err.status = 400;
    throw err;
  }

  const saved = await saveInventoryItems(
    householdId,
    sanitizeInventoryItems([...existing, ...drafts]),
  );

  const addedIds = new Set(drafts.map((item) => item.id));
  const added = saved.filter((item) => addedIds.has(item.id));

  return {
    items: saved,
    added,
    addedCount: added.length,
  };
}

export async function handleScanReceipt(req, res) {
  if (!req.file) {
    res.status(400).json({ error: 'Upload a receipt image or PDF using the "receipt" field.' });
    return;
  }

  const result = await scanReceiptFile({
    buffer: req.file.buffer,
    mimetype: req.file.mimetype,
  });

  res.status(200).json(result);
}

export async function handleConfirmReceiptScan(req, res) {
  const householdId = req.user?.household_id;
  if (!householdId) {
    res.status(403).json({ error: 'Join or create a household to continue.' });
    return;
  }

  const result = await confirmReceiptItems(householdId, req.body?.items);
  res.status(201).json(result);
}
