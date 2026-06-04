import { MongoClient, ObjectId } from 'mongodb';
import { DEFAULT_ENABLED_MODULES, normalizeEnabledModules, validateEnabledModules } from './enabledModules.js';

const DB_NAME = 'whats-in-the-fridge';

const globalForMongo = globalThis;

export const DEFAULT_SETTINGS = {
  theme: 'light',
  user: { name: '', email: '' },
};

export function generateInviteCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const pick = (pool) => pool[Math.floor(Math.random() * pool.length)];
  return `${pick(letters)}${pick(letters)}${pick(letters)}-${pick(digits)}${pick(digits)}${pick(digits)}`;
}

export function normalizeInviteCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/** Reject malformed household ids before any inventory or household-scoped query. */
export function assertScopedHouseholdId(householdId) {
  const id = String(householdId ?? '').trim();
  if (!ObjectId.isValid(id)) {
    const err = new Error('Invalid household scope.');
    err.status = 400;
    throw err;
  }
  return id;
}

export function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function mapUserDoc(doc) {
  if (!doc) return null;
  const isVerified = doc.isVerified === undefined ? true : Boolean(doc.isVerified);
  return {
    id: doc._id.toString(),
    email: doc.email,
    password_hash: doc.password_hash,
    household_id: doc.household_id ? doc.household_id.toString() : null,
    isVerified,
    verificationCode: doc.verificationCode ?? null,
  };
}

export async function connectDb(uri) {
  if (globalForMongo._mongo?.db) {
    return globalForMongo._mongo.db;
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(DB_NAME);
  globalForMongo._mongo = { client, db };
  await ensureIndexesSafe(db);
  return db;
}

async function pickUniqueInviteCode(households) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const invite_code = generateInviteCode();
    const existing = await households.findOne({ invite_code });
    if (!existing) return invite_code;
  }
  throw new Error('Could not generate a unique invite code.');
}

/** Backfill legacy household docs that predate invite_code (fixes E11000 dup key: null). */
async function migrateLegacyHouseholds(db) {
  const households = db.collection('households');
  const legacy = await households
    .find({
      $or: [
        { invite_code: { $exists: false } },
        { invite_code: null },
        { invite_code: '' },
      ],
    })
    .toArray();

  for (const doc of legacy) {
    let invite_code;
    if (doc.householdCode) {
      const normalized = normalizeInviteCode(doc.householdCode);
      const taken = await households.findOne({
        invite_code: normalized,
        _id: { $ne: doc._id },
      });
      invite_code = taken ? await pickUniqueInviteCode(households) : normalized;
    } else {
      invite_code = await pickUniqueInviteCode(households);
    }

    await households.updateOne(
      { _id: doc._id },
      {
        $set: { invite_code },
        $unset: { householdCode: '' },
      },
    );
  }
}

async function ensureIndexes(db) {
  await migrateLegacyHouseholds(db);

  const households = db.collection('households');
  try {
    await households.dropIndex('invite_code_1');
  } catch {
    // Index may not exist yet.
  }

  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await households.createIndex(
    { invite_code: 1 },
    {
      unique: true,
      partialFilterExpression: { invite_code: { $type: 'string' } },
    },
  );
  await db.collection('inventory').createIndex({ household_id: 1 });
}

async function ensureIndexesSafe(db) {
  if (globalForMongo._indexesReady) return;
  try {
    await ensureIndexes(db);
    globalForMongo._indexesReady = true;
  } catch (err) {
    console.error('[db] Index setup failed (app will still run):', err.message);
    globalForMongo._indexesReady = true;
  }
}

function getDb() {
  const db = globalForMongo._mongo?.db;
  if (!db) {
    throw new Error('Database not connected. Call connectDb() first.');
  }
  return db;
}

