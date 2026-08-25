import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';

export const SUPPORT_THREADS_COLLECTION = 'supportThreads';

export const SUPPORT_THREAD_STATUSES = /** @type {const} */ ([
  'open',
  'waiting_admin',
  'in_progress',
  'resolved',
]);

export const SUPPORT_CATEGORIES = /** @type {const} */ ([
  'account',
  'inventory',
  'deals',
  'bug',
  'billing',
  'other',
]);

export const SUPPORT_SEVERITIES = /** @type {const} */ (['low', 'medium', 'high']);

const WELCOME_MESSAGE =
  "Message the Fridge support team here — lost items, two accounts, login issues, deals, or bugs. We'll reply when we're available; add as much detail as you can.";

function getDb() {
  const db = globalThis._mongo?.db;
  if (!db) throw new Error('Database not connected.');
  return db;
}

export async function ensureSupportChatIndexes() {
  const threads = getDb().collection(SUPPORT_THREADS_COLLECTION);
  await threads.createIndex({ userId: 1 }, { unique: true });
  await threads.createIndex({ status: 1, lastMessageAt: -1 });
  await threads.createIndex({ unreadForAdmin: 1, lastMessageAt: -1 });
}

function sanitizeStatus(value) {
  const key = String(value ?? 'open').trim().toLowerCase();
  return SUPPORT_THREAD_STATUSES.includes(key) ? key : 'open';
}

function sanitizeCategory(value) {
  const key = String(value ?? 'other').trim().toLowerCase();
  return SUPPORT_CATEGORIES.includes(key) ? key : 'other';
}

function sanitizeSeverity(value) {
  const key = String(value ?? 'medium').trim().toLowerCase();
  return SUPPORT_SEVERITIES.includes(key) ? key : 'medium';
}

function buildMessage({ role, body, createdAt = new Date() }) {
  const text = String(body ?? '').trim().slice(0, 4000);
  if (!text) {
    const err = new Error('Message is required.');
    err.status = 400;
    throw err;
  }
  return {
    id: randomUUID(),
    role,
    body: text,
    createdAt,
  };
}

/**
 * @param {import('mongodb').WithId<import('mongodb').Document>} doc
 */
export function mapSupportThread(doc, { includeMessages = true } = {}) {
  if (!doc) return null;
  const messages = Array.isArray(doc.messages) ? doc.messages : [];
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    userEmail: doc.userEmail ?? null,
    householdId: doc.householdId ?? null,
    status: doc.status ?? 'open',
    category: doc.category ?? 'other',
    severity: doc.severity ?? 'medium',
    unreadForAdmin: Number(doc.unreadForAdmin ?? 0),
    unreadForUser: Number(doc.unreadForUser ?? 0),
    lastMessageAt:
      doc.lastMessageAt instanceof Date
        ? doc.lastMessageAt.toISOString()
        : doc.lastMessageAt ?? null,
    createdAt:
      doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt ?? null,
    updatedAt:
      doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt ?? null,
    messageCount: messages.length,
    preview: messages.length ? messages[messages.length - 1].body : null,
    messages: includeMessages
      ? messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          body: msg.body,
          createdAt:
            msg.createdAt instanceof Date
              ? msg.createdAt.toISOString()
              : msg.createdAt ?? null,
        }))
      : undefined,
  };
}

/**
 * @param {{ userId: string, userEmail?: string|null, householdId?: string|null }} user
 */
