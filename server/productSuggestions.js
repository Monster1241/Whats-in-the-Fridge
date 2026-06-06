import { ITEM_SUGGESTIONS } from '../src/inventory/itemSuggestions.js';

export const PRODUCT_SUGGESTIONS_COLLECTION = 'productSuggestions';

/** @typedef {'coles'|'woolworths'|'aldi'|'iga'} StoreKey */

export const STORE_KEYS = /** @type {const} */ (['coles', 'woolworths', 'aldi', 'iga']);

export const STORE_LABELS = {
  coles: 'Coles',
  woolworths: 'Woolworths',
  aldi: 'ALDI',
  iga: 'IGA',
};

/** @type {Record<StoreKey, null>} */
export const EMPTY_PRICES = {
  coles: null,
  woolworths: null,
  aldi: null,
  iga: null,
};

/**
 * @typedef {Object} ProductPrices
 * @property {number|null} coles
 * @property {number|null} woolworths
 * @property {number|null} aldi
 * @property {number|null} iga
 */

/**
 * @typedef {Object} ProductDeal
 * @property {string|null} store
 * @property {string|null} discountText
 * @property {boolean} isHalfPrice
 * @property {number|null} originalPrice
 */

/**
 * @typedef {Object} ProductSuggestionDoc
 * @property {string} name
 * @property {string} nameNormalized
 * @property {'Food'|'Household'|'Baby'} itemType
 * @property {string} category
 * @property {ProductPrices} prices
 * @property {ProductDeal|null} deals
 * @property {Date} lastUpdated
 * @property {Date} created_at
 */

function getDb() {
  const db = globalThis._mongo?.db;
  if (!db) {
    throw new Error('Database not connected. Call connectDb() first.');
  }
  return db;
}

export function normalizeProductName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function sanitizePrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/**
 * @param {unknown} raw
 * @returns {ProductPrices}
 */
export function sanitizePrices(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    coles: sanitizePrice(source.coles),
    woolworths: sanitizePrice(source.woolworths),
    aldi: sanitizePrice(source.aldi),
    iga: sanitizePrice(source.iga),
  };
}

/**
 * @param {unknown} raw
 * @returns {ProductDeal|null}
 */
