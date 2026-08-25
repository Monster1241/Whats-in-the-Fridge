import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { ObjectId } from 'mongodb';
import { assertScopedHouseholdId, findUserById } from './db.js';
import { sendRecoveryVerificationEmail } from './email.js';

export const RECOVERY_CHALLENGES_COLLECTION = 'admin_recovery_challenges';

const CODE_TTL_MS = 10 * 60 * 1000;
const REJOIN_WINDOW_MS = 30 * 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_CONFIRM_ATTEMPTS = 8;

function getDb() {
  const db = globalThis._mongo?.db;
  if (!db) throw new Error('Database not connected.');
  return db;
}

function getPepper() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET is not set.');
  }
  return secret;
}

export function hashRecoveryCode(code) {
  return createHmac('sha256', getPepper()).update(String(code).trim()).digest('hex');
}

export function generateRecoveryCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function codesMatch(submitted, storedHash) {
  try {
    const a = Buffer.from(hashRecoveryCode(submitted), 'hex');
    const b = Buffer.from(String(storedHash), 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Create / refresh a recovery OTP and email it to the user.
 * @param {{
 *   userId: string,
 *   householdId: string,
 *   adminUserId?: string|null,
 *   adminEmail?: string|null,
 * }} input
 */
export async function sendAdminRecoveryCode(input) {
  const userId = String(input.userId ?? '').trim();
  const householdId = assertScopedHouseholdId(input.householdId);
  if (!userId || !ObjectId.isValid(userId)) {
    const err = new Error('Valid userId is required.');
    err.status = 400;
    throw err;
  }

  const user = await findUserById(userId);
  if (!user?.email) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }

  const col = getDb().collection(RECOVERY_CHALLENGES_COLLECTION);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentSends = await col.countDocuments({
    userId,
    householdId,
    createdAt: { $gte: hourAgo },
  });
  if (recentSends >= MAX_SENDS_PER_HOUR) {
    const err = new Error('Too many verification emails sent. Try again in an hour.');
    err.status = 429;
    throw err;
  }

  const code = generateRecoveryCode();
  const now = new Date();
  const doc = {
    userId,
    householdId,
    userEmail: user.email,
    codeHash: hashRecoveryCode(code),
    adminUserId: input.adminUserId ? String(input.adminUserId) : null,
    adminEmail: input.adminEmail ? String(input.adminEmail) : null,
    createdAt: now,
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    confirmAttempts: 0,
    confirmedAt: null,
    rejoinExpiresAt: null,
    consumedAt: null,
  };

  const { insertedId } = await col.insertOne(doc);
  await sendRecoveryVerificationEmail(user.email, code);

  return {
    challengeId: insertedId.toString(),
    userId,
    householdId,
    userEmail: user.email,
    expiresAt: doc.expiresAt.toISOString(),
  };
}

/**
 * Confirm the emailed OTP. Marks the challenge ready for rejoin.
 * @param {{
 *   userId: string,
 *   householdId: string,
 *   code: string,
 * }} input
 */
export async function confirmAdminRecoveryCode(input) {
  const userId = String(input.userId ?? '').trim();
  const householdId = assertScopedHouseholdId(input.householdId);
  const code = String(input.code ?? '').trim();

  if (!/^\d{6}$/.test(code)) {
    const err = new Error('Enter the 6-digit code from the email.');
    err.status = 400;
    throw err;
  }

  const col = getDb().collection(RECOVERY_CHALLENGES_COLLECTION);
  const challenge = await col.findOne(
    {
      userId,
      householdId,
      consumedAt: null,
    },
    { sort: { createdAt: -1 } },
  );

  if (!challenge) {
    const err = new Error('No verification code pending. Send a new code first.');
    err.status = 404;
    throw err;
  }

  if (challenge.confirmAttempts >= MAX_CONFIRM_ATTEMPTS) {
    const err = new Error('Too many incorrect attempts. Send a new code.');
    err.status = 429;
    throw err;
  }

  const now = new Date();
  if (challenge.expiresAt && challenge.expiresAt < now && !challenge.confirmedAt) {
    const err = new Error('That code expired. Send a new one.');
    err.status = 410;
    throw err;
  }

  if (!codesMatch(code, challenge.codeHash)) {
    await col.updateOne({ _id: challenge._id }, { $inc: { confirmAttempts: 1 } });
    const err = new Error('Incorrect verification code.');
    err.status = 400;
    throw err;
  }

  const rejoinExpiresAt = new Date(now.getTime() + REJOIN_WINDOW_MS);
  await col.updateOne(
    { _id: challenge._id },
    {
      $set: {
        confirmedAt: now,
        rejoinExpiresAt,
        confirmAttempts: 0,
      },
    },
  );

  return {
    challengeId: challenge._id.toString(),
    userId,
    householdId,
    confirmedAt: now.toISOString(),
    rejoinExpiresAt: rejoinExpiresAt.toISOString(),
  };
}

/**
 * Ensure a confirmed, unused challenge exists (does not consume).
 * @param {{ userId: string, householdId: string }} input
 */
export async function assertConfirmedRecoveryChallenge(input) {
  const userId = String(input.userId ?? '').trim();
  const householdId = assertScopedHouseholdId(input.householdId);
  const col = getDb().collection(RECOVERY_CHALLENGES_COLLECTION);
  const now = new Date();

  const challenge = await col.findOne(
    {
      userId,
      householdId,
      consumedAt: null,
      confirmedAt: { $ne: null },
      rejoinExpiresAt: { $gt: now },
    },
    { sort: { confirmedAt: -1 } },
  );

  if (!challenge) {
    const err = new Error(
      'Email verification required. Send a code to the user, confirm it, then rejoin.',
    );
    err.status = 403;
    err.code = 'RECOVERY_EMAIL_UNVERIFIED';
    throw err;
  }

  return {
    challengeId: challenge._id.toString(),
    confirmedAt: challenge.confirmedAt?.toISOString?.() ?? null,
  };
}

/**
 * Mark a confirmed challenge as used after a successful rejoin.
 * @param {{ userId: string, householdId: string, challengeId?: string }} input
 */
export async function consumeConfirmedRecoveryChallenge(input) {
  const userId = String(input.userId ?? '').trim();
  const householdId = assertScopedHouseholdId(input.householdId);
  const col = getDb().collection(RECOVERY_CHALLENGES_COLLECTION);
  const now = new Date();

  let challenge = null;
  if (input.challengeId && ObjectId.isValid(String(input.challengeId))) {
    challenge = await col.findOne({
      _id: new ObjectId(String(input.challengeId)),
      userId,
      householdId,
      consumedAt: null,
      confirmedAt: { $ne: null },
      rejoinExpiresAt: { $gt: now },
    });
  } else {
    challenge = await col.findOne(
      {
        userId,
        householdId,
        consumedAt: null,
        confirmedAt: { $ne: null },
        rejoinExpiresAt: { $gt: now },
      },
      { sort: { confirmedAt: -1 } },
    );
  }

  if (!challenge) {
    const err = new Error(
      'Email verification required. Send a code to the user, confirm it, then rejoin.',
    );
    err.status = 403;
    err.code = 'RECOVERY_EMAIL_UNVERIFIED';
    throw err;
  }

  await col.updateOne({ _id: challenge._id }, { $set: { consumedAt: now } });

  return {
    challengeId: challenge._id.toString(),
    confirmedAt: challenge.confirmedAt?.toISOString?.() ?? null,
  };
}
