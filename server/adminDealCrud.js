import { ObjectId } from 'mongodb';
import { buildWeeklyDealDoc } from './weeklyDeals.js';

/**
 * @param {import('mongodb').WithId<import('mongodb').Document>} doc
 */
export function mapAdminDealRow(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    store: doc.store,
    dealPrice: doc.dealPrice,
    originalPrice: doc.originalPrice ?? null,
    dealType: doc.dealType ?? null,
    savingsText: doc.savingsText ?? null,
    category: doc.category ?? null,
    storeCycleStart: doc.storeCycleStart ?? null,
    priceVerified: Boolean(doc.priceVerifiedAt),
    priceVerifiedAt:
      doc.priceVerifiedAt instanceof Date
        ? doc.priceVerifiedAt.toISOString()
        : doc.priceVerifiedAt ?? null,
    priceVerifiedBy: doc.priceVerifiedBy ?? null,
  };
}

/**
 * @param {import('mongodb').Collection} collection
 * @param {Record<string, unknown>} input
 */
export async function createAdminDeal(collection, input) {
  const doc = buildWeeklyDealDoc({ ...input, dataSource: 'seed' });
  const result = await collection.insertOne(doc);
  return mapAdminDealRow({ _id: result.insertedId, ...doc });
}

/**
 * @param {import('mongodb').Collection} collection
 * @param {string} dealId
 * @param {Record<string, unknown>} patch
 */
export async function updateAdminDeal(collection, dealId, patch) {
  if (!ObjectId.isValid(dealId)) {
    const err = new Error('Invalid deal id.');
    err.status = 400;
    throw err;
  }

  const _id = new ObjectId(dealId);
  const existing = await collection.findOne({ _id });
  if (!existing) {
    const err = new Error('Deal not found.');
    err.status = 404;
    throw err;
  }

  const next = buildWeeklyDealDoc({
    name: patch.name ?? existing.name,
    store: patch.store ?? existing.store,
    dealPrice: patch.dealPrice ?? existing.dealPrice,
    originalPrice:
      patch.originalPrice !== undefined ? patch.originalPrice : existing.originalPrice,
    dealType: patch.dealType ?? existing.dealType,
    savingsText: patch.savingsText ?? existing.savingsText,
    category: patch.category ?? existing.category,
    expiresAt: existing.storeExpiresAt ?? existing.expiresAt,
    storeExpiresAt: existing.storeExpiresAt ?? existing.expiresAt,
    storeCycleStart: existing.storeCycleStart,
    storeWindowId: existing.storeWindowId,
    cycleStart: existing.cycleStart,
    cycleIndex: existing.cycleIndex,
    regions: existing.regions,
    dataSource: existing.dataSource ?? 'seed',
    created_at: existing.created_at,
  });

  const priceChanged =
    next.dealPrice !== existing.dealPrice ||
    (next.originalPrice ?? null) !== (existing.originalPrice ?? null);

  const now = new Date();
  /** @type {import('mongodb').UpdateFilter<import('mongodb').Document>} */
  const update = {
    $set: {
      name: next.name,
      store: next.store,
      dealPrice: next.dealPrice,
      originalPrice: next.originalPrice,
      dealType: next.dealType,
      savingsText: next.savingsText,
      category: next.category,
      updated_at: now,
    },
  };

  if (priceChanged) {
    update.$unset = {
      priceVerifiedAt: '',
      priceVerifiedForCycle: '',
      priceVerifiedBy: '',
      priceVerificationSource: '',
    };
  }

  await collection.updateOne({ _id }, update);
  const updated = await collection.findOne({ _id });
  return mapAdminDealRow(updated);
}

/**
 * @param {import('mongodb').Collection} collection
 * @param {string} dealId
 */
export async function deleteAdminDeal(collection, dealId) {
  if (!ObjectId.isValid(dealId)) {
    const err = new Error('Invalid deal id.');
    err.status = 400;
    throw err;
  }

  const _id = new ObjectId(dealId);
  const existing = await collection.findOne({ _id });
  if (!existing) {
    const err = new Error('Deal not found.');
    err.status = 404;
    throw err;
  }

  await collection.deleteOne({ _id });
  return mapAdminDealRow(existing);
}
