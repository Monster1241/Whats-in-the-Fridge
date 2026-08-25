import { ObjectId } from 'mongodb';
import {
  assertScopedHouseholdId,
  findUserByEmail,
  findUserById,
  getHouseholdMembers,
  normalizeInviteCode,
  setUserHousehold,
} from './db.js';
import { ADMIN_AUDIT_COLLECTION } from './supportInbox.js';

export const HOUSEHOLD_SOFT_DELETE_DAYS = 30;
export const HOUSEHOLD_SOFT_DELETE_MS = HOUSEHOLD_SOFT_DELETE_DAYS * 24 * 60 * 60 * 1000;

function getDb() {
  const db = globalThis._mongo?.db;
  if (!db) throw new Error('Database not connected.');
  return db;
}

/**
 * @param {Date} [now]
 */
export function computeHouseholdPurgeAt(now = new Date()) {
  return new Date(now.getTime() + HOUSEHOLD_SOFT_DELETE_MS);
}

/**
 * Soft-delete a household instead of wiping inventory (recoverable for HOUSEHOLD_SOFT_DELETE_DAYS).
 * @param {string} householdId
 * @param {{ leftByUserId?: string|null, leftByEmail?: string|null, wasOwner?: boolean }} [meta]
 */
export async function softDeleteHousehold(householdId, meta = {}) {
  const scopedId = assertScopedHouseholdId(householdId);
  const households = getDb().collection('households');
  const householdOid = new ObjectId(scopedId);
  const now = new Date();
  const existing = await households.findOne({ _id: householdOid });
  if (!existing) {
    const err = new Error('Household not found.');
    err.status = 404;
    throw err;
  }

  /** @type {Record<string, unknown>} */
  const $set = {
    deletedAt: now,
    purgeAt: computeHouseholdPurgeAt(now),
    updated_at: now,
  };
  if (meta.leftByUserId) {
    $set.lastLeftByUserId = String(meta.leftByUserId);
  }
  if (meta.leftByEmail) {
    $set.lastLeftByEmail = String(meta.leftByEmail).slice(0, 160);
  }

  await households.updateOne({ _id: householdOid }, { $set });
  return {
    id: scopedId,
    deletedAt: now.toISOString(),
    purgeAt: $set.purgeAt.toISOString(),
    softDeleted: true,
  };
}

/**
 * Permanently remove soft-deleted households past purgeAt.
 * @param {Date} [now]
 */
export async function purgeExpiredSoftDeletedHouseholds(now = new Date()) {
  const households = getDb().collection('households');
  const inventory = getDb().collection('inventory');
  const expired = await households
    .find({ deletedAt: { $exists: true }, purgeAt: { $lte: now } })
    .project({ _id: 1 })
    .toArray();

  let purged = 0;
  for (const doc of expired) {
    const id = doc._id.toString();
    await inventory.deleteMany({ household_id: id });
    await households.deleteOne({ _id: doc._id });
    purged += 1;
  }
  return { purged };
}

/**
 * @param {string} householdId
 */
export async function restoreSoftDeletedHousehold(householdId) {
  const scopedId = assertScopedHouseholdId(householdId);
  const households = getDb().collection('households');
  const result = await households.findOneAndUpdate(
    { _id: new ObjectId(scopedId), deletedAt: { $exists: true } },
    {
      $unset: { deletedAt: '', purgeAt: '' },
      $set: { updated_at: new Date() },
    },
    { returnDocument: 'after' },
  );
  if (!result) {
    // May already be active
    const existing = await households.findOne({ _id: new ObjectId(scopedId) });
    if (!existing) {
      const err = new Error('Household not found.');
      err.status = 404;
      throw err;
    }
    if (existing.deletedAt) {
      const err = new Error('Could not restore household.');
      err.status = 500;
      throw err;
    }
    return mapAdminHousehold(existing);
  }
  return mapAdminHousehold(result);
}

/**
 * @param {import('mongodb').WithId<import('mongodb').Document>} doc
 */
