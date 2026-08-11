import { randomUUID } from 'node:crypto';
import { ITEM_TYPE, STATUS } from '../src/inventory/constants.js';
import { normalizeName } from '../src/inventory/itemUtils.js';
import {
  areUnitsCompatible,
  calculateExpiryDate,
  enrichInventoryFields,
  findInStockMatch,
  inferFoodGroup,
  inferStorageLocation,
  sanitizeQuantity,
  sumQuantities,
} from '../src/inventory/smartInventory.js';
import { buildConsumptionFields } from '../src/inventory/consumption.js';
import { normalizeAmbientQuantityFields } from '../src/inventory/quantityDisplay.js';

/**
 * @param {Record<string, unknown>} fields
 */
function withNormalizedQuantity(fields) {
  const { quantity, unit } = normalizeAmbientQuantityFields({
    name: String(fields.name ?? ''),
    itemType: fields.itemType,
    category: fields.category,
    storageLocation: fields.storageLocation,
    quantity: fields.quantity,
    unit: fields.unit,
  });
  return { ...fields, quantity, unit };
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @param {Record<string, unknown>} payload
 */
export function addShoppingListItem(items, payload) {
  const name = String(payload?.name ?? '').trim();
  if (!name) {
    const err = new Error('Item name is required.');
    err.status = 400;
    throw err;
  }

  const quantity = sanitizeQuantity(payload?.quantity ?? 1);
  const unit = String(payload?.unit ?? '').trim();
  const itemType = payload?.itemType === 'Household' || payload?.itemType === 'Baby'
    ? payload.itemType
    : ITEM_TYPE.FOOD;
  const category = payload?.category ?? null;
  const foodGroup = payload?.foodGroup ?? inferFoodGroup(name);
  const storageLocation = inferStorageLocation(category, foodGroup, payload?.storageLocation);
  const sourceRecipe = payload?.sourceRecipe ?? null;
  const warnings = [];

  const normalizedQty = normalizeAmbientQuantityFields({
    name,
    itemType,
    category,
    storageLocation,
    quantity,
    unit,
  });
  const normalizedQuantity = normalizedQty.quantity;
  const normalizedUnit = normalizedQty.unit;

  const stockCheck = findInStockMatch(items, name, normalizedQuantity);
  if (stockCheck?.sufficient) {
    warnings.push({ type: 'already_in_stock', message: stockCheck.message });
  } else if (stockCheck?.message) {
    warnings.push({ type: 'partial_stock', message: stockCheck.message });
  }

  const needle = normalizeName(name);
  const list = Array.isArray(items) ? [...items] : [];
  const existingIdx = list.findIndex(
    (entry) => normalizeName(entry.name) === needle && entry.status === STATUS.OUT,
  );

  if (existingIdx >= 0) {
    const existing = list[existingIdx];
    if (!areUnitsCompatible(existing.unit, normalizedUnit)) {
      warnings.push({
        type: 'unit_mismatch',
        message: `Could not merge quantities because units differ (${existing.unit || 'count'} vs ${normalizedUnit || 'count'}).`,
      });
      const id = randomUUID();
      list.push(
        withNormalizedQuantity({
          id,
          name,
          itemType,
          category: category ?? existing.category,
          status: STATUS.OUT,
          quantity: normalizedQuantity,
          unit: normalizedUnit,
          foodGroup,
          storageLocation,
          checked: false,
          sourceRecipe,
          expiryDate: null,
          ...buildConsumptionFields({ name, itemType, category: category ?? existing.category }),
          ...enrichInventoryFields({
            name,
            category: category ?? existing.category,
            foodGroup,
            storageLocation,
            quantity: normalizedQuantity,
            unit: normalizedUnit,
            checked: false,
            sourceRecipe,
          }),
        }),
      );
      return { items: list, item: list[list.length - 1], merged: false, warnings };
    }

    const mergedQuantity = sumQuantities(
      existing.unit,
      existing.quantity,
      normalizedUnit,
      normalizedQuantity,
    );
    const merged = withNormalizedQuantity({
      ...existing,
      quantity: mergedQuantity,
      unit: existing.unit || normalizedUnit,
      checked: false,
      sourceRecipe: sourceRecipe ?? existing.sourceRecipe ?? null,
      foodGroup: existing.foodGroup ?? foodGroup,
      storageLocation: existing.storageLocation ?? storageLocation,
    });
    list[existingIdx] = merged;
    return { items: list, item: merged, merged: true, warnings };
  }

  const consumption = buildConsumptionFields({
    name,
    itemType,
    category,
  });
  const id = randomUUID();
  const created = withNormalizedQuantity({
    id,
    name,
    itemType,
    category,
    status: STATUS.OUT,
    quantity: normalizedQuantity,
    unit: normalizedUnit,
    foodGroup,
    storageLocation,
    checked: false,
    sourceRecipe,
    expiryDate: null,
    ...consumption,
    ...enrichInventoryFields({
      name,
      category,
      foodGroup,
      storageLocation,
      quantity: normalizedQuantity,
      unit: normalizedUnit,
      checked: false,
      sourceRecipe,
    }),
  });
  list.push(created);
  return { items: list, item: created, merged: false, warnings };
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @param {{ recipe?: Record<string, unknown>, ingredients?: Array<Record<string, unknown>|string>, missingOnly?: boolean }} payload
 */
export function addRecipeIngredientsToShoppingList(items, payload) {
  const recipe = payload?.recipe ?? {};
  const recipeTitle = String(recipe.title || payload?.recipeTitle || '').trim();
  const sourceRecipe = recipeTitle
    ? { id: recipe.id ? String(recipe.id) : null, title: recipeTitle }
    : null;

  const rawIngredients = Array.isArray(payload?.ingredients)
    ? payload.ingredients
    : Array.isArray(recipe.ingredients)
      ? recipe.ingredients
      : [];

  const warnings = [];
  let nextItems = Array.isArray(items) ? [...items] : [];

  for (const entry of rawIngredients) {
    const name = typeof entry === 'string' ? entry : String(entry?.name ?? '').trim();
    if (!name) continue;

    const quantity = typeof entry === 'object' ? sanitizeQuantity(entry?.quantity ?? 1) : 1;
    const unit = typeof entry === 'object' ? String(entry?.unit ?? '').trim() : '';

    const result = addShoppingListItem(nextItems, {
      name,
      quantity,
      unit,
      itemType: ITEM_TYPE.FOOD,
      sourceRecipe,
    });
    nextItems = result.items;
    warnings.push(...result.warnings);
  }

  return { items: nextItems, warnings, addedCount: rawIngredients.length };
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @param {string} itemId
 * @param {{ applyExpiry?: boolean }} [options]
 */
export function markShoppingItemPurchased(items, itemId, options = {}) {
  const list = Array.isArray(items) ? [...items] : [];
  const idx = list.findIndex((entry) => String(entry.id) === String(itemId));
  if (idx < 0) {
    const err = new Error('Shopping list item not found.');
    err.status = 404;
    throw err;
  }

  const item = list[idx];
  if (item.status !== STATUS.OUT) {
    const err = new Error('Item is not on the shopping list.');
    err.status = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const enriched = enrichInventoryFields(item);
  const foodGroup = enriched.foodGroup;
  const storageLocation = enriched.storageLocation;
  const expiryDate =
    item.expiryDate ||
    (options.applyExpiry !== false && item.itemType === ITEM_TYPE.FOOD
      ? calculateExpiryDate(foodGroup, storageLocation)
      : null);

  const transferred = withNormalizedQuantity({
    ...item,
    ...enriched,
    status: STATUS.FRESH,
    checked: false,
    stockedAt: now,
    dateAdded: enriched.dateAdded || now,
    createdAt: now,
    expiryDate,
    sourceRecipe: null,
  });

  list[idx] = transferred;
  return { items: list, item: transferred };
}

/**
 * @param {Array<Record<string, unknown>>} items
 */
export function getShoppingListItems(items) {
  return (items ?? []).filter((entry) => entry.status === STATUS.OUT);
}
