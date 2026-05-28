import { MongoClient } from 'mongodb';

const DB_NAME = 'whats-in-the-fridge';
const COLLECTION = 'households';
const HOUSEHOLD_PREFIX = 'household:';
const LEGACY_DEFAULT_ID = 'default';

const globalForMongo = globalThis;

export function generateHouseholdCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 8; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `FRIDGE-${suffix}`;
}

export const EMPTY_STATE = {
  items: [],
  settings: {
    theme: 'light',
    user: { name: '', email: '' },
  },
  savedRecipeIds: [],
  onboarding: { dismissed: [] },
  householdCode: null,
};

export async function connectDb(uri) {
  if (globalForMongo._mongo?.db) {
    return globalForMongo._mongo.db;
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(DB_NAME);
  globalForMongo._mongo = { client, db };
  return db;
}

function getDb() {
  const db = globalForMongo._mongo?.db;
  if (!db) {
    throw new Error('Database not connected. Call connectDb() first.');
  }
  return db;
}

export function normalizeHouseholdCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase();
}

function householdIdForCode(code) {
  return `${HOUSEHOLD_PREFIX}${normalizeHouseholdCode(code)}`;
}

export async function getHouseholdState(householdCode) {
  const normalizedCode = normalizeHouseholdCode(householdCode);
  if (!normalizedCode) {
    throw new Error('householdCode is required.');
  }

  const collection = getDb().collection(COLLECTION);
  let doc = await collection.findOne({ _id: householdIdForCode(normalizedCode) });

  if (!doc) {
    const legacyDoc = await collection.findOne({ _id: LEGACY_DEFAULT_ID });
    const code = normalizedCode;
    doc = {
      ...EMPTY_STATE,
      ...(legacyDoc || {}),
      _id: householdIdForCode(code),
      householdCode: code,
      updatedAt: new Date(),
    };
    await collection.insertOne(doc);
  }

  if (!doc.householdCode) {
    doc.householdCode = normalizedCode;
    await collection.updateOne(
      { _id: doc._id },
      { $set: { householdCode: doc.householdCode, updatedAt: new Date() } },
    );
  }

  return {
    items: doc.items ?? [],
    settings: { ...EMPTY_STATE.settings, ...doc.settings },
    savedRecipeIds: doc.savedRecipeIds ?? [],
    onboarding: doc.onboarding ?? { dismissed: [] },
    householdCode: doc.householdCode,
    updatedAt: doc.updatedAt,
  };
}

export async function updateHouseholdState(householdCode, partial) {
  const normalizedCode = normalizeHouseholdCode(householdCode);
  if (!normalizedCode) {
    throw new Error('householdCode is required.');
  }

  const collection = getDb().collection(COLLECTION);
  const update = { updatedAt: new Date() };

  if (partial.items !== undefined) update.items = partial.items;
  if (partial.settings !== undefined) update.settings = partial.settings;
  if (partial.savedRecipeIds !== undefined) update.savedRecipeIds = partial.savedRecipeIds;
  if (partial.onboarding !== undefined) update.onboarding = partial.onboarding;
  await collection.updateOne(
    { _id: householdIdForCode(normalizedCode) },
    { $set: { ...update, householdCode: normalizedCode }, $setOnInsert: { ...EMPTY_STATE } },
    { upsert: true },
  );

  return getHouseholdState(normalizedCode);
}

export async function closeDb() {
  if (globalForMongo._mongo?.client) {
    await globalForMongo._mongo.client.close();
    globalForMongo._mongo = null;
  }
}