export function sanitizeDeals(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const storeRaw = String(raw.store ?? '').trim().toLowerCase();
  const store = STORE_KEYS.includes(storeRaw) ? storeRaw : null;
  const discountText = String(raw.discountText ?? '').trim().slice(0, 120) || null;
  const isHalfPrice = Boolean(raw.isHalfPrice);
  const originalPrice = sanitizePrice(raw.originalPrice);

  if (!store && !discountText && !isHalfPrice && originalPrice == null) {
    return null;
  }

  return {
    store,
    discountText,
    isHalfPrice,
    originalPrice,
  };
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Deterministic mock prices for seeding the catalog in development.
 * @param {string} name
 * @returns {ProductPrices}
 */
export function buildMockPrices(name) {
  const base = (hashString(normalizeProductName(name)) % 1200) / 100 + 1.5;
  const coles = sanitizePrice(base + 0.35);
  const woolworths = sanitizePrice(base + 0.2);
  const aldi = sanitizePrice(base - 0.45);
  const iga = sanitizePrice(base + 0.55);
  return { coles, woolworths, aldi, iga };
}

/**
 * @param {string} name
 * @param {ProductPrices} prices
 * @returns {ProductDeal|null}
 */
export function buildMockDeal(name, prices) {
  const hash = hashString(normalizeProductName(name));
  if (hash % 5 !== 0) return null;

  const store = STORE_KEYS[hash % STORE_KEYS.length];
  const current = prices[store];
  if (current == null) return null;

  const isHalfPrice = hash % 2 === 0;
  const originalPrice = isHalfPrice ? sanitizePrice(current * 2) : sanitizePrice(current * 1.25);
  const discountText = isHalfPrice ? '½ Price' : 'Special';

  return {
    store,
    discountText,
    isHalfPrice,
    originalPrice,
  };
}

/**
 * @param {Partial<ProductSuggestionDoc>} input
 * @returns {ProductSuggestionDoc}
 */
export function buildProductSuggestionDoc(input) {
  const name = String(input.name ?? '').trim().slice(0, 120);
  if (!name) {
    const err = new Error('Product name is required.');
    err.status = 400;
    throw err;
  }

  const itemType =
    input.itemType === 'Household'
      ? 'Household'
      : input.itemType === 'Baby'
        ? 'Baby'
        : 'Food';

  const prices = sanitizePrices(input.prices ?? buildMockPrices(name));
  const deals = sanitizeDeals(input.deals ?? buildMockDeal(name, prices));
  const lastUpdated =
    input.lastUpdated instanceof Date && !Number.isNaN(input.lastUpdated.getTime())
      ? input.lastUpdated
      : new Date();

  return {
    name,
    nameNormalized: normalizeProductName(name),
    itemType,
    category: String(input.category ?? '').trim().slice(0, 64) || 'Ambient',
    prices,
    deals,
    lastUpdated,
    created_at: input.created_at instanceof Date ? input.created_at : new Date(),
  };
}

/**
 * @param {ProductPrices} prices
 */
export function formatPricingArray(prices) {
  return STORE_KEYS.map((store) => ({
    store,
    label: STORE_LABELS[store],
    price: prices[store] ?? null,
  }));
}

/**
 * @param {ProductDeal|null|undefined} deal
 */
export function formatDealResponse(deal) {
  if (!deal) {
    return {
      active: false,
      store: null,
      label: null,
      discountText: null,
      isHalfPrice: false,
      originalPrice: null,
    };
  }

  const active = Boolean(
    deal.store && (deal.discountText || deal.isHalfPrice || deal.originalPrice != null),
  );

  return {
    active,
    store: deal.store,
    label: deal.store ? STORE_LABELS[deal.store] : null,
    discountText: deal.discountText,
    isHalfPrice: deal.isHalfPrice,
    originalPrice: deal.originalPrice,
  };
}

/**
 * @param {import('mongodb').WithId<import('mongodb').Document>} doc
 */
export function mapProductSuggestionDoc(doc) {
  const prices = sanitizePrices(doc.prices);
  const deals = sanitizeDeals(doc.deals);
  const lastUpdated =
    doc.lastUpdated instanceof Date
      ? doc.lastUpdated.toISOString()
      : doc.lastUpdated
        ? new Date(doc.lastUpdated).toISOString()
        : null;

  return {
    id: doc._id.toString(),
    name: doc.name,
    itemType: doc.itemType,
    category: doc.category,
    prices: formatPricingArray(prices),
    deal: formatDealResponse(deals),
    lastUpdated,
  };
}

function suggestionMatchesQuery(nameNormalized, needle) {
  if (nameNormalized.includes(needle)) return true;
  return nameNormalized.split(/\s+/).some(
    (word) => word.startsWith(needle) || needle.startsWith(word),
  );
}

function rankSuggestion(nameNormalized, needle) {
  const starts = nameNormalized.startsWith(needle) ? 0 : 1;
  const word = nameNormalized.split(/\s+/).some((w) => w.startsWith(needle)) ? 0 : 1;
  return starts * 10 + word;
}

/**
 * @param {import('mongodb').Collection} collection
 */
export async function ensureProductSuggestionIndexes(collection) {
  await collection.createIndex({ nameNormalized: 1 });
  await collection.createIndex({ name: 1 }, { unique: true });
}

/**
 * Seeds the catalog from static ITEM_SUGGESTIONS when the collection is empty.
 */
export async function seedProductSuggestionsIfEmpty() {
  const collection = getDb().collection(PRODUCT_SUGGESTIONS_COLLECTION);
  const count = await collection.countDocuments({}, { limit: 1 });
  if (count > 0) return false;

  const now = new Date();
  const docs = ITEM_SUGGESTIONS.map((entry) => {
    const prices = buildMockPrices(entry.name);
    return {
      ...buildProductSuggestionDoc({
        name: entry.name,
        itemType: entry.itemType,
        category: entry.category,
        prices,
        deals: buildMockDeal(entry.name, prices),
        lastUpdated: now,
        created_at: now,
      }),
    };
  });

  if (docs.length === 0) return false;

  try {
    await collection.insertMany(docs, { ordered: false });
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }

  return true;
}

/**
 * @param {string} query
 * @param {number} limit
 */
export async function searchProductSuggestions(query, limit = 8) {
  const collection = getDb().collection(PRODUCT_SUGGESTIONS_COLLECTION);
  await seedProductSuggestionsIfEmpty();

  const needle = normalizeProductName(query);
  if (!needle) return [];

  const docs = await collection
    .find({
      nameNormalized: { $regex: needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
    })
    .limit(Math.min(Math.max(limit * 4, 16), 80))
    .toArray();

  return docs
    .filter((doc) => suggestionMatchesQuery(doc.nameNormalized, needle))
    .sort((a, b) => {
      const rankDiff =
        rankSuggestion(a.nameNormalized, needle) - rankSuggestion(b.nameNormalized, needle);
      if (rankDiff !== 0) return rankDiff;
      return a.nameNormalized.localeCompare(b.nameNormalized);
    })
    .slice(0, limit)
    .map(mapProductSuggestionDoc);
}

/**
 * @param {string[]} names
 */
export async function findProductSuggestionsByNames(names) {
  const collection = getDb().collection(PRODUCT_SUGGESTIONS_COLLECTION);
  await seedProductSuggestionsIfEmpty();

  const normalized = [
    ...new Set(
      names
        .map((name) => normalizeProductName(name))
        .filter(Boolean),
    ),
  ];
  if (normalized.length === 0) return [];

  const docs = await collection
    .find({ nameNormalized: { $in: normalized } })
    .toArray();

  const byName = new Map(docs.map((doc) => [doc.nameNormalized, doc]));
  return normalized
    .map((key) => byName.get(key))
    .filter(Boolean)
    .map(mapProductSuggestionDoc);
}
