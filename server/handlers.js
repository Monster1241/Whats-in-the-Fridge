import { ensureDb } from './ensureDb.js';
import { getEnvDiagnostics, getMongoUri } from './env.js';
import {
  getBearerUser,
  hashPassword,
  signToken,
  verifyPassword,
} from './auth.js';
import { toFriendlyError } from './errors.js';
import { verifyFirebaseIdToken } from './firebaseAdmin.js';
import {
  createHousehold,
  addFcmTokenToUser,
  createUser,
  findHouseholdByInviteCode,
  findUserByEmail,
  findUserByFirebaseUid,
  findUserById,
  linkUserFirebaseAccount,
  getHouseholdAppState,
  getHouseholdMembers,
  isHouseholdOwner as checkIsHouseholdOwner,
  leaveHousehold,
  normalizeInviteCode,
  removeHouseholdMember,
  setUserHousehold,
  updateHouseholdAppState,
  verifyUserEmail,
  deleteUserAccount,
} from './db.js';

async function authPayload(user) {
  const isVerified = Boolean(user.isVerified);
  let isHouseholdOwner = false;
  if (user.household_id) {
    isHouseholdOwner = await checkIsHouseholdOwner(user.household_id, user.id);
  }
  return {
    user: {
      id: user.id,
      email: user.email,
      householdId: user.household_id,
      isVerified,
      isHouseholdOwner,
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

/**
 * Ensures the authenticated user belongs to a household and that the JWT household
 * claim matches the live DB record (prevents stale or forged household access).
 */
function requireHouseholdSession(auth, res) {
  if (!auth.user.household_id) {
    res.status(403).json({ error: 'Join or create a household to continue.' });
    return null;
  }
  const jwtHouseholdId = auth.session.householdId ?? null;
  if (jwtHouseholdId !== auth.user.household_id) {
    res.status(403).json({ error: 'Household access denied. Please sign in again.' });
    return null;
  }
  return auth;
}

/** Household id scoped from verified JWT + DB user (use for all inventory/state queries). */
function getScopedHouseholdId(auth) {
  return auth.user.household_id;
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

export async function handleFirebaseSession(req, res) {
  const { idToken } = req.body ?? {};
  if (!idToken?.trim()) {
    res.status(400).json({ error: 'Firebase session token is required.' });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(idToken.trim());
    const email = decoded.email?.trim().toLowerCase();
    const firebaseUid = decoded.uid;
    const emailVerified = Boolean(decoded.email_verified);

    if (!email) {
      res.status(400).json({ error: 'Firebase account must include an email address.' });
      return;
    }

    await ensureDb();

    let user = await findUserByFirebaseUid(firebaseUid);
    if (!user) {
      user = await findUserByEmail(email);
    }

    if (!user) {
      user = await createUser({
        email,
        firebaseUid,
        isVerified: emailVerified,
      });
    } else {
      if (user.email !== email) {
        res.status(409).json({ error: 'This Firebase account does not match our records.' });
        return;
      }
      user = await linkUserFirebaseAccount(user.id, firebaseUid, emailVerified);
    }

    res.status(200).json(await authPayload(user));
  } catch (err) {
    console.error('POST /api/auth/session', err);
    const friendly = toFriendlyError(err);
    const message =
      friendly.message?.includes('Firebase Admin')
        ? 'Server auth is not configured. Contact support.'
        : friendly.message || 'Could not sign in with Firebase.';
    res.status(friendly.status || 401).json({ error: message });
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
    res.status(201).json(await authPayload(user));
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
    let user = await findUserByEmail(email);
    if (!user?.password_hash || !(await verifyPassword(password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    res.status(200).json(await authPayload(user));
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleMe(req, res) {
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    res.status(200).json(await authPayload(auth.user));
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleSaveFcmToken(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const token = String(req.body?.token ?? '').trim();
  if (!token) {
    res.status(400).json({ error: 'FCM token is required.' });
    return;
  }
  if (token.length > 512) {
    res.status(400).json({ error: 'Invalid FCM token.' });
    return;
  }

  try {
    await addFcmTokenToUser(auth.user.id, token);
    res.status(200).json({ ok: true });
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
    res.status(200).json(await authPayload(user));
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

  try {
    const household = await createHousehold(auth.user.id);
    await setUserHousehold(auth.user.id, household.id);
    const user = await findUserById(auth.user.id);
    const state = await getHouseholdAppState(household.id);

    res.status(201).json({
      ...(await authPayload(user)),
      household: {
        id: household.id,
        inviteCode: household.invite_code,
      },
      ...state,
    });
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
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

  try {
    await setUserHousehold(auth.user.id, household.id);
    const user = await findUserById(auth.user.id);
    const state = await getHouseholdAppState(household.id);

    res.status(200).json({
      ...(await authPayload(user)),
      household: {
        id: household.id,
        inviteCode: household.invite_code,
      },
      ...state,
    });
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

function sanitizeInventoryItems(items) {
  return items.map((item) => ({
    id: item?.id,
    name: item?.name,
    itemType:
      item?.itemType === 'Household'
        ? 'Household'
        : item?.itemType === 'Baby'
          ? 'Baby'
          : 'Food',
    category: item?.category,
    status: item?.status,
    expiryDate: item?.expiryDate ?? null,
    preferredStore:
      item?.preferredStore === null || item?.preferredStore === undefined
        ? null
        : String(item.preferredStore).trim() || null,
  }));
}

export async function handleGetState(req, res) {
  const auth = await requireVerified(req, res);
  if (!auth) return;
  if (!requireHouseholdSession(auth, res)) return;

  const householdId = getScopedHouseholdId(auth);
  const state = await getHouseholdAppState(householdId);
  res.status(200).json(state);
}

export async function handlePutState(req, res) {
  const auth = await requireVerified(req, res);
  if (!auth) return;
  if (!requireHouseholdSession(auth, res)) return;

  const householdId = getScopedHouseholdId(auth);
  const { items, settings, enabledModules, savedRecipeIds, onboarding } = req.body ?? {};
  const partial = {};

  if (items !== undefined) {
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'items must be an array' });
      return;
    }
    partial.items = sanitizeInventoryItems(items);
  }
  if (settings !== undefined) partial.settings = settings;
  if (enabledModules !== undefined) {
    if (typeof enabledModules !== 'object' || enabledModules === null) {
      res.status(400).json({ error: 'enabledModules must be an object' });
      return;
    }
    partial.enabledModules = enabledModules;
  }
  if (savedRecipeIds !== undefined) {
    if (!Array.isArray(savedRecipeIds)) {
      res.status(400).json({ error: 'savedRecipeIds must be an array' });
      return;
    }
    partial.savedRecipeIds = savedRecipeIds;
  }
  if (onboarding !== undefined) partial.onboarding = onboarding;

  const state = await updateHouseholdAppState(householdId, partial);
  res.status(200).json(state);
}

export async function handleDeleteAccount(req, res) {
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    await deleteUserAccount(auth.user.id);
    res.status(200).json({ ok: true, message: 'Account deleted.' });
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleGetHouseholdMembers(req, res) {
  try {
    const auth = await requireVerified(req, res);
    if (!auth) return;
    if (!requireHouseholdSession(auth, res)) return;

    const householdId = getScopedHouseholdId(auth);
    const members = await getHouseholdMembers(householdId);
    const currentUserIsOwner = await checkIsHouseholdOwner(householdId, auth.user.id);

    res.status(200).json({
      members: members.map((member) => ({
        ...member,
        isCurrentUser: member.id === auth.user.id,
      })),
      currentUserIsOwner,
    });
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleLeaveHousehold(req, res) {
  try {
    const auth = await requireVerified(req, res);
    if (!auth) return;
    if (!requireHouseholdSession(auth, res)) return;

    await leaveHousehold(auth.user.id);
    const user = await findUserById(auth.user.id);
    res.status(200).json(await authPayload(user));
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleRemoveHouseholdMember(req, res) {
  try {
    const auth = await requireVerified(req, res);
    if (!auth) return;
    if (!requireHouseholdSession(auth, res)) return;

    const targetUserId = req.body?.userId?.trim();
    if (!targetUserId) {
      res.status(400).json({ error: 'User id is required.' });
      return;
    }

    await removeHouseholdMember(auth.user.id, targetUserId);
    const householdId = getScopedHouseholdId(auth);
    const members = await getHouseholdMembers(householdId);

    res.status(200).json({
      ok: true,
      members: members.map((member) => ({
        ...member,
        isCurrentUser: member.id === auth.user.id,
      })),
    });
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}