export async function mapAdminHousehold(doc) {
  if (!doc) return null;
  const id = doc._id.toString();
  const inventoryCount = await getDb()
    .collection('inventory')
    .countDocuments({ household_id: id });
  const members = doc.deletedAt
    ? []
    : await getHouseholdMembers(id).catch(() => []);
  const ownerId = doc.owner_id ? doc.owner_id.toString() : null;

  return {
    id,
    inviteCode: doc.invite_code ?? null,
    ownerId,
    createdAt:
      doc.created_at instanceof Date ? doc.created_at.toISOString() : doc.created_at ?? null,
    updatedAt:
      doc.updated_at instanceof Date ? doc.updated_at.toISOString() : doc.updated_at ?? null,
    softDeleted: Boolean(doc.deletedAt),
    deletedAt:
      doc.deletedAt instanceof Date ? doc.deletedAt.toISOString() : doc.deletedAt ?? null,
    purgeAt: doc.purgeAt instanceof Date ? doc.purgeAt.toISOString() : doc.purgeAt ?? null,
    lastLeftByUserId: doc.lastLeftByUserId ? String(doc.lastLeftByUserId) : null,
    lastLeftByEmail: doc.lastLeftByEmail ?? null,
    formerMemberIds: Array.isArray(doc.formerMemberIds)
      ? doc.formerMemberIds.map((oid) => oid.toString())
      : [],
    membershipHistory: Array.isArray(doc.membershipHistory)
      ? doc.membershipHistory.map((entry) => ({
          userId: entry.userId ?? null,
          email: entry.email ?? null,
          leftAt:
            entry.leftAt instanceof Date
              ? entry.leftAt.toISOString()
              : entry.leftAt ?? null,
          wasOwner: Boolean(entry.wasOwner),
          event: entry.event ?? null,
        }))
      : [],
    memberCount: members.length,
    members,
    inventoryCount,
  };
}

/**
 * @param {string} email
 */
export async function adminLookupUserByEmail(email) {
  await purgeExpiredSoftDeletedHouseholds().catch(() => {});
  const user = await findUserByEmail(email);
  if (!user) {
    const err = new Error('No user found with that email.');
    err.status = 404;
    throw err;
  }

  const full = await getDb().collection('users').findOne({ _id: new ObjectId(user.id) });
  const currentHouseholdId = full?.household_id ? full.household_id.toString() : null;
  const lastHouseholdId = full?.last_household_id
    ? full.last_household_id.toString()
    : null;

  let currentHousehold = null;
  let lastHousehold = null;
  if (currentHouseholdId) {
    const doc = await getDb()
      .collection('households')
      .findOne({ _id: new ObjectId(currentHouseholdId) });
    currentHousehold = doc ? await mapAdminHousehold(doc) : null;
  }
  if (lastHouseholdId && lastHouseholdId !== currentHouseholdId) {
    const doc = await getDb()
      .collection('households')
      .findOne({ _id: new ObjectId(lastHouseholdId) });
    lastHousehold = doc ? await mapAdminHousehold(doc) : null;
  }

  const ownedOrFormer = await getDb()
    .collection('households')
    .find({
      $or: [
        { owner_id: new ObjectId(user.id) },
        { formerMemberIds: new ObjectId(user.id) },
        { 'membershipHistory.userId': user.id },
      ],
    })
    .sort({ updated_at: -1 })
    .limit(10)
    .toArray();

  const relatedHouseholds = [];
  const seen = new Set(
    [currentHouseholdId, lastHouseholdId].filter(Boolean),
  );
  for (const doc of ownedOrFormer) {
    const id = doc._id.toString();
    if (seen.has(id)) continue;
    seen.add(id);
    relatedHouseholds.push(await mapAdminHousehold(doc));
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      isVerified: user.isVerified,
      householdId: currentHouseholdId,
      lastHouseholdId,
      leftHouseholdAt:
        full?.left_household_at instanceof Date
          ? full.left_household_at.toISOString()
          : full?.left_household_at ?? null,
    },
    currentHousehold,
    lastHousehold,
    relatedHouseholds,
  };
}

/**
 * @param {string} query invite code or household id
 */
export async function adminLookupHousehold(query) {
  await purgeExpiredSoftDeletedHouseholds().catch(() => {});
  const raw = String(query ?? '').trim();
  if (!raw) {
    const err = new Error('Household id or invite code is required.');
    err.status = 400;
    throw err;
  }

  const households = getDb().collection('households');
  let doc = null;

  if (ObjectId.isValid(raw) && String(new ObjectId(raw)) === raw) {
    doc = await households.findOne({ _id: new ObjectId(raw) });
  }
  if (!doc) {
    const code = normalizeInviteCode(raw);
    if (code) {
      doc = await households.findOne({ invite_code: code });
    }
  }
  if (!doc) {
    const err = new Error('Household not found.');
    err.status = 404;
    throw err;
  }

  return mapAdminHousehold(doc);
}

/**
 * @param {{
 *   userId: string,
 *   householdId: string,
 *   adminUserId?: string|null,
 *   adminEmail?: string|null,
 *   force?: boolean,
 * }} input
 */
