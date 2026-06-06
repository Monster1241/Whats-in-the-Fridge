import {
  getCurrentWednesdayStart,
  getNextWednesdayExpiry,
} from './groceryCycle.js';
import {
  DEAL_STORES,
  DEAL_STORE_LABELS,
  normalizeDealStore,
} from './weeklyDeals.js';

export const STORE_CATALOGUES_COLLECTION = 'storeCatalogues';
export const STORE_CATALOGUES_ARCHIVE_COLLECTION = 'storeCataloguesArchive';

/**
 * StoreCatalogues collection schema (native MongoDB).
 *
 * @typedef {Object} StoreCatalogueDoc
 * @property {import('./weeklyDeals.js').DealStore} store
 * @property {string} title
 * @property {Date} validFrom
 * @property {Date} validTo
 * @property {string} pdfUrl
 * @property {string} imageUrl
 * @property {string} externalLink
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

function sanitizeUrl(value, { required = false, field = 'URL' } = {}) {
  const url = String(value ?? '').trim().slice(0, 2048);
  if (!url) {
    if (required) {
      const err = new Error(`${field} is required.`);
      err.status = 400;
      throw err;
    }
    return '';
  }
  if (!/^https?:\/\//i.test(url)) {
    const err = new Error(`${field} must be an http(s) URL.`);
    err.status = 400;
    throw err;
  }
  return url;
}

function sanitizeDate(value, { required = false, field = 'Date' } = {}) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (required) {
    const err = new Error(`${field} is required.`);
    err.status = 400;
    throw err;
  }
  return null;
}

/**
 * @param {Partial<StoreCatalogueDoc>} input
 * @returns {StoreCatalogueDoc}
 */
export function buildStoreCatalogueDoc(input) {
  const store = normalizeDealStore(input.store);
  if (!store) {
    const err = new Error('Store must be one of: coles, woolworths, aldi, harrisfarm, costco.');
    err.status = 400;
    throw err;
  }

  const title = String(input.title ?? '').trim().slice(0, 200);
  if (!title) {
    const err = new Error('Catalogue title is required.');
    err.status = 400;
    throw err;
  }

  const validFrom =
    sanitizeDate(input.validFrom, { required: true, field: 'validFrom' }) ??
    getCurrentWednesdayStart();
  const validTo =
    sanitizeDate(input.validTo, { required: true, field: 'validTo' }) ??
    getNextWednesdayExpiry();

  if (validTo.getTime() < validFrom.getTime()) {
    const err = new Error('validTo must be on or after validFrom.');
    err.status = 400;
    throw err;
  }

  const now = new Date();

  return {
    store,
    title,
    validFrom,
    validTo,
    pdfUrl: sanitizeUrl(input.pdfUrl, { required: true, field: 'pdfUrl' }),
    imageUrl: sanitizeUrl(input.imageUrl, { field: 'imageUrl' }),
    externalLink: sanitizeUrl(input.externalLink, { required: true, field: 'externalLink' }),
    created_at: input.created_at instanceof Date ? input.created_at : now,
    updated_at: now,
  };
}

/**
 * @param {import('mongodb').WithId<import('mongodb').Document>} doc
 */
export function mapStoreCatalogueDoc(doc) {
  return {
    id: doc._id.toString(),
    store: doc.store,
    storeLabel: DEAL_STORE_LABELS[doc.store] ?? doc.store,
    title: doc.title,
    validFrom:
      doc.validFrom instanceof Date
        ? doc.validFrom.toISOString()
        : new Date(doc.validFrom).toISOString(),
    validTo:
      doc.validTo instanceof Date
        ? doc.validTo.toISOString()
        : new Date(doc.validTo).toISOString(),
    pdfUrl: doc.pdfUrl,
    imageUrl: doc.imageUrl || null,
    externalLink: doc.externalLink,
  };
}

/**
 * @param {import('mongodb').Collection} collection
 */
