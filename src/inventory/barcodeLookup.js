import { defaultCategoryForItemType, ITEM_TYPE } from './constants.js';
import { resolveIntakeCategory } from './classifyItem.js';

/** Required by Open Food Facts API terms of use. */
export const OPEN_FACTS_USER_AGENT =
  'WhatsInTheFridge/1.0 - Web - HouseholdInventory';

const OPEN_FOOD_FACTS_PRODUCT_URL =
  'https://world.openfoodfacts.org/api/v2/product';
const OPEN_PRODUCTS_FACTS_PRODUCT_URL =
  'https://world.openproductsfacts.org/api/v2/product';

/**
 * @param {Record<string, unknown>|undefined} product
 * @returns {string|null}
 */
function extractProductName(product) {
  if (!product || typeof product !== 'object') return null;
  const candidates = [
    product.product_name,
    product.product_name_en,
    product.generic_name,
    product.generic_name_en,
    product.abbreviated_product_name,
  ];
  for (const value of candidates) {
    const name = String(value ?? '').trim();
    if (name) return name;
  }
  return null;
}

/**
 * @param {string} baseUrl
 * @param {string} barcode
 * @returns {Promise<{ status: number, product?: Record<string, unknown> }|null>}
 */
async function fetchOpenFactsProduct(baseUrl, barcode) {
  const url = `${baseUrl}/${encodeURIComponent(barcode)}.json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': OPEN_FACTS_USER_AGENT },
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * @typedef {{ name: string, itemType: string, category: string }} BarcodeLookupResult
 */

/**
 * Look up a barcode in Open Food Facts, then Open Products Facts.
 * @param {string} barcode
 * @returns {Promise<BarcodeLookupResult|null>}
 */
export async function lookupBarcode(barcode) {
  const code = String(barcode ?? '').trim();
  if (!code) return null;

  const foodPayload = await fetchOpenFactsProduct(OPEN_FOOD_FACTS_PRODUCT_URL, code);
  if (foodPayload?.status === 1 && foodPayload.product) {
    const name = extractProductName(foodPayload.product);
    if (name) {
      const intake = resolveIntakeCategory(name, {
        itemType: ITEM_TYPE.FOOD,
        category: defaultCategoryForItemType(ITEM_TYPE.FOOD),
      });
      return {
        name,
        itemType: intake.itemType,
        category: intake.category,
      };
    }
  }

  const householdPayload = await fetchOpenFactsProduct(
    OPEN_PRODUCTS_FACTS_PRODUCT_URL,
    code,
  );
  if (householdPayload?.status === 1 && householdPayload.product) {
    const name = extractProductName(householdPayload.product);
    if (name) {
      return {
        name,
        itemType: ITEM_TYPE.HOUSEHOLD,
        category: defaultCategoryForItemType(ITEM_TYPE.HOUSEHOLD),
      };
    }
  }

  return null;
}

/** Short vibration when barcode is unknown (mobile browsers). */
export function vibrateBarcodeUnknown() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([35, 40, 35]);
  }
}

export const BARCODE_UNKNOWN_PLACEHOLDER =
  'Barcode unknown. Please type item name manually.';

export const BARCODE_LOOKUP_LOADING_TEXT = 'Searching database...';
