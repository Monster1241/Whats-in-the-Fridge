import { ensureDb } from './ensureDb.js';
import { getEnvDiagnostics, getMongoUri } from './env.js';
import {
  getBearerUser,
  hashPassword,
  hashSecurityAnswer,
  signToken,
  verifyPassword,
  verifySecurityAnswer,
} from './auth.js';
import { isAllowedSecurityQuestion } from './securityQuestions.js';
import { toFriendlyError } from './errors.js';
import {
  createHousehold,
  createUser,
  findHouseholdByInviteCode,
  findUserByEmail,
  findUserById,
  getHouseholdAppState,
  getHouseholdMembers,
  isHouseholdOwner as checkIsHouseholdOwner,
  leaveHousehold,
  markUserVerified,
  normalizeInviteCode,
  removeHouseholdMember,
  setUserHousehold,
  updateHouseholdAppState,
  verifyUserEmail,
  deleteUserAccount,
  getPasswordRecoveryQuestion,
  findUserSecurityCredentials,
  updateUserPassword,
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
  let user = await findUserById(session.userId);
  if (!user) {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
    return null;
  }
  if (!user.isVerified) {
    user = await markUserVerified(session.userId);
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

export async function handleSignup(req, res) {
  const { email, password, securityQuestion, securityAnswer } = req.body ?? {};
  if (!email?.trim() || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  if (String(password).length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }
  if (!securityQuestion?.trim() || !String(securityAnswer || '').trim()) {
    res.status(400).json({ error: 'Security question and answer are required.' });
    return;
  }
  if (!isAllowedSecurityQuestion(securityQuestion)) {
    res.status(400).json({ error: 'Please choose a security question from the list.' });
    return;
  }
  if (String(securityAnswer).trim().length < 2) {
    res.status(400).json({ error: 'Security answer must be at least 2 characters.' });
    return;
  }

  try {
    await ensureDb();
    const user = await createUser({
      email,
      passwordHash: await hashPassword(password),
      securityQuestion: securityQuestion.trim(),
      securityAnswerHash: await hashSecurityAnswer(securityAnswer),
    });
    res.status(201).json(await authPayload(user));
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handlePasswordRecoveryQuestion(req, res) {
  const { email } = req.body ?? {};
  if (!email?.trim()) {
    res.status(400).json({ error: 'Email is required.' });
    return;
  }

  try {
    await ensureDb();
    const recovery = await getPasswordRecoveryQuestion(email);
    if (!recovery) {
      res.status(404).json({
        error:
          'No account found with password recovery set up for this email. Sign up again or use an account that has a security question.',
      });
      return;
    }
    res.status(200).json(recovery);
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handlePasswordRecoveryVerify(req, res) {
  const { email, securityAnswer } = req.body ?? {};
  if (!email?.trim() || !String(securityAnswer || '').trim()) {
    res.status(400).json({ error: 'Email and security answer are required.' });
    return;
  }

  try {
    await ensureDb();
    const creds = await findUserSecurityCredentials(email);
    if (!creds) {
      res.status(404).json({ error: 'Password recovery is not available for this account.' });
      return;
    }
    const valid = await verifySecurityAnswer(securityAnswer, creds.securityAnswerHash);
    if (!valid) {
      res.status(401).json({ error: 'Incorrect security answer.' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handlePasswordRecoveryReset(req, res) {
  const { email, securityAnswer, newPassword } = req.body ?? {};
  if (!email?.trim() || !String(securityAnswer || '').trim() || !newPassword) {
    res.status(400).json({ error: 'Email, security answer, and new password are required.' });
    return;
  }
  if (String(newPassword).length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters.' });
    return;
  }

  try {
    await ensureDb();
    const creds = await findUserSecurityCredentials(email);
    if (!creds) {
      res.status(404).json({ error: 'Password recovery is not available for this account.' });
      return;
    }
    const valid = await verifySecurityAnswer(securityAnswer, creds.securityAnswerHash);
    if (!valid) {
      res.status(401).json({ error: 'Incorrect security answer.' });
      return;
    }
    await updateUserPassword(creds.id, await hashPassword(newPassword));
    res.status(200).json({ ok: true, message: 'Password updated. You can log in now.' });
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
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    if (!user.isVerified) {
      user = await markUserVerified(user.id);
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
