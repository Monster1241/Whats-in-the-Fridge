import {
  getCurrentWednesdayStart,
  getNextWednesdayExpiry,
} from './groceryCycle.js';
import {
  getActiveDealStores,
  getBiweeklyCycleBounds,
  getBiweeklyCycleIndex,
  getCurrentBiweeklyCycleStart,
  serializeCycleStart,
} from './dealCycle.js';
import { WEEKLY_DEAL_TEMPLATES } from './seedWeeklyDeals.js';

export { WEEKLY_DEAL_TEMPLATES };

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

/**
 * @typedef {'Half Price'|'Super Saver'|'Price Drop'|'Reduced'|'Special Buy'} DealType
 * Half Price — strict 50% off
 * Super Saver — high-value absolute dollar discounts
 * Price Drop / Reduced — standard catalog markdowns
 * Special Buy — ALDI limited-inventory lines
 */

export const DEAL_TYPES = /** @type {const} */ ([
  'Half Price',
  'Super Saver',
  'Price Drop',
  'Reduced',
  'Special Buy',
]);

/** UI / API filter groups that map to one or more deal types. */
export const DEAL_TYPE_FILTER_GROUPS = {
  halfPrice: ['Half Price'],
  superSaver: ['Super Saver'],
  priceDrops: ['Price Drop', 'Reduced'],
};

const DEAL_TYPE_ALIASES = {
  halfprice: 'Half Price',
  'half-price': 'Half Price',
  '50off': 'Half Price',
  '50%off': 'Half Price',
  supersaver: 'Super Saver',
  'super-saver': 'Super Saver',
  'super savers': 'Super Saver',
  pricedrop: 'Price Drop',
  'price-drop': 'Price Drop',
  'price drops': 'Price Drop',
  reduced: 'Reduced',
  markdown: 'Reduced',
  specialbuy: 'Special Buy',
  'special-buy': 'Special Buy',
  bulkvalue: 'Super Saver',
  'bulk-value': 'Super Saver',
  'bulk buy value': 'Super Saver',
  'bulk value': 'Super Saver',
};

export const DEFAULT_SAVINGS_TEXT_BY_DEAL_TYPE = {
  'Half Price': 'Half Price!',
  'Super Saver': 'Super Saver',
  'Price Drop': 'Price Drop',
  Reduced: 'Reduced',
  'Special Buy': 'Special Buy',
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
 * @property {string} cycleStart
 * @property {number} cycleIndex
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
  if (/half\s*price|½\s*price|1\/2|50%\s*off/.test(text)) return 'Half Price';
  if (/super\s*saver|save\s*\$\d+/.test(text)) return 'Super Saver';
  if (/special\s*buy/.test(text)) return 'Special Buy';
  if (/bulk|value\s*pack|warehouse/.test(text)) return 'Super Saver';
  if (/\breduced\b|markdown/.test(text)) return 'Reduced';
  if (/price\s*drop|was\s*\$|%\s*off/.test(text)) return 'Price Drop';
  return 'Price Drop';
}

/**
 * Resolves legacy or alias deal types to the current tier set.
 * @param {string|null|undefined} dealType
 */
export function resolveDealType(dealType) {
  const normalized = normalizeDealType(dealType);
  if (!normalized) return null;
  if (normalized === 'Bulk Value') return 'Super Saver';
  return normalized;
}

/**
 * @param {string} filterKey
 * @returns {DealType[]|null}
 */
export function expandDealTypeFilter(filterKey) {
  const key = String(filterKey ?? '').trim();
  if (!key || key.toLowerCase() === 'all') return null;
  if (DEAL_TYPE_FILTER_GROUPS[key]) return DEAL_TYPE_FILTER_GROUPS[key];
  const normalized = resolveDealType(key);
  return normalized ? [normalized] : null;
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
    resolveDealType(input.dealType) ??
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
  const cycleStart =
    typeof input.cycleStart === 'string' && input.cycleStart
      ? serializeCycleStart(new Date(input.cycleStart))
      : serializeCycleStart(getCurrentBiweeklyCycleStart());
  const cycleIndex =
    Number.isFinite(Number(input.cycleIndex))
      ? Number(input.cycleIndex)
      : getBiweeklyCycleIndex();

  return {
    name,
    store,
    dealPrice,
    originalPrice,
    dealType,
    savingsText,
    category,
    expiresAt: sanitizeExpiresAt(input.expiresAt),
    cycleStart,
    cycleIndex,
    created_at: input.created_at instanceof Date ? input.created_at : now,
    updated_at: now,
  };
}

/**
 * @param {import('mongodb').WithId<import('mongodb').Document>} doc
 */
export function mapWeeklyDealDoc(doc) {
  const dealType =
    resolveDealType(doc.dealType) ?? inferDealTypeFromSavingsText(doc.savingsText);

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
  await collection.createIndex({ cycleStart: 1, expiresAt: 1 });
  await collection.createIndex({ name: 1, store: 1 });
  await collection.createIndex({ dealType: 1 });
}