export async function adminRejoinUserToHousehold(input) {
  const userId = String(input.userId ?? '').trim();
  const householdId = assertScopedHouseholdId(input.householdId);
  const force = Boolean(input.force);

  const user = await findUserById(userId);
  if (!user) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }
  if (user.household_id && user.household_id !== householdId) {
    const err = new Error(
      'User is already in a different household. Ask them to leave that household first, then retry rejoin.',
    );
    err.status = 409;
    throw err;
  }

  const households = getDb().collection('households');
  const householdOid = new ObjectId(householdId);
  let doc = await households.findOne({ _id: householdOid });
  if (!doc) {
    const err = new Error('Household not found (may have been permanently purged).');
    err.status = 404;
    throw err;
  }

  const ownerId = doc.owner_id ? doc.owner_id.toString() : null;
  const formerIds = Array.isArray(doc.formerMemberIds)
    ? doc.formerMemberIds.map((oid) => oid.toString())
    : [];
  const historyIds = Array.isArray(doc.membershipHistory)
    ? doc.membershipHistory.map((entry) => String(entry.userId ?? ''))
    : [];
  const fullUser = await getDb().collection('users').findOne({ _id: new ObjectId(userId) });
  const lastHouseholdId = fullUser?.last_household_id
    ? fullUser.last_household_id.toString()
    : null;

  const verifiedAsFormer =
    ownerId === userId ||
    formerIds.includes(userId) ||
    historyIds.includes(userId) ||
    lastHouseholdId === householdId;

  if (!verifiedAsFormer && !force) {
    const err = new Error(
      'Could not verify this user as a former member/owner of that household. Confirm identity, then retry with force after noting the check.',
    );
    err.status = 403;
    err.code = 'OWNERSHIP_UNVERIFIED';
    throw err;
  }

  if (doc.deletedAt) {
    await restoreSoftDeletedHousehold(householdId);
    doc = await households.findOne({ _id: householdOid });
  }

  if (!user.household_id) {
    await setUserHousehold(userId, householdId);
  }

  // If household has no members and this user was owner, restore ownership
  const members = await getHouseholdMembers(householdId);
  if (members.length === 1 && (ownerId === userId || verifiedAsFormer)) {
    await households.updateOne(
      { _id: householdOid },
      { $set: { owner_id: new ObjectId(userId), updated_at: new Date() } },
    );
  }

  await getDb().collection('users').updateOne(
    { _id: new ObjectId(userId) },
    {
      $unset: { left_household_at: '' },
      $set: { updated_at: new Date() },
    },
  );

  await writeAdminRecoveryAudit({
    action: 'household_rejoin',
    adminUserId: input.adminUserId ?? null,
    adminEmail: input.adminEmail ?? null,
    userId,
    userEmail: user.email,
    householdId,
    force,
    verifiedAsFormer,
  });

  const household = await mapAdminHousehold(
    await households.findOne({ _id: householdOid }),
  );
  const refreshedUser = await findUserById(userId);

  return {
    user: {
      id: refreshedUser.id,
      email: refreshedUser.email,
      householdId: refreshedUser.household_id,
    },
    household,
    verifiedAsFormer,
    forced: force && !verifiedAsFormer,
    inviteCode: household?.inviteCode ?? null,
  };
}

/**
 * @param {{
 *   action: string,
 *   adminUserId?: string|null,
 *   adminEmail?: string|null,
 *   [key: string]: unknown,
 * }} entry
 */
export async function writeAdminRecoveryAudit(entry) {
  await getDb().collection(ADMIN_AUDIT_COLLECTION).insertOne({
    ...entry,
    createdAt: new Date(),
  });
}

/**
 * Record leave on user + household history (used by leaveHousehold).
 */
export async function recordHouseholdLeave(userId, householdId, { wasOwner = false, email = null } = {}) {
  const now = new Date();
  const users = getDb().collection('users');
  const households = getDb().collection('households');
  const userOid = new ObjectId(userId);
  const householdOid = new ObjectId(assertScopedHouseholdId(householdId));

  await users.updateOne(
    { _id: userOid },
    {
      $set: {
        last_household_id: householdOid,
        left_household_at: now,
      },
    },
  );

  await households.updateOne(
    { _id: householdOid },
    {
      $addToSet: { formerMemberIds: userOid },
      $push: {
        membershipHistory: {
          userId,
          email: email ? String(email).slice(0, 160) : null,
          leftAt: now,
          wasOwner: Boolean(wasOwner),
          event: 'left',
        },
      },
      $set: { updated_at: now },
    },
  );
}
