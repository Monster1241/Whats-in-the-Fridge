import { FOOD_CATEGORY, ITEM_TYPE } from './constants.js';

/**
 * @param {unknown} value
 * @returns {number}
 */
function sanitizeQuantity(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.round(n * 100) / 100;
}

const COUNT_UNITS = new Set([
  '',
  'can',
  'cans',
  'tin',
  'tins',
  'pack',
  'packs',
  'packet',
  'packets',
  'item',
  'items',
  'piece',
  'pieces',
  'pc',
  'pcs',
  'each',
  'unit',
  'units',
  'x',
]);

const SIZE_IN_NAME_PATTERN =
  /(\d+(?:\.\d+)?)\s*(kg|g|gram|grams|gm|gms|ml|l|litre|liter|litres|liters)\b/gi;

/**
 * @param {{ itemType?: string, category?: string, storageLocation?: string }} item
 */
function isAmbientPantryItem(item) {
  if (item?.itemType !== ITEM_TYPE.FOOD) return false;
  if (item.category === FOOD_CATEGORY.AMBIENT) return true;
  return String(item.storageLocation ?? '').trim() === 'Pantry';
}

/**
 * @param {string} unit
 */
function normalizeMassVolumeUnit(unit) {
  const text = String(unit ?? '')
    .trim()
    .toLowerCase();
  if (text === 'kg' || text === 'kilogram' || text === 'kilograms') return 'kg';
  if (text === 'g' || text === 'gram' || text === 'grams' || text === 'gm' || text === 'gms') {
    return 'g';
  }
  if (text === 'l' || text === 'liter' || text === 'litre' || text === 'liters' || text === 'litres') {
    return 'l';
  }
  if (text === 'ml' || text === 'milliliter' || text === 'millilitre') return 'ml';
  return '';
}

/**
 * @param {string} unit
 */
function isCountUnit(unit) {
  return COUNT_UNITS.has(String(unit ?? '').trim().toLowerCase());
}

/**
 * @param {string} unit
 */
function isMassVolumeUnit(unit) {
  return Boolean(normalizeMassVolumeUnit(unit));
}

/**
 * @param {string} name
 * @returns {{ amount: number, unit: 'g'|'kg'|'ml'|'l' }|null}
 */
export function parsePackSizeFromName(name) {
  const text = String(name ?? '');
  if (!text) return null;

  const matches = [...text.matchAll(SIZE_IN_NAME_PATTERN)];
  if (!matches.length) return null;

  const last = matches[matches.length - 1];
  const amount = Number(last[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = normalizeMassVolumeUnit(last[2]);
  if (!unit) return null;

  return { amount, unit };
}

/**
 * @param {number} amount
 * @param {'g'|'kg'|'ml'|'l'} unit
 */
function toBaseAmount(amount, unit) {
  if (unit === 'kg') return { value: amount * 1000, displayUnit: 'g' };
  if (unit === 'g') return { value: amount, displayUnit: 'g' };
  if (unit === 'l') return { value: amount * 1000, displayUnit: 'ml' };
  if (unit === 'ml') return { value: amount, displayUnit: 'ml' };
  return null;
}

/**
 * @param {number} value
 * @param {'g'|'ml'} displayUnit
 */
function formatBaseAmount(value, displayUnit) {
  const rounded = Math.round(value * 10) / 10;
  if (displayUnit === 'g') {
    if (rounded >= 1000 && rounded % 1000 === 0) return `${rounded / 1000}kg`;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}g`;
  }
  if (rounded >= 1000 && rounded % 1000 === 0) return `${rounded / 1000}L`;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}ml`;
}

/**
 * @param {number} quantity
 * @param {string} unit
 */
function formatMassVolumeTotal(quantity, unit) {
  const normalized = normalizeMassVolumeUnit(unit);
  const qty = sanitizeQuantity(quantity);
  if (!normalized) return null;

  if (normalized === 'g') {
    return `${formatBaseAmount(qty, 'g')} total`;
  }
  if (normalized === 'kg') {
    return `${formatBaseAmount(qty * 1000, 'g')} total`;
  }
  if (normalized === 'ml') {
    return `${formatBaseAmount(qty, 'ml')} total`;
  }
  if (normalized === 'l') {
    return `${formatBaseAmount(qty * 1000, 'ml')} total`;
  }
  return null;
}

/**
 * @param {{ name?: string, itemType?: string, category?: string, storageLocation?: string, quantity?: number, unit?: string }} item
 * @returns {string|null}
 */
export function formatInventoryQuantityLabel(item) {
  if (!item) return null;

  const qty = sanitizeQuantity(item.quantity ?? 1);
  const unit = String(item.unit ?? '').trim();
  const unitLower = unit.toLowerCase();

  if (isAmbientPantryItem(item)) {
    if (isMassVolumeUnit(unitLower)) {
      return formatMassVolumeTotal(qty, unitLower);
    }

    const packSize = parsePackSizeFromName(item.name);
    if (packSize && (isCountUnit(unitLower) || !unitLower)) {
      const base = toBaseAmount(packSize.amount, packSize.unit);
      if (base) {
        return `${formatBaseAmount(base.value * qty, base.displayUnit)} total`;
      }
    }
  }

  if (qty !== 1 || unit) {
    return qty !== 1 ? `${qty}${unit ? ` ${unit}` : ''}` : unit;
  }
  return null;
}

/**
 * Normalize ambient pantry quantities to total base units for storage consistency.
 * @param {{ name: string, itemType?: string, category?: string, storageLocation?: string, quantity?: number, unit?: string }} item
 */
export function normalizeAmbientQuantityFields(item) {
  if (!isAmbientPantryItem(item)) {
    return { quantity: sanitizeQuantity(item.quantity), unit: String(item.unit ?? '').trim() };
  }

  const qty = sanitizeQuantity(item.quantity ?? 1);
  const unit = String(item.unit ?? '').trim();
  const unitLower = unit.toLowerCase();

  if (isMassVolumeUnit(unitLower)) {
    const normalized = normalizeMassVolumeUnit(unitLower);
    if (normalized === 'kg') {
      return { quantity: qty * 1000, unit: 'g' };
    }
    if (normalized === 'l') {
      return { quantity: qty * 1000, unit: 'ml' };
    }
    return { quantity: qty, unit: normalized };
  }

  const packSize = parsePackSizeFromName(item.name);
  if (packSize && (isCountUnit(unitLower) || !unitLower)) {
    const base = toBaseAmount(packSize.amount, packSize.unit);
    if (base) {
      return {
        quantity: Math.round(base.value * qty * 10) / 10,
        unit: base.displayUnit,
      };
    }
  }

  return { quantity: qty, unit: unit };
}
