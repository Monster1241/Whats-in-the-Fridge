import {
  appendPostcodeToCatalogueUrl,
  DEFAULT_FALLBACK_POSTCODE,
  DEFAULT_FALLBACK_REGION,
  normalizeCatalogueRegions,
  postcodeToRegion,
  REGION_LABELS,
  resolveCatalogueLocale,
} from './catalogueRegions.js';
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
 * @property {import('./catalogueRegions.js').CatalogueRegion[]} regions
 * @property {string[]} [postcodes]
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

  const regions = normalizeCatalogueRegions(input.regions);
  const postcodes = Array.isArray(input.postcodes)
    ? [
        ...new Set(
          input.postcodes
            .map((value) => String(value ?? '').replace(/\D/g, '').slice(0, 4))
            .filter((value) => /^\d{4}$/.test(value)),
        ),
      ]
    : [];

  const now = new Date();

  return {
    store,
    title,
    validFrom,
    validTo,
    pdfUrl: sanitizeUrl(input.pdfUrl, { required: true, field: 'pdfUrl' }),
    imageUrl: sanitizeUrl(input.imageUrl, { field: 'imageUrl' }),
    externalLink: sanitizeUrl(input.externalLink, { required: true, field: 'externalLink' }),
    regions,
    postcodes,
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
    regions: Array.isArray(doc.regions) ? doc.regions : [],
    postcodes: Array.isArray(doc.postcodes) ? doc.postcodes : [],
  };
}

/**
 * @param {import('mongodb').Collection} collection
 */
export async function ensureStoreCatalogueIndexes(collection) {
  await collection.createIndex({ store: 1, validFrom: -1 });
  await collection.createIndex({ store: 1, regions: 1, validFrom: -1 });
  await collection.createIndex({ store: 1, postcodes: 1, validFrom: -1 });
  await collection.createIndex({ validFrom: 1, validTo: 1 });
}

/** Regions seeded per retail cycle (zone-specific flyers). */
export const SEED_CATALOGUE_REGIONS = ['ACT', 'NSW_Metro', 'NSW_Sth', 'VIC'];

/** Which catalogue zones each retailer supports in seed data. */
const STORE_REGION_COVERAGE = {
  coles: SEED_CATALOGUE_REGIONS,
  woolworths: SEED_CATALOGUE_REGIONS,
  aldi: SEED_CATALOGUE_REGIONS,
  harrisfarm: ['ACT', 'NSW_Metro', 'NSW_Sth', 'NSW_Nth'],
  costco: ['ACT', 'NSW_Metro', 'NSW_Sth', 'VIC', 'QLD', 'SA', 'WA'],
};

/**
 * @param {string} store
 * @returns {import('./catalogueRegions.js').CatalogueRegion[]}
 */
export function getStoreCatalogueRegions(store) {
  const key = String(store ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  return STORE_REGION_COVERAGE[key] ?? SEED_CATALOGUE_REGIONS;
}

/** Representative postcodes used to build region-aware catalogue portal links. */
const REGION_SAMPLE_POSTCODE = {
  ACT: '2912',
  NSW_Metro: '2000',
  NSW_Sth: '2500',
  NSW_Nth: '2300',
  VIC: '3000',
  QLD: '4000',
  SA: '5000',
  WA: '6000',
  TAS: '7000',
  NT: '0800',
};

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

export const CATALOGUE_TEMPLATES = {
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
  const docs = [];

  for (const store of DEAL_STORES) {
    const template = CATALOGUE_TEMPLATES[store];
    const regions = STORE_REGION_COVERAGE[store] ?? SEED_CATALOGUE_REGIONS;

    for (const region of regions) {
      const samplePostcode = REGION_SAMPLE_POSTCODE[region] ?? DEFAULT_FALLBACK_POSTCODE;
      const regionLabel = REGION_LABELS[region] ?? region;

      docs.push(
        buildStoreCatalogueDoc({
          store,
          title: `${CATALOGUE_TITLE_PREFIX[store]} — ${regionLabel} — ${monthLabel}`,
          pdfUrl: appendPostcodeToCatalogueUrl(template.pdfUrl, samplePostcode),
          imageUrl: template.imageUrl,
          externalLink: appendPostcodeToCatalogueUrl(template.externalLink, samplePostcode),
          regions: [region],
          validFrom,
          validTo,
        }),
      );
    }
  }

  return docs;
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
 * If no catalogues are currently active (all expired), rebuild the current
 * cycle so users still see flyers even when cron refreshes haven't run yet.
 * @param {import('mongodb').Collection} collection
 * @param {Date} [now]
 */
async function ensureActiveCataloguesForCurrentCycle(collection, now = new Date()) {
  const hasActive = await collection.countDocuments(
    { validFrom: { $lte: now }, validTo: { $gte: now } },
    { limit: 1 },
  );
  if (hasActive > 0) return false;

  const validFrom = getCurrentWednesdayStart(now);
  const validTo = getNextWednesdayExpiry(now);
  const docs = buildCataloguesForCycle(validFrom, validTo);

  // Clear stale rows so we don't keep only-expired cycles around forever.
  await collection.deleteMany({ validTo: { $lt: now } });

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
 * @param {import('mongodb').Collection} collection
 * @param {import('./weeklyDeals.js').DealStore} store
 * @param {string} region
 * @param {string} postcode
 * @param {Date} now
 */
async function findActiveCatalogueForStore(collection, store, region, postcode, now) {
  const activeWindow = {
    store,
    validFrom: { $lte: now },
    validTo: { $gte: now },
  };

  const byPostcode = await collection.findOne(
    { ...activeWindow, postcodes: postcode },
    { sort: { validFrom: -1 } },
  );
  if (byPostcode) return byPostcode;

  const byRegion = await collection.findOne(
    { ...activeWindow, regions: region },
    { sort: { validFrom: -1 } },
  );
  if (byRegion) return byRegion;

  const byMetroFallback = await collection.findOne(
    { ...activeWindow, regions: DEFAULT_FALLBACK_REGION },
    { sort: { validFrom: -1 } },
  );
  if (byMetroFallback) return byMetroFallback;

  return collection.findOne(activeWindow, { sort: { validFrom: -1 } });
}

/**
 * Returns the latest active catalogue per store for the user's postcode zone.
 * @param {{ postcode?: string|null }} [options]
 */
export async function fetchActiveCataloguesPerStore(options = {}) {
  const collection = getDb().collection(STORE_CATALOGUES_COLLECTION);
  await seedStoreCataloguesIfEmpty();

  const now = new Date();
  await ensureActiveCataloguesForCurrentCycle(collection, now);

  const locale = resolveCatalogueLocale(options.postcode);
  const catalogues = [];

  for (const store of DEAL_STORES) {
    const doc = await findActiveCatalogueForStore(
      collection,
      store,
      locale.region,
      locale.postcode,
      now,
    );
    if (doc) {
      const mapped = mapStoreCatalogueDoc(doc);
      catalogues.push({
        ...mapped,
        externalLink: appendPostcodeToCatalogueUrl(mapped.externalLink, locale.postcode),
        pdfUrl: appendPostcodeToCatalogueUrl(mapped.pdfUrl, locale.postcode),
      });
    }
  }

  const byStore = Object.fromEntries(catalogues.map((entry) => [entry.store, entry]));

  return {
    catalogues,
    byStore,
    locale,
  };
}

export {
  DEFAULT_FALLBACK_POSTCODE,
  DEFAULT_FALLBACK_REGION,
  postcodeToRegion,
  resolveCatalogueLocale,
};
