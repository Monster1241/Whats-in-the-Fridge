import { ensureDb } from './ensureDb.js';
import { getEnvDiagnostics, getMongoUri } from './env.js';
import { getBearerUser, hashPassword, signToken, verifyPassword } from './auth.js';
import { toFriendlyError } from './errors.js';
import { sendVerificationEmail } from './email.js';
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
  verifyUserEmail,
} from './db.js';

function authPayload(user) {
  const isVerified = Boolean(user.isVerified);
  return {
    user: {
      id: user.id,
      email: user.email,
      householdId: user.household_id,
      isVerified,
    },
    needsVerification: !isVerified,
    needsHousehold: isVerified && !user.household_id,
    token: signToken({
      userId: user.id,
      email: user.email,
      householdId: user.household_id,
      isVerified,
    }),
  };
}

async function requireAuth(req, res) {
  const session = getBearerUser(req);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated.' });
    return null;
  }
  try {
    await ensureDb();
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 503).json({ error: friendly.message });
    return null;
  }
  const user = await findUserById(session.userId);
  if (!user) {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
    return null;
  }
  return { session, user };
}

async function requireVerified(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return null;
  if (!auth.user.isVerified) {
    res.status(403).json({ error: 'Email not verified. Please verify your account first.' });
    return null;
  }
  return auth;
}

function requireHouseholdSession(auth, res) {
  if (!auth.user.household_id) {
    res.status(403).json({ error: 'Join or create a household to continue.' });
    return null;
  }
  if (auth.session.householdId && auth.session.householdId !== auth.user.household_id) {
    res.status(403).json({ error: 'Household access denied.' });
    return null;
  }
  return auth;
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

  try {
    await ensureDb();
    const user = await createUser({
      email,
      passwordHash: await hashPassword(password),
    });
    await sendVerificationEmail(user.email, user.verificationCode);
    res.status(201).json(authPayload(user));
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleLogin(req, res) {
  const { email, password } = req.body ?? {};
  if (!email?.trim() || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  try {
    await ensureDb();
    const user = await findUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    res.status(200).json(authPayload(user));
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleMe(req, res) {
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    res.status(200).json(authPayload(auth.user));
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleVerifyEmail(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const { code } = req.body ?? {};
  if (!code) {
    res.status(400).json({ error: 'Verification code is required.' });
    return;
  }

  try {
    const user = await verifyUserEmail(auth.user.id, code);
    res.status(200).json(authPayload(user));
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleCreateHousehold(req, res) {
  const auth = await requireVerified(req, res);
  if (!auth) return;

  if (auth.user.household_id) {
    res.status(400).json({ error: 'You are already in a household.' });
    return;
  }

  const household = await createHousehold();
  await setUserHousehold(auth.user.id, household.id);
  const user = await findUserById(auth.user.id);
  const state = await getHouseholdAppState(household.id);

  res.status(201).json({
    ...authPayload(user),
    household: {
      id: household.id,
      inviteCode: household.invite_code,
    },
    ...state,
  });
}

export async function handleJoinHousehold(req, res) {
  const auth = await requireVerified(req, res);
  if (!auth) return;

  const inviteCode = normalizeInviteCode(req.body?.inviteCode);
  if (!inviteCode) {
    res.status(400).json({ error: 'Invite code is required.' });
    return;
  }

  if (auth.user.household_id) {
    res.status(400).json({ error: 'You are already in a household.' });
    return;
  }

  const household = await findHouseholdByInviteCode(inviteCode);
  if (!household) {
    res.status(404).json({ error: 'Household not found. Check the invite code.' });
    return;
  }

  await setUserHousehold(auth.user.id, household.id);
  const user = await findUserById(auth.user.id);
  const state = await getHouseholdAppState(household.id);

  res.status(200).json({
    ...authPayload(user),
    household: {
      id: household.id,
      inviteCode: household.invite_code,
    },
    ...state,
  });
}

export async function handleGetState(req, res) {
  const auth = await requireVerified(req, res);
  if (!auth) return;
  if (!requireHouseholdSession(auth, res)) return;

  const state = await getHouseholdAppState(auth.user.household_id);
  res.status(200).json(state);
}

export async function handlePutState(req, res) {
  const auth = await requireVerified(req, res);
  if (!auth) return;
  if (!requireHouseholdSession(auth, res)) return;

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

  const state = await updateHouseholdAppState(auth.user.household_id, partial);
  res.status(200).json(state);
}