/**
 * @param {Date} expiresAt
 * @param {{
 *   cycleIndex?: number,
 *   cycleStart?: string,
 *   templates?: typeof WEEKLY_DEAL_TEMPLATES,
 * }} [options]
 */
export function buildDealsForCycle(expiresAt, options = {}) {
  const cycleIndex =
    Number.isFinite(Number(options.cycleIndex))
      ? Number(options.cycleIndex)
      : getBiweeklyCycleIndex();
  const cycleStart =
    options.cycleStart ?? serializeCycleStart(getCurrentBiweeklyCycleStart());
  const templates = options.templates ?? WEEKLY_DEAL_TEMPLATES;
  const activeStores = new Set(getActiveDealStores(cycleIndex));

  return templates
    .filter((entry) => activeStores.has(normalizeDealStore(entry.store)))
    .map((entry) =>
      buildWeeklyDealDoc({
        ...entry,
        expiresAt,
        cycleStart,
        cycleIndex,
      }),
    );
}

export async function seedWeeklyDealsIfEmpty() {
  const collection = getDb().collection(WEEKLY_DEALS_COLLECTION);
  const count = await collection.countDocuments({}, { limit: 1 });
  if (count > 0) return false;

  const cycle = getBiweeklyCycleBounds();
  const docs = buildDealsForCycle(cycle.expiresAt, {
    cycleIndex: cycle.cycleIndex,
    cycleStart: serializeCycleStart(cycle.validFrom),
  });

  try {
    await collection.insertMany(docs, { ordered: false });
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }

  return true;
}

/**
 * If all records are stale (expired), repopulate a fresh cycle so users
 * still see active deals even if cron refreshes haven't run yet.
 * @param {import('mongodb').Collection} collection
 * @param {Date} [now]
 */
async function ensureActiveDealsForCurrentCycle(collection, now = new Date()) {
  const cycle = getBiweeklyCycleBounds(now);
  const cycleStart = serializeCycleStart(cycle.validFrom);

  const hasCurrentCycle = await collection.countDocuments(
    { cycleStart, expiresAt: { $gte: now } },
    { limit: 1 },
  );
  if (hasCurrentCycle > 0) return false;

  await collection.deleteMany({
    $or: [{ expiresAt: { $lt: now } }, { cycleStart: { $ne: cycleStart } }],
  });

  const docs = buildDealsForCycle(cycle.expiresAt, {
    cycleIndex: cycle.cycleIndex,
    cycleStart,
  });

  if (docs.length > 0) {
    try {
      await collection.insertMany(docs, { ordered: false });
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }

  return true;
}

/**
 * Clears all weekly deal records and re-inserts from WEEKLY_DEAL_TEMPLATES.
 * @returns {Promise<{ deleted: number, inserted: number, expiresAt: string }>}
 */
export async function reseedWeeklyDeals() {
  const collection = getDb().collection(WEEKLY_DEALS_COLLECTION);
  const removeResult = await collection.deleteMany({});
  const cycle = getBiweeklyCycleBounds();
  const docs = buildDealsForCycle(cycle.expiresAt, {
    cycleIndex: cycle.cycleIndex,
    cycleStart: serializeCycleStart(cycle.validFrom),
  });

  if (docs.length > 0) {
    try {
      await collection.insertMany(docs, { ordered: false });
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }

  return {
    deleted: removeResult.deletedCount ?? 0,
    inserted: docs.length,
    expiresAt: cycle.expiresAt.toISOString(),
    cycleStart: serializeCycleStart(cycle.validFrom),
  };
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
 * @param {{ store?: string|null, category?: string|null, dealType?: string|null }} filters
 */
export async function fetchWeeklyDeals(filters = {}) {
  const collection = getDb().collection(WEEKLY_DEALS_COLLECTION);
  const now = new Date();
  await seedWeeklyDealsIfEmpty();
  await ensureActiveDealsForCurrentCycle(collection, now);

  const cycle = getBiweeklyCycleBounds(now);
  const cycleStart = serializeCycleStart(cycle.validFrom);

  const query = {
    expiresAt: { $gte: now },
    cycleStart,
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

  const dealTypeFilters = parseFilterList(filters.dealType)
    .flatMap((value) => expandDealTypeFilter(value) ?? [])
    .map((value) => resolveDealType(value))
    .filter(Boolean);
  const uniqueDealTypes = [...new Set(dealTypeFilters)];

  const docs = await collection
    .find(query)
    .sort({ store: 1, category: 1, name: 1 })
    .toArray();

  const mapped = docs.map(mapWeeklyDealDoc);
  if (uniqueDealTypes.length === 0) return mapped;
  return mapped.filter((deal) => uniqueDealTypes.includes(deal.dealType));
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