export async function ensureStoreCatalogueIndexes(collection) {
  await collection.createIndex({ store: 1, validFrom: -1 });
  await collection.createIndex({ validFrom: 1, validTo: 1 });
}

function formatCatalogueMonth(date) {
  return date.toLocaleDateString('en-AU', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

const CATALOGUE_TITLE_PREFIX = {
  coles: 'Coles Weekly Specials',
  woolworths: 'Woolworths Weekly Specials',
  aldi: 'ALDI Special Buys',
  harrisfarm: 'Harris Farm Markets Catalogue',
  costco: 'Costco Warehouse Savings',
};

const CATALOGUE_TEMPLATES = {
  coles: {
    pdfUrl: 'https://www.coles.com.au/catalogues',
    imageUrl: 'https://www.coles.com.au/content/dam/coles/coles-assets/catalogue-cover.jpg',
    externalLink: 'https://www.coles.com.au/catalogues',
  },
  woolworths: {
    pdfUrl: 'https://www.woolworths.com.au/shop/catalogue',
    imageUrl: 'https://www.woolworths.com.au/content/catalogue-cover.jpg',
    externalLink: 'https://www.woolworths.com.au/shop/catalogue',
  },
  aldi: {
    pdfUrl: 'https://www.aldi.com.au/catalogue/',
    imageUrl: 'https://www.aldi.com.au/content/catalogue-cover.jpg',
    externalLink: 'https://www.aldi.com.au/catalogue/',
  },
  harrisfarm: {
    pdfUrl: 'https://www.harrisfarm.com.au/catalogue',
    imageUrl: 'https://www.harrisfarm.com.au/content/catalogue-cover.jpg',
    externalLink: 'https://www.harrisfarm.com.au/catalogue',
  },
  costco: {
    pdfUrl: 'https://www.costco.com.au/warehouse-offers',
    imageUrl: 'https://www.costco.com.au/content/warehouse-offers-cover.jpg',
    externalLink: 'https://www.costco.com.au/warehouse-offers',
  },
};

/**
 * @param {Date} validFrom
 * @param {Date} validTo
 */
export function buildCataloguesForCycle(validFrom, validTo) {
  const monthLabel = formatCatalogueMonth(validFrom);

  return DEAL_STORES.map((store) => {
    const template = CATALOGUE_TEMPLATES[store];
    return buildStoreCatalogueDoc({
      store,
      title: `${CATALOGUE_TITLE_PREFIX[store]} - ${monthLabel}`,
      pdfUrl: template.pdfUrl,
      imageUrl: template.imageUrl,
      externalLink: template.externalLink,
      validFrom,
      validTo,
    });
  });
}

function buildSeedCatalogues() {
  const validFrom = getCurrentWednesdayStart();
  const validTo = getNextWednesdayExpiry();
  return buildCataloguesForCycle(validFrom, validTo);
}

export async function seedStoreCataloguesIfEmpty() {
  const collection = getDb().collection(STORE_CATALOGUES_COLLECTION);
  const count = await collection.countDocuments({}, { limit: 1 });
  if (count > 0) return false;

  const docs = buildSeedCatalogues();

  try {
    await collection.insertMany(docs, { ordered: false });
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }

  return true;
}

/**
 * Returns the latest active catalogue per store (validFrom <= now <= validTo).
 */
export async function fetchActiveCataloguesPerStore() {
  const collection = getDb().collection(STORE_CATALOGUES_COLLECTION);
  await seedStoreCataloguesIfEmpty();

  const now = new Date();
  const catalogues = [];

  for (const store of DEAL_STORES) {
    const doc = await collection.findOne(
      {
        store,
        validFrom: { $lte: now },
        validTo: { $gte: now },
      },
      { sort: { validFrom: -1 } },
    );
    if (doc) {
      catalogues.push(mapStoreCatalogueDoc(doc));
    }
  }

  const byStore = Object.fromEntries(catalogues.map((entry) => [entry.store, entry]));

  return { catalogues, byStore };
}
