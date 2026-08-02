import { defaultCategoryForItemType, ITEM_TYPE } from './constants.js';
import { guessExpiryForItem } from './expiryGuess.js';
import {
  mapOpenFactsProduct,
  pickBestOpenFactsProduct,
} from './openFoodFactsMap.js';

/** Required by Open Food Facts API terms of use. */
export const OPEN_FACTS_USER_AGENT =
  'WhatsInTheFridge/1.0 - Web - HouseholdInventory (contact: household-app)';

const OFF_ENDPOINTS = {
  au: 'https://au.openfoodfacts.org/api/v2/product',
  world: 'https://world.openfoodfacts.org/api/v2/product',
};

const OPF_ENDPOINTS = {
  au: 'https://au.openproductsfacts.org/api/v2/product',
  world: 'https://world.openproductsfacts.org/api/v2/product',
};

const lookupCache = new Map();
const CACHE_MAX = 80;

/**
 * @typedef {{
 *   name: string,
 *   itemType: string,
 *   category: string,
 *   subCategory?: string,
 *   brand?: string|null,
 *   barcode?: string,
 *   suggestedExpiryDate?: string|null,
 *   expiryHint?: string|null,
 *   expirySource?: 'product'|'estimated'|null,
 *   isAustralian?: boolean,
 *   lookupSource?: string,
 * }} BarcodeLookupResult
 */

/**
 * @param {string} baseUrl
 * @param {string} barcode
 * @returns {Promise<{ status: number, product?: Record<string, unknown> }|null>}
 */
async function fetchOpenFactsProduct(baseUrl, barcode) {
  const url = `${baseUrl}/${encodeURIComponent(barcode)}.json`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': OPEN_FACTS_USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function rememberCache(key, value) {
  if (lookupCache.size >= CACHE_MAX) {
    const first = lookupCache.keys().next().value;
    lookupCache.delete(first);
  }
  lookupCache.set(key, value);
}

function finalizeLookupResult(mapped, barcode) {
  const expiry = guessExpiryForItem(
    {
      name: mapped.name,
      itemType: mapped.itemType,
      category: mapped.category,
      subCategory: mapped.subCategory,
    },
    { productExpiry: mapped.productExpiry },
  );

  return {
    name: mapped.name,
    itemType: mapped.itemType,
    category: mapped.category,
    subCategory: mapped.subCategory,
    brand: mapped.brand,
    barcode,
    suggestedExpiryDate: expiry.expiryDate,
    expiryHint: expiry.label,
    expirySource: expiry.source,
    isAustralian: mapped.isAustralian,
    lookupSource: mapped.source,
  };
}

/**
 * Look up a barcode — AU Open Food/Products Facts first, then global databases.
 * @param {string} barcode
 * @returns {Promise<BarcodeLookupResult|null>}
 */
export async function lookupBarcode(barcode) {
  const code = String(barcode ?? '').trim().replace(/\D/g, '');
  if (code.length < 8) return null;

  const cached = lookupCache.get(code);
  if (cached) return cached;

  const [auFood, worldFood, auHousehold, worldHousehold] = await Promise.all([
    fetchOpenFactsProduct(OFF_ENDPOINTS.au, code),
    fetchOpenFactsProduct(OFF_ENDPOINTS.world, code),
    fetchOpenFactsProduct(OPF_ENDPOINTS.au, code),
    fetchOpenFactsProduct(OPF_ENDPOINTS.world, code),
  ]);

  const foodPick = pickBestOpenFactsProduct([
    { payload: auFood, region: 'au' },
    { payload: worldFood, region: 'world' },
  ]);

  if (foodPick?.product) {
    const mapped = mapOpenFactsProduct(foodPick.product, 'food');
    if (mapped) {
      const result = finalizeLookupResult(
        { ...mapped, source: `openfoodfacts-${foodPick.region}` },
        code,
      );
      rememberCache(code, result);
      return result;
    }
  }

  const householdPick = pickBestOpenFactsProduct([
    { payload: auHousehold, region: 'au' },
    { payload: worldHousehold, region: 'world' },
  ]);

  if (householdPick?.product) {
    const mapped = mapOpenFactsProduct(householdPick.product, 'household');
    if (mapped) {
      const result = finalizeLookupResult(
        { ...mapped, source: `openproductsfacts-${householdPick.region}` },
        code,
      );
      rememberCache(code, result);
      return result;
    }
  }

  rememberCache(code, null);
  return null;
}

/** Short vibration when barcode is unknown (mobile browsers). */
export function vibrateBarcodeUnknown() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([35, 40, 35]);
  }
}

export function vibrateBarcodeSuccess() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(20);
  }
}

export const BARCODE_UNKNOWN_PLACEHOLDER =
  'Not in database — type the product name';

export const BARCODE_LOOKUP_LOADING_TEXT = 'Looking up product…';