export async function createUser({
  email,
  passwordHash = null,
  firebaseUid = null,
  isVerified = true,
}) {
  const users = getDb().collection('users');
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await users.findOne({ email: normalizedEmail });
  if (existing) {
    const err = new Error('An account with this email already exists.');
    err.status = 409;
    throw err;
  }

  if (!passwordHash && !firebaseUid) {
    const err = new Error('Account credentials are missing.');
    err.status = 400;
    throw err;
  }

  const doc = {
    email: normalizedEmail,
    household_id: null,
    isVerified: Boolean(isVerified),
    fcmTokens: [],
    created_at: new Date(),
  };
  if (passwordHash) doc.password_hash = passwordHash;
  if (firebaseUid) doc.firebase_uid = firebaseUid;

  const result = await users.insertOne(doc);
  return mapUserDoc({ ...doc, _id: result.insertedId });
}

export async function findUserByFirebaseUid(firebaseUid) {
  if (!firebaseUid) return null;
  const users = getDb().collection('users');
  const doc = await users.findOne({ firebase_uid: firebaseUid });
  return mapUserDoc(doc);
}

export async function linkUserFirebaseAccount(userId, firebaseUid, isVerified) {
  const users = getDb().collection('users');
  const result = await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        firebase_uid: firebaseUid,
        isVerified: Boolean(isVerified),
        updated_at: new Date(),
      },
    },
  );
  if (result.matchedCount === 0) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }
  return findUserById(userId);
}

export async function findUserByEmail(email) {
  const users = getDb().collection('users');
  const doc = await users.findOne({ email: email.trim().toLowerCase() });
  return mapUserDoc(doc);
}

/**
 * Appends a Web Push FCM token for the user (deduplicated).
 * @param {string} userId
 * @param {string} token
 */
export async function addFcmTokenToUser(userId, token) {
  const users = getDb().collection('users');
  const result = await users.updateOne(
    { _id: new ObjectId(userId) },
    { $addToSet: { fcmTokens: token } },
  );
  if (result.matchedCount === 0) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }
}

export async function findUserById(userId) {
  const users = getDb().collection('users');
  let oid;
  try {
    oid = new ObjectId(userId);
  } catch {
    return null;
  }
  const doc = await users.findOne({ _id: oid });
  return mapUserDoc(doc);
}

/** Marks legacy unverified accounts as verified (verification step disabled for now). */
export async function markUserVerified(userId) {
  const users = getDb().collection('users');
  await users.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { isVerified: true }, $unset: { verificationCode: '' } },
  );
  return findUserById(userId);
}

export async function verifyUserEmail(userId, code) {
  const users = getDb().collection('users');
  const doc = await users.findOne({ _id: new ObjectId(userId) });
  if (!doc) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }

  if (doc.isVerified === true || (doc.isVerified === undefined && !doc.verificationCode)) {
    return mapUserDoc(doc);
  }

  const submitted = String(code || '').trim();
  if (submitted !== String(doc.verificationCode)) {
    const err = new Error('Invalid verification code.');
    err.status = 400;
    throw err;
  }

  await users.updateOne(
    { _id: doc._id },
    { $set: { isVerified: true }, $unset: { verificationCode: '' } },
  );

  return mapUserDoc({
    ...doc,
    isVerified: true,
    verificationCode: null,
  });
}

export async function setUserHousehold(userId, householdId) {
  const users = getDb().collection('users');
  await users.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { household_id: new ObjectId(householdId) } },
  );
}

export async function clearUserHousehold(userId) {
  const users = getDb().collection('users');
  await users.updateOne(
    { _id: new ObjectId(userId) },
    { $unset: { household_id: '' } },
  );
}

async function ensureHouseholdOwnerId(householdId) {
  const households = getDb().collection('households');
  const householdOid = new ObjectId(householdId);
  const doc = await households.findOne({ _id: householdOid });
  if (!doc) return null;
  if (doc.owner_id) return doc.owner_id.toString();

  const users = getDb().collection('users');
  const first = await users.findOne(
    { household_id: householdOid },
    { sort: { created_at: 1 } },
  );
  if (!first) return null;

  await households.updateOne(
    { _id: householdOid },
    { $set: { owner_id: first._id, updated_at: new Date() } },
  );
  return first._id.toString();
}

export async function isHouseholdOwner(householdId, userId) {
  const ownerId = await ensureHouseholdOwnerId(householdId);
  return ownerId === userId;
}

