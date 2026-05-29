import { ensureDb } from './ensureDb.js';
import { getEnvDiagnostics, getMongoUri } from './env.js';
import { getBearerUser, hashPassword, signToken, verifyPassword } from './auth.js';
import {
  createHousehold,
  createUser,
  findHouseholdByInviteCode,
  findUserByEmail,
  findUserById,
  getHouseholdAppState,
  normalizeInviteCode,
  setUserHousehold,
  updateHouseholdAppState,
} from './db.js';

function authPayload(user) {
  return {
    user: {
      id: user.id,
      email: user.email,
      householdId: user.household_id,
    },
    needsHousehold: !user.household_id,
    token: signToken({
      userId: user.id,
      email: user.email,
      householdId: user.household_id,
    }),
  };
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

export async function handleSignup(req, res) {
  const { email, password } = req.body ?? {};
  if (!email?.trim() || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  if (String(password).length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }

  await ensureDb();
  const user = await createUser({
    email,
    passwordHash: hashPassword(password),
  });
  res.status(201).json(authPayload(user));
}

export async function handleLogin(req, res) {
  const { email, password } = req.body ?? {};
  if (!email?.trim() || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  await ensureDb();
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  res.status(200).json(
    authPayload({
      id: user.id,
      email: user.email,
      household_id: user.household_id,
    }),
  );
}

export async function handleMe(req, res) {
  const session = getBearerUser(req);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  await ensureDb();
  const user = await findUserById(session.userId);
  if (!user) {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
    return;
  }

  res.status(200).json({
    user: {
      id: user.id,
      email: user.email,
      householdId: user.household_id,
    },
    needsHousehold: !user.household_id,
    token: signToken({
      userId: user.id,
      email: user.email,
      householdId: user.household_id,
    }),
  });
}

export async function handleCreateHousehold(req, res) {
  const session = getBearerUser(req);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  await ensureDb();
  const user = await findUserById(session.userId);
  if (!user) {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
    return;
  }
  if (user.household_id) {
    res.status(400).json({ error: 'You are already in a household.' });
    return;
  }

  const household = await createHousehold();
  await setUserHousehold(user.id, household.id);

  const state = await getHouseholdAppState(household.id);
  res.status(201).json({
    ...authPayload({
      id: user.id,
      email: user.email,
      household_id: household.id,
    }),
    household: {
      id: household.id,
      inviteCode: household.invite_code,
    },
    ...state,
  });
}

export async function handleJoinHousehold(req, res) {
  const session = getBearerUser(req);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const inviteCode = normalizeInviteCode(req.body?.inviteCode);
  if (!inviteCode) {
    res.status(400).json({ error: 'Invite code is required.' });
    return;
  }

  await ensureDb();
  const user = await findUserById(session.userId);
  if (!user) {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
    return;
  }
  if (user.household_id) {
    res.status(400).json({ error: 'You are already in a household.' });
    return;
  }

  const household = await findHouseholdByInviteCode(inviteCode);
  if (!household) {
    res.status(404).json({ error: 'Household not found. Check the invite code.' });
    return;
  }

  await setUserHousehold(user.id, household.id);
  const state = await getHouseholdAppState(household.id);

  res.status(200).json({
    ...authPayload({
      id: user.id,
      email: user.email,
      household_id: household.id,
    }),
    household: {
      id: household.id,
      inviteCode: household.invite_code,
    },
    ...state,
  });
}

function requireHouseholdSession(req, res) {
  const session = getBearerUser(req);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated.' });
    return null;
  }
  if (!session.householdId) {
    res.status(403).json({ error: 'Join or create a household to continue.' });
    return null;
  }
  return session;
}

export async function handleGetState(req, res) {
  const session = requireHouseholdSession(req, res);
  if (!session) return;

  await ensureDb();
  const user = await findUserById(session.userId);
  if (!user?.household_id || user.household_id !== session.householdId) {
    res.status(403).json({ error: 'Household access denied.' });
    return;
  }

  const state = await getHouseholdAppState(user.household_id);
  res.status(200).json(state);
}

export async function handlePutState(req, res) {
  const session = requireHouseholdSession(req, res);
  if (!session) return;

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
  const user = await findUserById(session.userId);
  if (!user?.household_id || user.household_id !== session.householdId) {
    res.status(403).json({ error: 'Household access denied.' });
    return;
  }

  const state = await updateHouseholdAppState(user.household_id, partial);
  res.status(200).json(state);
}
