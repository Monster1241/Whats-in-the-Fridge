import {
  getCurrentWednesdayStart,
  getNextWednesdayExpiry,
} from './groceryCycle.js';

export const WEEKLY_DEALS_COLLECTION = 'weeklyDeals';
export const WEEKLY_DEALS_ARCHIVE_COLLECTION = 'weeklyDealsArchive';

/** @typedef {'coles'|'woolworths'|'aldi'|'harrisfarm'|'costco'} DealStore */

export const DEAL_STORES = /** @type {const} */ ([
  'coles',
  'woolworths',
  'aldi',
  'harrisfarm',
  'costco',
]);

export const DEAL_STORE_LABELS = {
  coles: 'Coles',
  woolworths: 'Woolworths',
  aldi: 'ALDI',
  harrisfarm: 'Harris Farm',
  costco: 'Costco',
};

export const DEAL_CATEGORIES = ['Fresh', 'Pantry', 'Household', 'Baby'];

/** @typedef {'Half Price'|'Super Saver'|'Price Drop'|'Special Buy'|'Bulk Value'} DealType */

export const DEAL_TYPES = /** @type {const} */ ([
  'Half Price',
  'Super Saver',
  'Price Drop',
  'Special Buy',
  'Bulk Value',
]);

const DEAL_TYPE_ALIASES = {
  halfprice: 'Half Price',
  'half-price': 'Half Price',
  supersaver: 'Super Saver',
  'super-saver': 'Super Saver',
  pricedrop: 'Price Drop',
  'price-drop': 'Price Drop',
  specialbuy: 'Special Buy',
  'special-buy': 'Special Buy',
  bulkvalue: 'Bulk Value',
  'bulk-value': 'Bulk Value',
  'bulk buy value': 'Bulk Value',
};

export const DEFAULT_SAVINGS_TEXT_BY_DEAL_TYPE = {
  'Half Price': 'Half Price!',
  'Super Saver': 'Super Saver',
  'Price Drop': 'Price Drop',
  'Special Buy': 'Special Buy',
  'Bulk Value': 'Bulk Buy Value',
};

/**
 * WeeklyDeals collection schema (native MongoDB — mirrors requested Mongoose shape).
 *
 * @typedef {Object} WeeklyDealDoc
 * @property {string} name
 * @property {DealStore} store
 * @property {number} dealPrice
 * @property {number|null} [originalPrice]
 * @property {DealType} dealType
 * @property {string} savingsText
 * @property {string} category
 * @property {Date} expiresAt
 * @property {Date} created_at
 * @property {Date} updated_at
 */

function getDb() {
  const db = globalThis._mongo?.db;
  if (!db) {
    throw new Error('Database not connected. Call connectDb() first.');
  }
  return db;
}

export { getCurrentWednesdayStart, getNextWednesdayExpiry };

function sanitizePrice(value, { required = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    if (required) {
      const err = new Error('A valid deal price is required.');
      err.status = 400;
      throw err;
    }
    return null;
  }
  return Math.round(n * 100) / 100;
}

export function normalizeDealStore(value) {
  const key = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const aliases = {
    harrisfarm: 'harrisfarm',
    'harris-farm': 'harrisfarm',
    'harris farm': 'harrisfarm',
  };
  const normalized = aliases[key] ?? key;
  return DEAL_STORES.includes(normalized) ? normalized : null;
}

export function normalizeDealCategory(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const match = DEAL_CATEGORIES.find((cat) => cat.toLowerCase() === trimmed.toLowerCase());
  return match ?? trimmed.slice(0, 64);
}

export function normalizeDealType(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (DEAL_TYPES.includes(raw)) return raw;

  const key = raw.toLowerCase().replace(/\s+/g, ' ');
  const compact = key.replace(/\s+/g, '');
  return DEAL_TYPE_ALIASES[key] ?? DEAL_TYPE_ALIASES[compact] ?? null;
}

