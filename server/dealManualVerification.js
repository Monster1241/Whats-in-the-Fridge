/**
 * Manual catalogue verification — no paid price feed required.
 * An operator checks the retailer flyer, then marks deals verified (optionally correcting prices).
 */

/**
 * @param {Record<string, unknown>} deal
 * @param {Date} [now]
 */
export function isManuallyPriceVerified(deal, now = new Date()) {
  if (!deal.priceVerifiedAt) return false;

  const verifiedAt = new Date(deal.priceVerifiedAt);
  if (Number.isNaN(verifiedAt.getTime())) return false;

  const cycleKey = deal.storeCycleStart ?? null;
  const verifiedCycle = deal.priceVerifiedForCycle ?? null;
  if (cycleKey && verifiedCycle && verifiedCycle !== cycleKey) return false;

  const expiresAt = deal.storeExpiresAt ?? deal.expiresAt;
  if (expiresAt) {
    const expiry = new Date(expiresAt);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < now.getTime()) {
      return false;
    }
  }

  return true;
}

/**
 * @param {Record<string, unknown>} deal
 * @returns {Promise<{ confirmed: boolean, checkedAt: string, note: string, method: 'manual'|'live'|null }>}
 */
export async function verifyDealLive(deal) {
  if (isManuallyPriceVerified(deal)) {
    const checkedAt =
      deal.priceVerifiedAt instanceof Date
        ? deal.priceVerifiedAt.toISOString()
        : new Date(deal.priceVerifiedAt).toISOString();
    const source = deal.priceVerificationSource
      ? String(deal.priceVerificationSource)
      : 'retailer catalogue';
    return {
      confirmed: true,
      checkedAt,
      note: `Manually verified against ${source}.`,
      method: 'manual',
    };
  }

  const dataSource = String(deal.dataSource ?? 'seed');
  if (dataSource === 'live') {
    return {
      confirmed: false,
      checkedAt: new Date().toISOString(),
      note: 'Automated live verification is not configured.',
      method: null,
    };
  }

  return {
    confirmed: false,
    checkedAt: new Date().toISOString(),
    note: 'Not yet verified — check the store catalogue and mark verified after confirming.',
    method: null,
  };
}

/**
 * @param {import('mongodb').Collection} collection
 * @param {import('mongodb').ObjectId|import('mongodb').Filter<import('mongodb').Document>} target
 * @param {{
 *   dealPrice?: number,
 *   originalPrice?: number|null,
 *   verifiedBy?: string,
 *   verificationSource?: string,
 *   now?: Date,
 * }} [options]
 */
export async function markDealManuallyVerified(collection, target, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const filter =
    typeof target === 'object' && target !== null && '_id' in target
      ? { _id: target._id }
      : { _id: target };

  const existing = await collection.findOne(filter);
  if (!existing) {
    const err = new Error('Deal not found.');
    err.status = 404;
    throw err;
  }

  const dealPrice =
    options.dealPrice != null ? Number(options.dealPrice) : existing.dealPrice;
  const originalPrice =
    options.originalPrice !== undefined
      ? options.originalPrice == null
        ? null
        : Number(options.originalPrice)
      : existing.originalPrice ?? null;

  const update = {
    dealPrice,
    originalPrice,
    priceVerifiedAt: now,
    priceVerifiedForCycle: existing.storeCycleStart ?? null,
    priceVerifiedBy: options.verifiedBy?.trim() || 'manual',
    priceVerificationSource: options.verificationSource?.trim() || null,
    updated_at: now,
  };

  await collection.updateOne(filter, { $set: update });

  return {
    id: existing._id.toString(),
    name: existing.name,
    store: existing.store,
    ...update,
    priceVerifiedAt: now.toISOString(),
  };
}

/**
 * @param {import('mongodb').Collection} collection
 * @param {{
 *   store?: string,
 *   name?: string,
 *   verifiedBy?: string,
 *   verificationSource?: string,
 *   now?: Date,
 * }} [options]
 */
export async function markStoreDealsManuallyVerified(collection, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const store = options.store?.trim().toLowerCase();
  if (!store) {
    const err = new Error('store is required.');
    err.status = 400;
    throw err;
  }

  const query = {
    store,
    $or: [{ storeExpiresAt: { $gte: now } }, { expiresAt: { $gte: now } }],
  };
  if (options.name?.trim()) {
    query.name = options.name.trim();
  }

  const docs = await collection.find(query).toArray();
  const verified = [];

  for (const doc of docs) {
    verified.push(
      await markDealManuallyVerified(collection, doc._id, {
        verifiedBy: options.verifiedBy,
        verificationSource: options.verificationSource,
        now,
      }),
    );
  }

  return { store, count: verified.length, verified };
}

/**
 * @param {import('mongodb').Collection} collection
 * @param {{ store?: string, now?: Date }} [options]
 */
export async function listUnverifiedStoreDeals(collection, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const query = {
    priceVerifiedAt: { $exists: false },
    $or: [{ storeExpiresAt: { $gte: now } }, { expiresAt: { $gte: now } }],
  };
  if (options.store?.trim()) {
    query.store = options.store.trim().toLowerCase();
  }

  const docs = await collection
    .find(query)
    .sort({ store: 1, name: 1 })
    .project({ name: 1, store: 1, dealPrice: 1, originalPrice: 1, storeCycleStart: 1 })
    .toArray();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    store: doc.store,
    dealPrice: doc.dealPrice,
    originalPrice: doc.originalPrice ?? null,
    storeCycleStart: doc.storeCycleStart ?? null,
  }));
}
