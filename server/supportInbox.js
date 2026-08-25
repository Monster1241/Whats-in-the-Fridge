import { WEEKLY_DEALS_COLLECTION } from './weeklyDeals.js';
import {
  countOpenSupportChats,
  countUnreadSupportChatsForAdmin,
  ensureSupportChatIndexes,
} from './supportChat.js';

export const USER_REPORTS_COLLECTION = 'userReports';
export const USER_FEEDBACK_COLLECTION = 'userFeedback';
export const ADMIN_AUDIT_COLLECTION = 'adminAuditLog';

export const REPORT_TYPES = /** @type {const} */ ([
  'deal_wrong_price',
  'deal_not_available',
  'bug',
  'account',
  'other',
]);

export const FEEDBACK_CATEGORIES = /** @type {const} */ ([
  'bug',
  'idea',
  'deal',
  'other',
]);

export const INBOX_STATUSES = /** @type {const} */ ([
  'open',
  'in_progress',
  'resolved',
]);

/**
 * @typedef {'open'|'in_progress'|'resolved'} InboxStatus
 */

function getDb() {
  const db = globalThis._mongo?.db;
  if (!db) throw new Error('Database not connected.');
  return db;
}

export async function ensureSupportInboxIndexes() {
  const db = getDb();
  const reports = db.collection(USER_REPORTS_COLLECTION);
  const feedback = db.collection(USER_FEEDBACK_COLLECTION);
  const audit = db.collection(ADMIN_AUDIT_COLLECTION);

  await reports.createIndex({ status: 1, createdAt: -1 });
  await reports.createIndex({ userId: 1, createdAt: -1 });
  await reports.createIndex({ dealId: 1, createdAt: -1 });
  await feedback.createIndex({ status: 1, createdAt: -1 });
  await feedback.createIndex({ userId: 1, createdAt: -1 });
  await audit.createIndex({ createdAt: -1 });
  await ensureSupportChatIndexes();
}

function sanitizeStatus(value) {
  const key = String(value ?? 'open').trim().toLowerCase();
  return INBOX_STATUSES.includes(key) ? key : 'open';
}

function sanitizeReportType(value) {
  const key = String(value ?? 'other').trim().toLowerCase();
  return REPORT_TYPES.includes(key) ? key : 'other';
}

function sanitizeFeedbackCategory(value) {
  const key = String(value ?? 'other').trim().toLowerCase();
  return FEEDBACK_CATEGORIES.includes(key) ? key : 'other';
}

/**
 * @param {{
 *   userId: string,
 *   userEmail?: string|null,
 *   householdId?: string|null,
 *   type: string,
 *   message: string,
 *   dealId?: string|null,
 *   dealName?: string|null,
 *   store?: string|null,
 *   reportedPrice?: number|null,
 *   postcode?: string|null,
 * }} input
 */
export async function createUserReport(input) {
  const message = String(input.message ?? '').trim().slice(0, 2000);
  if (!message) {
    const err = new Error('Message is required.');
    err.status = 400;
    throw err;
  }

  const now = new Date();
  const doc = {
    userId: String(input.userId),
    userEmail: input.userEmail ? String(input.userEmail).slice(0, 160) : null,
    householdId: input.householdId ? String(input.householdId) : null,
    type: sanitizeReportType(input.type),
    message,
    dealId: input.dealId ? String(input.dealId).slice(0, 64) : null,
    dealName: input.dealName ? String(input.dealName).slice(0, 160) : null,
    store: input.store ? String(input.store).slice(0, 32) : null,
    reportedPrice:
      input.reportedPrice != null && Number.isFinite(Number(input.reportedPrice))
        ? Math.round(Number(input.reportedPrice) * 100) / 100
        : null,
    postcode: input.postcode ? String(input.postcode).slice(0, 8) : null,
    status: 'open',
    adminNotes: null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  };

  const result = await getDb().collection(USER_REPORTS_COLLECTION).insertOne(doc);
  return { id: result.insertedId.toString(), ...doc };
}

/**
 * @param {{
 *   userId: string,
 *   userEmail?: string|null,
 *   category: string,
 *   message: string,
 *   appVersion?: string|null,
 * }} input
 */
