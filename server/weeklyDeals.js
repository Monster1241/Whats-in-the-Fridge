export const WEEKLY_DEALS_COLLECTION = 'weeklyDeals';

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
 * WeeklyDeals collection schema (native MongoDB — mirrors requested Mongoose shape).
 *
 * @typedef {Object} WeeklyDealDoc
 * @property {string} name
 * @property {DealStore} store
 * @property {number} dealPrice
 * @property {number|null} [originalPrice]
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

export function getNextWednesdayExpiry(from = new Date()) {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const day = d.getUTCDay();
  let daysUntil = (3 - day + 7) % 7;
  if (daysUntil === 0) daysUntil = 7;
  d.setUTCDate(d.getUTCDate() + daysUntil);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

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
  const savingsText = String(input.savingsText ?? '').trim().slice(0, 120);
  if (!savingsText) {
    const err = new Error('Savings text is required.');
    err.status = 400;
    throw err;
  }

  const category = normalizeDealCategory(input.category) ?? 'Pantry';
  const now = new Date();

  return {
    name,
    store,
    dealPrice,
    originalPrice,
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
  return {
    id: doc._id.toString(),
    name: doc.name,
    store: doc.store,
    storeLabel: DEAL_STORE_LABELS[doc.store] ?? doc.store,
    dealPrice: doc.dealPrice,
    originalPrice: doc.originalPrice ?? null,
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
}

const SEED_DEALS = [
  {
    name: 'Sirena Tuna 185g',
    store: 'coles',
    dealPrice: 1.25,
    originalPrice: 2.5,
    savingsText: 'Half Price!',
    category: 'Pantry',
  },
  {
    name: 'Huggies Bulk Nappies',
    store: 'woolworths',
    dealPrice: 28,
    originalPrice: 42,
    savingsText: 'Save $14.00',
    category: 'Baby',
  },
  {
    name: 'Organic Avocados 1kg',
    store: 'harrisfarm',
    dealPrice: 5.99,
    originalPrice: 8.99,
    savingsText: 'Save $3.00',
    category: 'Fresh',
  },
  {
    name: 'Stainless Steel Water Bottle 2-Pack',
    store: 'costco',
    dealPrice: 19.99,
    originalPrice: null,
    savingsText: 'Bulk Buy Value',
    category: 'Household',
  },
  {
    name: 'Barossa Fine Foods Salami 200g',
    store: 'aldi',
    dealPrice: 3.49,
    originalPrice: null,
    savingsText: 'Special Buy',
    category: 'Fresh',
  },
  {
    name: 'Finish Dishwashing Tablets 56pk',
    store: 'coles',
    dealPrice: 18,
    originalPrice: 36,
    savingsText: 'Half Price!',
    category: 'Household',
  },
  {
    name: 'Macro Organic Greek Yoghurt 1kg',
    store: 'woolworths',
    dealPrice: 4.5,
    originalPrice: 6.5,
    savingsText: 'Save $2.00',
    category: 'Fresh',
  },
  {
    name: 'Kirkland Paper Towels 12-Pack',
    store: 'costco',
    dealPrice: 24.99,
    originalPrice: null,
    savingsText: 'Bulk Buy Value',
    category: 'Household',
  },
];

export async function seedWeeklyDealsIfEmpty() {
  const collection = getDb().collection(WEEKLY_DEALS_COLLECTION);
  const count = await collection.countDocuments({}, { limit: 1 });
  if (count > 0) return false;

  const expiresAt = getNextWednesdayExpiry();
  const docs = SEED_DEALS.map((entry) => buildWeeklyDealDoc({ ...entry, expiresAt }));

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