export async function getHouseholdMembers(householdId) {
  const ownerId = await ensureHouseholdOwnerId(householdId);
  const users = getDb().collection('users');
  const docs = await users
    .find({ household_id: new ObjectId(householdId) })
    .sort({ created_at: 1 })
    .toArray();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    email: doc.email,
    isOwner: doc._id.toString() === ownerId,
    joinedAt: doc.created_at,
  }));
}

export async function leaveHousehold(userId) {
  const users = getDb().collection('users');
  const userOid = new ObjectId(userId);
  const doc = await users.findOne({ _id: userOid });
  if (!doc?.household_id) {
    const err = new Error('You are not in a household.');
    err.status = 400;
    throw err;
  }

  const householdId = doc.household_id.toString();
  const householdOid = doc.household_id;
  const ownerId = await ensureHouseholdOwnerId(householdId);
  const isOwner = ownerId === userId;

  await clearUserHousehold(userId);

  const remaining = await users
    .find({ household_id: householdOid })
    .sort({ created_at: 1 })
    .toArray();

  if (remaining.length === 0) {
    await deleteHouseholdData(householdId);
    return { householdDeleted: true };
  }

  if (isOwner) {
    const households = getDb().collection('households');
    await households.updateOne(
      { _id: householdOid },
      { $set: { owner_id: remaining[0]._id, updated_at: new Date() } },
    );
  }

  return { householdDeleted: false };
}

export async function removeHouseholdMember(requesterId, targetUserId) {
  if (requesterId === targetUserId) {
    const err = new Error('Use leave household to remove yourself.');
    err.status = 400;
    throw err;
  }

  const users = getDb().collection('users');
  const requester = await users.findOne({ _id: new ObjectId(requesterId) });
  if (!requester?.household_id) {
    const err = new Error('You are not in a household.');
    err.status = 400;
    throw err;
  }

  const householdId = requester.household_id.toString();
  const isOwner = await isHouseholdOwner(householdId, requesterId);
  if (!isOwner) {
    const err = new Error('Only the household owner can remove members.');
    err.status = 403;
    throw err;
  }

  const target = await users.findOne({ _id: new ObjectId(targetUserId) });
  if (!target?.household_id || target.household_id.toString() !== householdId) {
    const err = new Error('That person is not in your household.');
    err.status = 404;
    throw err;
  }

  await clearUserHousehold(targetUserId);
  return { removedUserId: targetUserId };
}

export async function createHousehold(ownerUserId) {
  const households = getDb().collection('households');
  const invite_code = await pickUniqueInviteCode(households);
  const doc = {
    invite_code,
    owner_id: new ObjectId(ownerUserId),
    created_at: new Date(),
    settings: { ...DEFAULT_SETTINGS },
    enabledModules: { ...DEFAULT_ENABLED_MODULES },
    savedRecipeIds: [],
    onboarding: { dismissed: [] },
  };
  const result = await households.insertOne(doc);
  return {
    id: result.insertedId.toString(),
    invite_code,
    owner_id: ownerUserId,
    created_at: doc.created_at,
  };
}

export async function findHouseholdByInviteCode(inviteCode) {
  const households = getDb().collection('households');
  const normalized = normalizeInviteCode(inviteCode);
  const doc = await households.findOne({ invite_code: normalized });
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    invite_code: doc.invite_code,
    created_at: doc.created_at,
  };
}

export async function getHouseholdMeta(householdId) {
  const scopedId = assertScopedHouseholdId(householdId);
  const households = getDb().collection('households');
  const doc = await households.findOne({ _id: new ObjectId(scopedId) });
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    invite_code: doc.invite_code,
    settings: { ...DEFAULT_SETTINGS, ...doc.settings },
    enabledModules: normalizeEnabledModules(doc.enabledModules),
    savedRecipeIds: doc.savedRecipeIds ?? [],
    onboarding: doc.onboarding ?? { dismissed: [] },
  };
}

