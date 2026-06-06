import {
  getOfficialResetCycleBounds,
  getSneakPeekCycleBounds,
} from './groceryCycle.js';
import {
  buildCataloguesForCycle,
  STORE_CATALOGUES_ARCHIVE_COLLECTION,
  STORE_CATALOGUES_COLLECTION,
} from './storeCatalogues.js';
import {
  buildDealsForCycle,
  WEEKLY_DEALS_ARCHIVE_COLLECTION,
  WEEKLY_DEALS_COLLECTION,
} from './weeklyDeals.js';

export const GROCERY_REFRESH_MODES = /** @type {const} */ ([
  'sneakPeek',
  'officialReset',
]);

/**
 * @typedef {'sneakPeek'|'officialReset'} GroceryRefreshMode
 */

function getDb() {
  const db = globalThis._mongo?.db;
  if (!db) {
    throw new Error('Database not connected. Call connectDb() first.');
  }
  return db;
}

/**
 * @param {GroceryRefreshMode} mode
 */
export function normalizeGroceryRefreshMode(mode) {
  const key = String(mode ?? '')
    .trim()
    .toLowerCase();
  if (key === 'sneakpeek' || key === 'sneak-peek' || key === 'sneak_peek') {
    return 'sneakPeek';
  }
  if (key === 'officialreset' || key === 'official-reset' || key === 'official_reset') {
    return 'officialReset';
  }
  return GROCERY_REFRESH_MODES.includes(mode) ? mode : null;
}

/**
 * @param {GroceryRefreshMode} mode
 * @param {Date} [now]
 */
export function getCycleBoundsForMode(mode, now = new Date()) {
  return mode === 'sneakPeek'
    ? getSneakPeekCycleBounds(now)
    : getOfficialResetCycleBounds(now);
}

async function archiveAndClearExpired(now) {
  const db = getDb();
  const deals = db.collection(WEEKLY_DEALS_COLLECTION);
  const catalogues = db.collection(STORE_CATALOGUES_COLLECTION);
  const dealsArchive = db.collection(WEEKLY_DEALS_ARCHIVE_COLLECTION);
  const cataloguesArchive = db.collection(STORE_CATALOGUES_ARCHIVE_COLLECTION);

  const expiredDeals = await deals.find({ expiresAt: { $lt: now } }).toArray();
  const expiredCatalogues = await catalogues.find({ validTo: { $lt: now } }).toArray();

  if (expiredDeals.length > 0) {
    await dealsArchive.insertMany(
      expiredDeals.map((doc) => ({
        ...doc,
        archivedAt: now,
        sourceCollection: WEEKLY_DEALS_COLLECTION,
      })),
      { ordered: false },
    );
    await deals.deleteMany({ _id: { $in: expiredDeals.map((doc) => doc._id) } });
  }

  if (expiredCatalogues.length > 0) {
    await cataloguesArchive.insertMany(
      expiredCatalogues.map((doc) => ({
        ...doc,
        archivedAt: now,
        sourceCollection: STORE_CATALOGUES_COLLECTION,
      })),
      { ordered: false },
    );
    await catalogues.deleteMany({
      _id: { $in: expiredCatalogues.map((doc) => doc._id) },
    });
  }

  return {
    archivedDeals: expiredDeals.length,
    archivedCatalogues: expiredCatalogues.length,
  };
}

/**
 * @param {{ validFrom: Date, validTo: Date }} cycle
 * @param {'sneakPeek'|'officialReset'} mode
 */
async function upsertCataloguesForCycle(cycle, mode) {
  const collection = getDb().collection(STORE_CATALOGUES_COLLECTION);
  const docs = buildCataloguesForCycle(cycle.validFrom, cycle.validTo);
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const doc of docs) {
    const existing = await collection.findOne({
      store: doc.store,
      validFrom: doc.validFrom,
    });

    if (existing) {
      if (mode === 'officialReset') {
        await collection.updateOne(
          { _id: existing._id },
          { $set: { ...doc, updated_at: new Date() } },
        );
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    await collection.insertOne(doc);
    inserted += 1;
  }

  return { inserted, updated, skipped, total: docs.length };
}

/**
 * @param {{ validFrom: Date, validTo: Date, expiresAt: Date }} cycle
 * @param {'sneakPeek'|'officialReset'} mode
 */
async function upsertDealsForCycle(cycle, mode) {
  const collection = getDb().collection(WEEKLY_DEALS_COLLECTION);
  const docs = buildDealsForCycle(cycle.expiresAt);
  let inserted = 0;
  let replaced = 0;
  let skipped = 0;

  if (mode === 'officialReset') {
    const removeResult = await collection.deleteMany({
      expiresAt: { $gte: cycle.validFrom, $lte: cycle.expiresAt },
    });
    replaced = removeResult.deletedCount ?? 0;
    if (docs.length > 0) {
      await collection.insertMany(docs, { ordered: false });
      inserted = docs.length;
    }
    return { inserted, replaced, skipped, total: docs.length };
  }

  for (const doc of docs) {
    const existing = await collection.findOne({
      store: doc.store,
      name: doc.name,
      expiresAt: cycle.expiresAt,
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await collection.insertOne(doc);
    inserted += 1;
  }

  return { inserted, replaced, skipped, total: docs.length };
}

/**
 * @param {GroceryRefreshMode} mode
 * @param {{ now?: Date }} [options]
 */
export async function refreshGroceryData(mode, options = {}) {
  const normalizedMode = normalizeGroceryRefreshMode(mode);
  if (!normalizedMode) {
    const err = new Error(
      `Invalid refresh mode. Use one of: ${GROCERY_REFRESH_MODES.join(', ')}.`,
    );
    err.status = 400;
    throw err;
  }

  const now = options.now instanceof Date ? options.now : new Date();
  const cycle = getCycleBoundsForMode(normalizedMode, now);
  const archive = await archiveAndClearExpired(now);
  const catalogues = await upsertCataloguesForCycle(cycle, normalizedMode);
  const deals = await upsertDealsForCycle(cycle, normalizedMode);

  return {
    ok: true,
    mode: normalizedMode,
    ranAt: now.toISOString(),
    cycle: {
      validFrom: cycle.validFrom.toISOString(),
      validTo: cycle.validTo.toISOString(),
      expiresAt: cycle.expiresAt.toISOString(),
    },
    archive,
    catalogues,
    deals,
  };
}