export function inferDealTypeFromSavingsText(savingsText) {
  const text = String(savingsText ?? '').toLowerCase();
  if (/half\s*price|½\s*price|1\/2/.test(text)) return 'Half Price';
  if (/super\s*saver/.test(text)) return 'Super Saver';
  if (/special\s*buy/.test(text)) return 'Special Buy';
  if (/bulk|value\s*pack|warehouse/.test(text)) return 'Bulk Value';
  if (/save\s*\$|price\s*drop|was\s*\$|%\s*off/.test(text)) return 'Price Drop';
  return 'Price Drop';
}

function sanitizeExpiresAt(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return getNextWednesdayExpiry();
}

/**
 * @param {Partial<WeeklyDealDoc>} input
 * @returns {WeeklyDealDoc}
 */
export function buildWeeklyDealDoc(input) {
  const name = String(input.name ?? '').trim().slice(0, 160);
  if (!name) {
    const err = new Error('Deal name is required.');
    err.status = 400;
    throw err;
  }

  const store = normalizeDealStore(input.store);
  if (!store) {
    const err = new Error('Store must be one of: coles, woolworths, aldi, harrisfarm, costco.');
    err.status = 400;
    throw err;
  }

  const dealPrice = sanitizePrice(input.dealPrice, { required: true });
  const originalPrice = sanitizePrice(input.originalPrice);
  const savingsTextRaw = String(input.savingsText ?? '').trim().slice(0, 120);
  const dealType =
    normalizeDealType(input.dealType) ??
    (savingsTextRaw ? inferDealTypeFromSavingsText(savingsTextRaw) : null);

  if (!dealType) {
    const err = new Error(
      `dealType is required. Use one of: ${DEAL_TYPES.join(', ')}.`,
    );
    err.status = 400;
    throw err;
  }

  const savingsText =
    savingsTextRaw || DEFAULT_SAVINGS_TEXT_BY_DEAL_TYPE[dealType] || dealType;

  const category = normalizeDealCategory(input.category) ?? 'Pantry';
  const now = new Date();

  return {
    name,
    store,
    dealPrice,
    originalPrice,
    dealType,
    savingsText,
    category,
    expiresAt: sanitizeExpiresAt(input.expiresAt),
    created_at: input.created_at instanceof Date ? input.created_at : now,
    updated_at: now,
  };
}

/**
 * @param {import('mongodb').WithId<import('mongodb').Document>} doc
 */
export function mapWeeklyDealDoc(doc) {
  const dealType =
    normalizeDealType(doc.dealType) ??
    inferDealTypeFromSavingsText(doc.savingsText);

  return {
    id: doc._id.toString(),
    name: doc.name,
    store: doc.store,
    storeLabel: DEAL_STORE_LABELS[doc.store] ?? doc.store,
    dealPrice: doc.dealPrice,
    originalPrice: doc.originalPrice ?? null,
    dealType,
    savingsText: doc.savingsText,
    category: doc.category,
    expiresAt:
      doc.expiresAt instanceof Date
        ? doc.expiresAt.toISOString()
        : doc.expiresAt
          ? new Date(doc.expiresAt).toISOString()
          : null,
  };
}

/**
 * @param {import('mongodb').Collection} collection
 */
export async function ensureWeeklyDealIndexes(collection) {
  await collection.createIndex({ store: 1, category: 1 });
  await collection.createIndex({ expiresAt: 1 });
  await collection.createIndex({ name: 1, store: 1 });
  await collection.createIndex({ dealType: 1 });
}

