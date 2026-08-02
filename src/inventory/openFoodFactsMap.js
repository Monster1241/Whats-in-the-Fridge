import { FOOD_CATEGORY, HOUSEHOLD_CATEGORY, ITEM_TYPE } from './constants.js';
import { classifyItem, resolveIntakeCategory } from './classifyItem.js';
import { resolveSubCategory } from './subcategories.js';

/**
 * @param {Record<string, unknown>|undefined} product
 * @returns {string|null}
 */
export function extractOpenFactsProductName(product) {
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
 * @param {Record<string, unknown>|undefined} product
 */
export function buildAuProductDisplayName(product) {
  const base = extractOpenFactsProductName(product);
  if (!base) return null;

  const brand = String(product.brands ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)[0];

  if (!brand) return base;

  const brandLower = brand.toLowerCase();
  if (base.toLowerCase().includes(brandLower)) return base;
  return `${brand} ${base}`;
}

/**
 * @param {Record<string, unknown>|undefined} product
 */
export function isLikelyAustralianProduct(product) {
  if (!product) return false;
  const countries = Array.isArray(product.countries_tags)
    ? product.countries_tags
    : [];
  if (countries.some((tag) => /australia|en:australia/i.test(String(tag)))) return true;

  const stores = Array.isArray(product.stores_tags) ? product.stores_tags : [];
  if (
    stores.some((tag) =>
      /woolworths|coles|aldi|iga|harris/i.test(String(tag)),
    )
  ) {
    return true;
  }

  return false;
}

/**
 * @param {unknown} tags
 */
function tagList(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => String(tag).toLowerCase());
}

/**
 * @param {Record<string, unknown>} product
 */
function inferFromOffCategoryTags(product) {
  const tags = [
    ...tagList(product.categories_tags),
    ...tagList(product.labels_tags),
    ...tagList(product.packaging_tags),
  ].join(' ');

  if (/frozen|ice-cream|sorbet|freezer/.test(tags)) {
    return { category: FOOD_CATEGORY.FREEZER };
  }
  if (
    /dairy|milk|cheese|yoghurt|yogurt|butter|cream|eggs|meat|fish|seafood|poultry|fresh/.test(
      tags,
    )
  ) {
    return { category: FOOD_CATEGORY.FRESH };
  }
  if (
    /cleaning|detergent|laundry|household|shampoo|soap|toilet|paper-towel|dishwash/.test(
      tags,
    )
  ) {
    return {
      itemType: ITEM_TYPE.HOUSEHOLD,
      category: /laundry|detergent|fabric/.test(tags)
        ? HOUSEHOLD_CATEGORY.LAUNDRY
        : /shampoo|soap|tooth|deodorant|bathroom/.test(tags)
          ? HOUSEHOLD_CATEGORY.BATHROOM
          : HOUSEHOLD_CATEGORY.CLEANING,
    };
  }
  if (/pantry|pasta|rice|cereal|snack|beverage|drink|sauce|spice|condiment/.test(tags)) {
    return { category: FOOD_CATEGORY.AMBIENT };
  }
  return null;
}

/**
 * @param {Record<string, unknown>} product
 * @param {'food'|'household'} kind
 */
export function mapOpenFactsProduct(product, kind = 'food') {
  const name = buildAuProductDisplayName(product);
  if (!name) return null;

  const tagHint = inferFromOffCategoryTags(product);
  const classified = classifyItem(name);

  let itemType = ITEM_TYPE.FOOD;
  let category = FOOD_CATEGORY.FRESH;

  if (kind === 'household' || tagHint?.itemType === ITEM_TYPE.HOUSEHOLD) {
    itemType = ITEM_TYPE.HOUSEHOLD;
    category = tagHint?.category ?? HOUSEHOLD_CATEGORY.CLEANING;
  } else if (tagHint?.category) {
    category = tagHint.category;
  } else if (classified) {
    category = classified.category;
  } else {
    const intake = resolveIntakeCategory(name);
    category = intake.category;
  }

  const subCategory = resolveSubCategory(name, itemType, category);

  const productExpiry =
    product.expiration_date ??
    product.best_before_date ??
    product.expiration_date_en ??
    null;

  return {
    name,
    itemType,
    category,
    subCategory,
    brand: String(product.brands ?? '').split(',')[0]?.trim() || null,
    barcode: String(product.code ?? product._id ?? '').trim() || null,
    isAustralian: isLikelyAustralianProduct(product),
    productExpiry,
    source: kind,
  };
}

/**
 * Pick the best AU-relevant product payload from multiple OFF responses.
 * @param {Array<{ payload: { status?: number, product?: Record<string, unknown> }|null, region: string }>} attempts
 */
export function pickBestOpenFactsProduct(attempts) {
  const hits = attempts
    .filter((entry) => entry.payload?.status === 1 && entry.payload.product)
    .map((entry) => ({
      product: entry.payload.product,
      region: entry.region,
      au: isLikelyAustralianProduct(entry.payload.product),
    }));

  if (hits.length === 0) return null;

  const auHit = hits.find((hit) => hit.au);
  if (auHit) return { product: auHit.product, region: auHit.region };

  const regional = hits.find((hit) => hit.region === 'au');
  if (regional) return { product: regional.product, region: regional.region };

  return { product: hits[0].product, region: hits[0].region };
}
