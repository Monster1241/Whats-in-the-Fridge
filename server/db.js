import { MongoClient } from 'mongodb';

const DB_NAME = 'whats-in-the-fridge';
const COLLECTION = 'households';
const HOUSEHOLD_ID = 'default';

let client;
let db;

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
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(DB_NAME);
  return db;
}

export async function getHouseholdState() {
  const collection = db.collection(COLLECTION);
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
  const collection = db.collection(COLLECTION);
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
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