export const WEEKLY_DEAL_TEMPLATES = [
  {
    name: 'Sirena Tuna 185g',
    store: 'coles',
    dealPrice: 1.25,
    originalPrice: 2.5,
    dealType: 'Half Price',
    savingsText: 'Half Price!',
    category: 'Pantry',
  },
  {
    name: 'Huggies Bulk Nappies',
    store: 'woolworths',
    dealPrice: 28,
    originalPrice: 42,
    dealType: 'Super Saver',
    savingsText: 'Save $14.00',
    category: 'Baby',
  },
  {
    name: 'Organic Avocados 1kg',
    store: 'harrisfarm',
    dealPrice: 5.99,
    originalPrice: 8.99,
    dealType: 'Price Drop',
    savingsText: 'Save $3.00',
    category: 'Fresh',
  },
  {
    name: 'Stainless Steel Water Bottle 2-Pack',
    store: 'costco',
    dealPrice: 19.99,
    originalPrice: null,
    dealType: 'Bulk Value',
    savingsText: 'Bulk Buy Value',
    category: 'Household',
  },
  {
    name: 'Barossa Fine Foods Salami 200g',
    store: 'aldi',
    dealPrice: 3.49,
    originalPrice: null,
    dealType: 'Special Buy',
    savingsText: 'Special Buy',
    category: 'Fresh',
  },
  {
    name: 'Finish Dishwashing Tablets 56pk',
    store: 'coles',
    dealPrice: 18,
    originalPrice: 36,
    dealType: 'Half Price',
    savingsText: 'Half Price!',
    category: 'Household',
  },
  {
    name: 'Macro Organic Greek Yoghurt 1kg',
    store: 'woolworths',
    dealPrice: 4.5,
    originalPrice: 6.5,
    dealType: 'Price Drop',
    savingsText: 'Save $2.00',
    category: 'Fresh',
  },
  {
    name: 'Kirkland Paper Towels 12-Pack',
    store: 'costco',
    dealPrice: 24.99,
    originalPrice: null,
    dealType: 'Bulk Value',
    savingsText: 'Bulk Buy Value',
    category: 'Household',
  },
];

/**
 * @param {Date} expiresAt
 * @param {typeof WEEKLY_DEAL_TEMPLATES} [templates]
 */
export function buildDealsForCycle(expiresAt, templates = WEEKLY_DEAL_TEMPLATES) {
  return templates.map((entry) => buildWeeklyDealDoc({ ...entry, expiresAt }));
}

export async function seedWeeklyDealsIfEmpty() {
  const collection = getDb().collection(WEEKLY_DEALS_COLLECTION);
  const count = await collection.countDocuments({}, { limit: 1 });
  if (count > 0) return false;

  const expiresAt = getNextWednesdayExpiry();
  const docs = buildDealsForCycle(expiresAt);

  try {
    await collection.insertMany(docs, { ordered: false });
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }

  return true;
}

function parseFilterList(value) {
  return [
    ...new Set(
      String(value ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * @param {{ store?: string|null, category?: string|null }} filters
 */
export async function fetchWeeklyDeals(filters = {}) {
  const collection = getDb().collection(WEEKLY_DEALS_COLLECTION);
  await seedWeeklyDealsIfEmpty();

  const query = {
    expiresAt: { $gte: new Date() },
  };

  const storeFilters = parseFilterList(filters.store)
    .map((value) => normalizeDealStore(value))
    .filter(Boolean);
  if (storeFilters.length > 0) {
    query.store = { $in: storeFilters };
  }

  const categoryFilters = parseFilterList(filters.category)
    .map((value) => normalizeDealCategory(value))
    .filter(Boolean);
  if (categoryFilters.length > 0) {
    query.category = { $in: categoryFilters };
  }

  const docs = await collection
    .find(query)
    .sort({ store: 1, category: 1, name: 1 })
    .toArray();

  return docs.map(mapWeeklyDealDoc);
}

/**
 * @param {ReturnType<typeof mapWeeklyDealDoc>[]} deals
 * @param {'store'|'category'} groupBy
 */
export function groupWeeklyDeals(deals, groupBy) {
  const grouped = {};
  for (const deal of deals) {
    const key = groupBy === 'store' ? deal.store : deal.category;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(deal);
  }
  return grouped;
}
