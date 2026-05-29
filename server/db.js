import { MongoClient, ObjectId } from 'mongodb';

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

export async function connectDb(uri) {
  if (globalForMongo._mongo?.db) {
    return globalForMongo._mongo.db;
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(DB_NAME);
  globalForMongo._mongo = { client, db };
  await ensureIndexes(db);
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

function getDb() {
  const db = globalForMongo._mongo?.db;
  if (!db) {
    throw new Error('Database not connected. Call connectDb() first.');
  }
  return db;
}

export async function createUser({ email, passwordHash }) {
  const users = getDb().collection('users');
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await users.findOne({ email: normalizedEmail });
  if (existing) {
    const err = new Error('An account with this email already exists.');
    err.status = 409;
    throw err;
  }
  const doc = {
    email: normalizedEmail,
    password_hash: passwordHash,
    household_id: null,
    created_at: new Date(),
  };
  const result = await users.insertOne(doc);
  return {
    id: result.insertedId.toString(),
    email: doc.email,
    household_id: null,
  };
}

export async function findUserByEmail(email) {
  const users = getDb().collection('users');
  const doc = await users.findOne({ email: email.trim().toLowerCase() });
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    email: doc.email,
    password_hash: doc.password_hash,
    household_id: doc.household_id ? doc.household_id.toString() : null,
  };
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
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    email: doc.email,
    household_id: doc.household_id ? doc.household_id.toString() : null,
  };
}

export async function setUserHousehold(userId, householdId) {
  const users = getDb().collection('users');
  await users.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { household_id: new ObjectId(householdId) } },
  );
}

export async function createHousehold() {
  const households = getDb().collection('households');
  const invite_code = await pickUniqueInviteCode(households);
  const doc = {
    invite_code,
    created_at: new Date(),
    settings: { ...DEFAULT_SETTINGS },
    savedRecipeIds: [],
    onboarding: { dismissed: [] },
  };
  const result = await households.insertOne(doc);
  return {
    id: result.insertedId.toString(),
    invite_code,
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
  const households = getDb().collection('households');
  const doc = await households.findOne({ _id: new ObjectId(householdId) });
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    invite_code: doc.invite_code,
    settings: { ...DEFAULT_SETTINGS, ...doc.settings },
    savedRecipeIds: doc.savedRecipeIds ?? [],
    onboarding: doc.onboarding ?? { dismissed: [] },
  };
}

export async function getInventoryForHousehold(householdId) {
  const inventory = getDb().collection('inventory');
  const docs = await inventory.find({ household_id: householdId }).toArray();
  return docs.map(({ _id, household_id, ...item }) => ({
    ...item,
    id: item.id || _id.toString(),
  }));
}

export async function getHouseholdAppState(householdId) {
  const meta = await getHouseholdMeta(householdId);
  if (!meta) {
    const err = new Error('Household not found.');
    err.status = 404;
    throw err;
  }
  const items = await getInventoryForHousehold(householdId);
  return {
    items,
    settings: meta.settings,
    savedRecipeIds: meta.savedRecipeIds,
    onboarding: meta.onboarding,
    householdCode: meta.invite_code,
    inviteCode: meta.invite_code,
  };
}

export async function updateHouseholdAppState(householdId, partial) {
  const households = getDb().collection('households');
  const householdOid = new ObjectId(householdId);
  const existing = await households.findOne({ _id: householdOid });
  if (!existing) {
    const err = new Error('Household not found.');
    err.status = 404;
    throw err;
  }

  const householdUpdate = { updated_at: new Date() };
  if (partial.settings !== undefined) householdUpdate.settings = partial.settings;
  if (partial.savedRecipeIds !== undefined) householdUpdate.savedRecipeIds = partial.savedRecipeIds;
  if (partial.onboarding !== undefined) householdUpdate.onboarding = partial.onboarding;

  if (Object.keys(householdUpdate).length > 1) {
    await households.updateOne({ _id: householdOid }, { $set: householdUpdate });
  }

  if (partial.items !== undefined) {
    await replaceInventoryForHousehold(householdId, partial.items);
  }

  return getHouseholdAppState(householdId);
}

export async function replaceInventoryForHousehold(householdId, items) {
  const inventory = getDb().collection('inventory');
  await inventory.deleteMany({ household_id: householdId });
  if (!Array.isArray(items) || items.length === 0) return;

  const docs = items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    status: item.status,
    expiryDate: item.expiryDate ?? null,
    household_id: householdId,
    updated_at: new Date(),
  }));
  await inventory.insertMany(docs);
}

export async function closeDb() {
  if (globalForMongo._mongo?.client) {
    await globalForMongo._mongo.client.close();
    globalForMongo._mongo = null;
  }
}