export async function getInventoryForHousehold(householdId) {
  const scopedId = assertScopedHouseholdId(householdId);
  const inventory = getDb().collection('inventory');
  const docs = await inventory.find({ household_id: scopedId }).toArray();
  return docs.map(({ _id, household_id, ...item }) => ({
    ...item,
    id: item.id || _id.toString(),
  }));
}

export async function getHouseholdAppState(householdId) {
  const scopedId = assertScopedHouseholdId(householdId);
  const meta = await getHouseholdMeta(scopedId);
  if (!meta) {
    const err = new Error('Household not found.');
    err.status = 404;
    throw err;
  }
  const items = await getInventoryForHousehold(scopedId);
  return {
    items,
    settings: meta.settings,
    enabledModules: meta.enabledModules,
    savedRecipeIds: meta.savedRecipeIds,
    onboarding: meta.onboarding,
    householdCode: meta.invite_code,
    inviteCode: meta.invite_code,
  };
}

export async function updateHouseholdAppState(householdId, partial) {
  const scopedId = assertScopedHouseholdId(householdId);
  const households = getDb().collection('households');
  const householdOid = new ObjectId(scopedId);
  const existing = await households.findOne({ _id: householdOid });
  if (!existing) {
    const err = new Error('Household not found.');
    err.status = 404;
    throw err;
  }

  const householdUpdate = { updated_at: new Date() };
  if (partial.settings !== undefined) householdUpdate.settings = partial.settings;
  if (partial.enabledModules !== undefined) {
    householdUpdate.enabledModules = validateEnabledModules(partial.enabledModules);
  }
  if (partial.savedRecipeIds !== undefined) householdUpdate.savedRecipeIds = partial.savedRecipeIds;
  if (partial.onboarding !== undefined) householdUpdate.onboarding = partial.onboarding;

  if (Object.keys(householdUpdate).length > 1) {
    await households.updateOne({ _id: householdOid }, { $set: householdUpdate });
  }

  if (partial.items !== undefined) {
    await replaceInventoryForHousehold(scopedId, partial.items);
  }

  return getHouseholdAppState(scopedId);
}

export async function replaceInventoryForHousehold(householdId, items) {
  const scopedId = assertScopedHouseholdId(householdId);
  const inventory = getDb().collection('inventory');
  await inventory.deleteMany({ household_id: scopedId });
  if (!Array.isArray(items) || items.length === 0) return;

  const docs = items.map((item) => ({
    id: item.id,
    name: item.name,
    itemType:
      item.itemType === 'Household'
        ? 'Household'
        : item.itemType === 'Baby'
          ? 'Baby'
          : 'Food',
    category: item.category,
    status: item.status,
    expiryDate: item.expiryDate ?? null,
    preferredStore: item.preferredStore ?? null,
    household_id: scopedId,
    updated_at: new Date(),
  }));
  await inventory.insertMany(docs);
}

export async function deleteHouseholdData(householdId) {
  const scopedId = assertScopedHouseholdId(householdId);
  const db = getDb();
  const householdOid = new ObjectId(scopedId);
  await db.collection('inventory').deleteMany({ household_id: scopedId });
  await db.collection('households').deleteOne({ _id: householdOid });
}

/**
 * Deletes the user. If they are the only member of a household, removes that household and inventory too.
 */
export async function deleteUserAccount(userId) {
  const users = getDb().collection('users');
  const userOid = new ObjectId(userId);
  const doc = await users.findOne({ _id: userOid });
  if (!doc) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }

  let householdRemoved = false;

  if (doc.household_id) {
    const householdId = doc.household_id.toString();
    const otherMembers = await users.countDocuments({
      household_id: doc.household_id,
      _id: { $ne: userOid },
    });
    await users.deleteOne({ _id: userOid });
    if (otherMembers === 0) {
      await deleteHouseholdData(householdId);
      householdRemoved = true;
    }
  } else {
    await users.deleteOne({ _id: userOid });
  }

  return { householdRemoved };
}

export async function closeDb() {
  if (globalForMongo._mongo?.client) {
    await globalForMongo._mongo.client.close();
    globalForMongo._mongo = null;
  }
}