export async function getOrCreateSupportThread(user) {
  const threads = getDb().collection(SUPPORT_THREADS_COLLECTION);
  const userId = String(user.userId);
  let doc = await threads.findOne({ userId });

  if (!doc) {
    const now = new Date();
    const welcome = buildMessage({
      role: 'admin',
      body: WELCOME_MESSAGE,
      createdAt: now,
    });
    const insert = {
      userId,
      userEmail: user.userEmail ? String(user.userEmail).slice(0, 160) : null,
      householdId: user.householdId ? String(user.householdId) : null,
      status: 'open',
      category: 'other',
      severity: 'medium',
      unreadForAdmin: 0,
      unreadForUser: 0,
      messages: [welcome],
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const result = await threads.insertOne(insert);
    doc = { _id: result.insertedId, ...insert };
  } else if (user.userEmail || user.householdId) {
    await threads.updateOne(
      { _id: doc._id },
      {
        $set: {
          ...(user.userEmail ? { userEmail: String(user.userEmail).slice(0, 160) } : {}),
          ...(user.householdId ? { householdId: String(user.householdId) } : {}),
          updatedAt: new Date(),
        },
      },
    );
    doc = await threads.findOne({ _id: doc._id });
  }

  return mapSupportThread(doc);
}

/**
 * @param {string} userId
 */
export async function getSupportThreadForUser(userId) {
  const doc = await getDb()
    .collection(SUPPORT_THREADS_COLLECTION)
    .findOne({ userId: String(userId) });
  return mapSupportThread(doc);
}

/**
 * @param {string} threadId
 */
export async function getSupportThreadById(threadId) {
  if (!ObjectId.isValid(threadId)) {
    const err = new Error('Invalid thread id.');
    err.status = 400;
    throw err;
  }
  const doc = await getDb()
    .collection(SUPPORT_THREADS_COLLECTION)
    .findOne({ _id: new ObjectId(threadId) });
  if (!doc) {
    const err = new Error('Support chat not found.');
    err.status = 404;
    throw err;
  }
  return mapSupportThread(doc);
}

/**
 * @param {string} threadId
 * @param {{ role: 'user'|'admin', body: string, status?: string, bumpUnreadFor?: 'admin'|'user'|null }} input
 */
export async function appendSupportMessage(threadId, input) {
  if (!ObjectId.isValid(threadId)) {
    const err = new Error('Invalid thread id.');
    err.status = 400;
    throw err;
  }

  const now = new Date();
  const message = buildMessage({
    role: input.role,
    body: input.body,
    createdAt: now,
  });

  /** @type {Record<string, unknown>} */
  const $set = {
    lastMessageAt: now,
    updatedAt: now,
  };
  if (input.status) $set.status = sanitizeStatus(input.status);

  /** @type {Record<string, unknown>} */
  const $inc = {};
  if (input.bumpUnreadFor === 'admin') $inc.unreadForAdmin = 1;
  if (input.bumpUnreadFor === 'user') $inc.unreadForUser = 1;

  /** @type {import('mongodb').UpdateFilter<import('mongodb').Document>} */
  const update = {
    $push: { messages: message },
    $set,
  };
  if (Object.keys($inc).length) update.$inc = $inc;

  const result = await getDb()
    .collection(SUPPORT_THREADS_COLLECTION)
    .findOneAndUpdate({ _id: new ObjectId(threadId) }, update, { returnDocument: 'after' });

  if (!result) {
    const err = new Error('Support chat not found.');
    err.status = 404;
    throw err;
  }

  return mapSupportThread(result);
}

/**
 * @param {string} threadId
 * @param {'admin'|'user'} reader
 */
export async function markSupportThreadRead(threadId, reader) {
  if (!ObjectId.isValid(threadId)) {
    const err = new Error('Invalid thread id.');
    err.status = 400;
    throw err;
  }

  const field = reader === 'admin' ? 'unreadForAdmin' : 'unreadForUser';
  const result = await getDb()
    .collection(SUPPORT_THREADS_COLLECTION)
    .findOneAndUpdate(
      { _id: new ObjectId(threadId) },
      { $set: { [field]: 0, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );

  if (!result) {
    const err = new Error('Support chat not found.');
    err.status = 404;
    throw err;
  }

  return mapSupportThread(result);
}

/**
 * @param {string} threadId
 * @param {{ status?: string, category?: string, severity?: string }} patch
 */
export async function updateSupportThread(threadId, patch) {
  if (!ObjectId.isValid(threadId)) {
    const err = new Error('Invalid thread id.');
    err.status = 400;
    throw err;
  }

  /** @type {Record<string, unknown>} */
  const $set = { updatedAt: new Date() };
  if (patch.status != null) $set.status = sanitizeStatus(patch.status);
  if (patch.category != null) $set.category = sanitizeCategory(patch.category);
  if (patch.severity != null) $set.severity = sanitizeSeverity(patch.severity);

  const result = await getDb()
    .collection(SUPPORT_THREADS_COLLECTION)
    .findOneAndUpdate({ _id: new ObjectId(threadId) }, { $set }, { returnDocument: 'after' });

  if (!result) {
    const err = new Error('Support chat not found.');
    err.status = 404;
    throw err;
  }

  return mapSupportThread(result);
}

/**
 * @param {{ status?: string, limit?: number }} [options]
 */
export async function listSupportThreads(options = {}) {
  const query = {};
  if (options.status) query.status = sanitizeStatus(options.status);
  const limit = Math.min(Math.max(Number(options.limit) || 80, 1), 200);

  const docs = await getDb()
    .collection(SUPPORT_THREADS_COLLECTION)
    .find(query)
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .toArray();

  return docs.map((doc) => mapSupportThread(doc, { includeMessages: false }));
}

export async function countOpenSupportChats() {
  return getDb().collection(SUPPORT_THREADS_COLLECTION).countDocuments({
    status: { $in: ['open', 'waiting_admin', 'in_progress'] },
  });
}

export async function countUnreadSupportChatsForAdmin() {
  return getDb().collection(SUPPORT_THREADS_COLLECTION).countDocuments({
    unreadForAdmin: { $gt: 0 },
  });
}
