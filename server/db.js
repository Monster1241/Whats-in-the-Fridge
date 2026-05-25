import { MongoClient } from 'mongodb';

const DB_NAME = 'whats-in-the-fridge';
const COLLECTION = 'households';
const HOUSEHOLD_ID = 'default';

const globalForMongo = globalThis;

export function generateHouseholdCode() {
  const suffix = Math.floor(1000 + Math.random() * 9000);
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

export async function getHouseholdState() {
  const collection = getDb().collection(COLLECTION);
  let doc = await collection.findOne({ _id: HOUSEHOLD_ID });

  if (!doc) {
    doc = {
      _id: HOUSEHOLD_ID,
      ...EMPTY_STATE,
      householdCode: generateHouseholdCode(),
      updatedAt: new Date(),
    };
    await collection.insertOne(doc);
  }

  if (!doc.householdCode) {
    doc.householdCode = generateHouseholdCode();
    await collection.updateOne(
      { _id: HOUSEHOLD_ID },
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

export async function updateHouseholdState(partial) {
  const collection = getDb().collection(COLLECTION);
  const update = { updatedAt: new Date() };

  if (partial.items !== undefined) update.items = partial.items;
  if (partial.settings !== undefined) update.settings = partial.settings;
  if (partial.savedRecipeIds !== undefined) update.savedRecipeIds = partial.savedRecipeIds;
  if (partial.onboarding !== undefined) update.onboarding = partial.onboarding;
  if (partial.householdCode !== undefined) update.householdCode = partial.householdCode;

  await collection.updateOne(
    { _id: HOUSEHOLD_ID },
    { $set: update },
    { upsert: true },
  );

  return getHouseholdState();
}

export async function closeDb() {
  if (globalForMongo._mongo?.client) {
    await globalForMongo._mongo.client.close();
    globalForMongo._mongo = null;
  }
}
