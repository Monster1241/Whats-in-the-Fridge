import { ensureDb } from './ensureDb.js';
import { getHouseholdState, updateHouseholdState } from './db.js';

export async function handleHealth(_req, res) {
  res.status(200).json({
    ok: true,
    connected: Boolean(process.env.MONGODB_URI?.trim()),
  });
}

export async function handleGetState(_req, res) {
  await ensureDb();
  const state = await getHouseholdState();
  res.status(200).json(state);
}

export async function handlePutState(req, res) {
  const { items, settings, savedRecipeIds, onboarding } = req.body ?? {};
  const partial = {};

  if (items !== undefined) {
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'items must be an array' });
      return;
    }
    partial.items = items;
  }
  if (settings !== undefined) partial.settings = settings;
  if (savedRecipeIds !== undefined) {
    if (!Array.isArray(savedRecipeIds)) {
      res.status(400).json({ error: 'savedRecipeIds must be an array' });
      return;
    }
    partial.savedRecipeIds = savedRecipeIds;
  }
  if (onboarding !== undefined) partial.onboarding = onboarding;

  await ensureDb();
  const state = await updateHouseholdState(partial);
  res.status(200).json(state);
}
