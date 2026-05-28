import { ensureDb } from './ensureDb.js';
import { getEnvDiagnostics, getMongoUri } from './env.js';
import {
  generateHouseholdCode,
  getHouseholdState,
  normalizeHouseholdCode,
  updateHouseholdState,
} from './db.js';

function resolveHouseholdCode(req) {
  const headerCode = req.headers?.['x-household-code'];
  const queryCode = req.query?.householdCode;
  const bodyCode = req.body?.householdCode;
  return normalizeHouseholdCode(headerCode || queryCode || bodyCode);
}

export async function handleHealth(_req, res) {
  const resolved = getMongoUri();
  const diagnostics = getEnvDiagnostics();

  if (resolved.error) {
    res.status(200).json({
      ok: false,
      connected: false,
      message: resolved.error,
      diagnostics,
    });
    return;
  }

  try {
    await ensureDb();
    res.status(200).json({
      ok: true,
      connected: true,
      source: resolved.source,
      diagnostics,
    });
  } catch (err) {
    res.status(200).json({
      ok: false,
      connected: false,
      message: err.message || 'Could not connect to MongoDB Atlas.',
      source: resolved.source,
      diagnostics,
    });
  }
}

export async function handleGetState(req, res) {
  await ensureDb();
  const householdCode = resolveHouseholdCode(req) || generateHouseholdCode();
  const state = await getHouseholdState(householdCode);
  res.status(200).json(state);
}

export async function handlePutState(req, res) {
  const { items, settings, savedRecipeIds, onboarding } = req.body ?? {};
  const householdCode = resolveHouseholdCode(req);
  if (!householdCode) {
    res.status(400).json({ error: 'householdCode is required.' });
    return;
  }
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
  const state = await updateHouseholdState(householdCode, partial);
  res.status(200).json(state);
}