export async function createUserFeedback(input) {
  const message = String(input.message ?? '').trim().slice(0, 2000);
  if (!message) {
    const err = new Error('Message is required.');
    err.status = 400;
    throw err;
  }

  const now = new Date();
  const doc = {
    userId: String(input.userId),
    userEmail: input.userEmail ? String(input.userEmail).slice(0, 160) : null,
    category: sanitizeFeedbackCategory(input.category),
    message,
    appVersion: input.appVersion ? String(input.appVersion).slice(0, 32) : null,
    status: 'open',
    adminNotes: null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  };

  const result = await getDb().collection(USER_FEEDBACK_COLLECTION).insertOne(doc);
  return { id: result.insertedId.toString(), ...doc };
}

function mapInboxDoc(doc) {
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    userEmail: doc.userEmail ?? null,
    householdId: doc.householdId ?? null,
    type: doc.type ?? null,
    category: doc.category ?? null,
    message: doc.message,
    dealId: doc.dealId ?? null,
    dealName: doc.dealName ?? null,
    store: doc.store ?? null,
    reportedPrice: doc.reportedPrice ?? null,
    postcode: doc.postcode ?? null,
    appVersion: doc.appVersion ?? null,
    status: doc.status,
    adminNotes: doc.adminNotes ?? null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
    resolvedAt: doc.resolvedAt instanceof Date ? doc.resolvedAt.toISOString() : doc.resolvedAt,
  };
}

/**
 * @param {{ status?: string, limit?: number }} [options]
 */
export async function listUserReports(options = {}) {
  const query = {};
  if (options.status && INBOX_STATUSES.includes(options.status)) {
    query.status = options.status;
  }
  const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 200);

  const docs = await getDb()
    .collection(USER_REPORTS_COLLECTION)
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return docs.map(mapInboxDoc);
}

/**
 * @param {{ status?: string, limit?: number }} [options]
 */
export async function listUserFeedback(options = {}) {
  const query = {};
  if (options.status && INBOX_STATUSES.includes(options.status)) {
    query.status = options.status;
  }
  const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 200);

  const docs = await getDb()
    .collection(USER_FEEDBACK_COLLECTION)
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return docs.map(mapInboxDoc);
}

/**
 * @param {string} collectionName
 * @param {string} id
 * @param {{ status?: string, adminNotes?: string|null, adminUserId?: string|null }} patch
 */
export async function updateInboxItem(collectionName, id, patch) {
  const { ObjectId } = await import('mongodb');
  if (!ObjectId.isValid(id)) {
    const err = new Error('Invalid id.');
    err.status = 400;
    throw err;
  }

  const now = new Date();
  /** @type {Record<string, unknown>} */
  const update = { updatedAt: now };

  if (patch.status != null) {
    const status = sanitizeStatus(patch.status);
    update.status = status;
    if (status === 'resolved') update.resolvedAt = now;
    if (status === 'open') update.resolvedAt = null;
  }

  if (patch.adminNotes !== undefined) {
    update.adminNotes = patch.adminNotes ? String(patch.adminNotes).slice(0, 2000) : null;
  }

  const result = await getDb()
    .collection(collectionName)
    .findOneAndUpdate({ _id: new ObjectId(id) }, { $set: update }, { returnDocument: 'after' });

  if (!result) {
    const err = new Error('Item not found.');
    err.status = 404;
    throw err;
  }

  if (patch.adminUserId) {
    await getDb().collection(ADMIN_AUDIT_COLLECTION).insertOne({
      action: 'inbox_update',
      collection: collectionName,
      itemId: id,
      adminUserId: patch.adminUserId,
      patch: { status: update.status, adminNotes: update.adminNotes ?? undefined },
      createdAt: now,
    });
  }

  return mapInboxDoc(result);
}

/**
 * @param {Date} [now]
 */
export async function getSupportInboxCounts(now = new Date()) {
  const db = getDb();
  const reports = db.collection(USER_REPORTS_COLLECTION);
  const feedback = db.collection(USER_FEEDBACK_COLLECTION);
  const deals = db.collection(WEEKLY_DEALS_COLLECTION);

  const [openReports, openFeedback, unverifiedDeals, openSupportChats, unreadSupportChats] =
    await Promise.all([
      reports.countDocuments({ status: 'open' }),
      feedback.countDocuments({ status: 'open' }),
      deals.countDocuments({
        priceVerifiedAt: { $exists: false },
        $or: [{ storeExpiresAt: { $gte: now } }, { expiresAt: { $gte: now } }],
      }),
      countOpenSupportChats(),
      countUnreadSupportChatsForAdmin(),
    ]);

  return {
    openReports,
    openFeedback,
    unverifiedDeals,
    openSupportChats,
    unreadSupportChats,
  };
}
