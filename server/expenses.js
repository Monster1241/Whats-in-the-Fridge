import { ObjectId } from 'mongodb';
import { assertScopedHouseholdId, getHouseholdMembers, isHouseholdOwner } from './db.js';

export const EXPENSES_COLLECTION = 'expenses';
export const RECEIPT_SOFT_DELETE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getDb() {
  const db = globalThis._mongo?.db;
  if (!db) throw new Error('Database not connected.');
  return db;
}

export function getExpensesCollection() {
  return getDb().collection(EXPENSES_COLLECTION);
}

/** @param {'weekly'|'fortnightly'|'monthly'|string} timeframe */
export function timeframeStartDate(timeframe, now = new Date()) {
  const days =
    timeframe === 'fortnightly' ? 14 : timeframe === 'monthly' ? 30 : 7;
  const start = new Date(now.getTime());
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

export function receiptRestoreDeadline(deletedAt) {
  const start = deletedAt instanceof Date ? deletedAt : new Date(deletedAt);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + RECEIPT_SOFT_DELETE_DAYS * MS_PER_DAY);
}

export function receiptRestoreCutoff(now = new Date()) {
  return new Date(now.getTime() - RECEIPT_SOFT_DELETE_DAYS * MS_PER_DAY);
}

export function isWithinReceiptRestoreWindow(deletedAt, now = new Date()) {
  if (!deletedAt) return false;
  const deadline = receiptRestoreDeadline(deletedAt);
  if (!deadline) return false;
  return now.getTime() <= deadline.getTime();
}

/**
 * Vault receipts can be deleted only by the member who added them or the household owner.
 * @param {{ addedByUserId?: string, requestingUserId?: string, isHouseholdOwner?: boolean }} input
 */
export function canManageVaultReceipt(input) {
  const requestingUserId = String(input?.requestingUserId ?? '').trim();
  if (!requestingUserId) return false;
  if (input?.isHouseholdOwner) return true;
  const addedByUserId = String(input?.addedByUserId ?? '').trim();
  return Boolean(addedByUserId) && addedByUserId === requestingUserId;
}

function toIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isSoftDeletedDoc(doc) {
  return Boolean(doc?.deletedAt);
}

function activeExpenseQuery(householdId, extra = {}) {
  return {
    householdId,
    ...extra,
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  };
}

function mapExpense(doc, { requestingUserId = null, isOwner = false } = {}) {
  if (!doc) return null;
  const addedByUserId = String(doc.addedBy?.userId ?? '');
  const deletedAtIso = toIsoDate(doc.deletedAt);
  const restoreUntil = deletedAtIso ? toIsoDate(receiptRestoreDeadline(doc.deletedAt)) : null;
  const inRestoreWindow = isWithinReceiptRestoreWindow(doc.deletedAt);
  const canManage = canManageVaultReceipt({
    addedByUserId,
    requestingUserId,
    isHouseholdOwner: isOwner,
  });
  return {
    id: doc._id.toString(),
    householdId: String(doc.householdId),
    addedBy: {
      userId: addedByUserId,
      displayName: String(doc.addedBy?.displayName ?? '').trim(),
    },
    storeName: String(doc.storeName ?? '').trim(),
    totalAmount: Number(doc.totalAmount) || 0,
    purchaseDate: toIsoDate(doc.purchaseDate),
    receiptImageUrl: doc.receiptImageUrl ? String(doc.receiptImageUrl) : null,
    savedToVault: doc.savedToVault !== false,
    createdAt: toIsoDate(doc.createdAt),
    deletedAt: deletedAtIso,
    restoreUntil,
    canDelete: !deletedAtIso && canManage,
    canRestore: Boolean(deletedAtIso) && inRestoreWindow && canManage,
  };
}

/**
 * @param {{
 *   householdId: string,
 *   userId: string,
 *   displayName?: string,
 *   storeName: string,
 *   totalAmount: number,
 *   purchaseDate?: string|Date|null,
 *   receiptImageUrl?: string|null,
 *   savedToVault?: boolean,
 * }} input
 */
export async function createExpense(input) {
  const householdId = assertScopedHouseholdId(input.householdId);
  const amount = Number(input.totalAmount);
  if (!Number.isFinite(amount) || amount < 0) {
    const err = new Error('Enter a valid total amount.');
    err.status = 400;
    throw err;
  }

  const storeName = String(input.storeName ?? '').trim().slice(0, 80) || 'Store';
  const purchaseDate = input.purchaseDate ? new Date(input.purchaseDate) : new Date();
  if (Number.isNaN(purchaseDate.getTime())) {
    const err = new Error('Enter a valid purchase date.');
    err.status = 400;
    throw err;
  }

  const savedToVault = input.savedToVault !== false;
  let receiptImageUrl = null;
  if (savedToVault && input.receiptImageUrl) {
    receiptImageUrl = String(input.receiptImageUrl).trim().slice(0, 2000) || null;
  }

  const now = new Date();
  const doc = {
    householdId,
    addedBy: {
      userId: String(input.userId),
      displayName: String(input.displayName ?? '').trim().slice(0, 80),
    },
    storeName,
    totalAmount: Math.round(amount * 100) / 100,
    purchaseDate,
    receiptImageUrl,
    savedToVault,
    createdAt: now,
    updatedAt: now,
  };

  const result = await getExpensesCollection().insertOne(doc);
  return mapExpense(
    { ...doc, _id: result.insertedId },
    { requestingUserId: String(input.userId), isOwner: false },
  );
}

export async function purgeExpiredDeletedExpenses(now = new Date()) {
  const cutoff = receiptRestoreCutoff(now);
  await getExpensesCollection().deleteMany({
    deletedAt: { $exists: true, $lte: cutoff },
  });
}

async function viewerFlags(householdId, requestingUserId) {
  if (!requestingUserId) return { requestingUserId: null, isOwner: false };
  const isOwner = await isHouseholdOwner(householdId, requestingUserId);
  return { requestingUserId, isOwner };
}

/**
 * @param {string} householdId
 * @param {'weekly'|'fortnightly'|'monthly'|string} timeframe
 * @param {string} [requestingUserId]
 */
export async function listExpenses(householdId, timeframe = 'weekly', requestingUserId) {
  const scopedId = assertScopedHouseholdId(householdId);
  await purgeExpiredDeletedExpenses().catch(() => {});
  const start = timeframeStartDate(timeframe);
  const docs = await getExpensesCollection()
    .find(
      activeExpenseQuery(scopedId, {
        purchaseDate: { $gte: start },
      }),
    )
    .sort({ purchaseDate: -1, createdAt: -1 })
    .toArray();
  const flags = await viewerFlags(scopedId, requestingUserId);
  return docs.map((doc) => mapExpense(doc, flags));
}

/**
 * Soft-deleted vault receipts still inside the 30-day restore window.
 * @param {string} householdId
 * @param {string} [requestingUserId]
 */
export async function listDeletedExpenses(householdId, requestingUserId) {
  const scopedId = assertScopedHouseholdId(householdId);
  await purgeExpiredDeletedExpenses().catch(() => {});
  const cutoff = receiptRestoreCutoff();
  const docs = await getExpensesCollection()
    .find({
      householdId: scopedId,
      deletedAt: { $gte: cutoff },
    })
    .sort({ deletedAt: -1, createdAt: -1 })
    .toArray();
  const flags = await viewerFlags(scopedId, requestingUserId);
  return docs.map((doc) => mapExpense(doc, flags));
}

/**
 * Equal-split settlement for the household over a timeframe.
 * @param {string} householdId
 * @param {'weekly'|'fortnightly'|'monthly'|string} timeframe
 */
export async function getExpenseSplit(householdId, timeframe = 'weekly') {
  const scopedId = assertScopedHouseholdId(householdId);
  const expenses = await listExpenses(scopedId, timeframe);
  const members = await getHouseholdMembers(scopedId);

  /** @type {Map<string, { userId: string, displayName: string, total: number }>} */
  const byUser = new Map();
  for (const member of members) {
    byUser.set(member.id, {
      userId: member.id,
      displayName: member.displayName || member.email || 'Member',
      total: 0,
    });
  }

  let grandTotal = 0;
  for (const expense of expenses) {
    const userId = expense.addedBy.userId;
    if (!userId) continue;
    grandTotal += expense.totalAmount;
    const existing = byUser.get(userId);
    if (existing) {
      existing.total = Math.round((existing.total + expense.totalAmount) * 100) / 100;
      if (expense.addedBy.displayName) existing.displayName = expense.addedBy.displayName;
    } else {
      byUser.set(userId, {
        userId,
        displayName: expense.addedBy.displayName || 'Member',
        total: expense.totalAmount,
      });
    }
  }

  const contributions = [...byUser.values()].sort((a, b) => b.total - a.total);
  const memberCount = Math.max(contributions.length, 1);
  const fairShare = Math.round((grandTotal / memberCount) * 100) / 100;

  const balances = contributions.map((entry) => ({
    ...entry,
    balance: Math.round((entry.total - fairShare) * 100) / 100,
  }));

  const debtors = balances
    .filter((entry) => entry.balance < -0.009)
    .map((entry) => ({ ...entry, remaining: -entry.balance }))
    .sort((a, b) => b.remaining - a.remaining);
  const creditors = balances
    .filter((entry) => entry.balance > 0.009)
    .map((entry) => ({ ...entry, remaining: entry.balance }))
    .sort((a, b) => b.remaining - a.remaining);

  /** @type {{ fromUserId: string, fromName: string, toUserId: string, toName: string, amount: number }[]} */
  const settlements = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].remaining, creditors[j].remaining);
    const rounded = Math.round(amount * 100) / 100;
    if (rounded >= 0.01) {
      settlements.push({
        fromUserId: debtors[i].userId,
        fromName: debtors[i].displayName,
        toUserId: creditors[j].userId,
        toName: creditors[j].displayName,
        amount: rounded,
      });
    }
    debtors[i].remaining = Math.round((debtors[i].remaining - amount) * 100) / 100;
    creditors[j].remaining = Math.round((creditors[j].remaining - amount) * 100) / 100;
    if (debtors[i].remaining < 0.01) i += 1;
    if (creditors[j].remaining < 0.01) j += 1;
  }

  return {
    timeframe,
    total: Math.round(grandTotal * 100) / 100,
    fairShare,
    contributions,
    settlements,
  };
}

function expenseNotFoundError() {
  const err = new Error('Expense not found.');
  err.status = 404;
  return err;
}

function forbidVaultManageError(action) {
  const err = new Error(
    `Only the person who added this receipt or the household owner can ${action} it.`,
  );
  err.status = 403;
  return err;
}

/**
 * Soft-delete a vault receipt. Only the member who added it or the household owner
 * may delete. The receipt stays recoverable for RECEIPT_SOFT_DELETE_DAYS.
 * @param {string} householdId
 * @param {string} expenseId
 * @param {string} requestingUserId
 */
export async function deleteExpense(householdId, expenseId, requestingUserId) {
  const scopedId = assertScopedHouseholdId(householdId);
  const id = String(expenseId ?? '').trim();
  if (!ObjectId.isValid(id)) throw expenseNotFoundError();

  await purgeExpiredDeletedExpenses().catch(() => {});

  const col = getExpensesCollection();
  const existing = await col.findOne({ _id: new ObjectId(id), householdId: scopedId });
  if (!existing) throw expenseNotFoundError();

  if (isSoftDeletedDoc(existing)) {
    if (!isWithinReceiptRestoreWindow(existing.deletedAt)) throw expenseNotFoundError();
    const flags = await viewerFlags(scopedId, requestingUserId);
    return { ok: true, id, alreadyDeleted: true, expense: mapExpense(existing, flags) };
  }

  const isOwner = await isHouseholdOwner(scopedId, requestingUserId);
  if (
    !canManageVaultReceipt({
      addedByUserId: existing.addedBy?.userId,
      requestingUserId,
      isHouseholdOwner: isOwner,
    })
  ) {
    throw forbidVaultManageError('delete');
  }

  const now = new Date();
  await col.updateOne(
    { _id: existing._id },
    { $set: { deletedAt: now, deletedBy: String(requestingUserId), updatedAt: now } },
  );
  const flags = { requestingUserId, isOwner };
  return {
    ok: true,
    id,
    expense: mapExpense({ ...existing, deletedAt: now, deletedBy: String(requestingUserId) }, flags),
  };
}

/**
 * Restore a soft-deleted vault receipt within the 30-day window.
 * Only the member who added it or the household owner can retrieve it.
 * @param {string} householdId
 * @param {string} expenseId
 * @param {string} requestingUserId
 */
export async function restoreExpense(householdId, expenseId, requestingUserId) {
  const scopedId = assertScopedHouseholdId(householdId);
  const id = String(expenseId ?? '').trim();
  if (!ObjectId.isValid(id)) throw expenseNotFoundError();

  await purgeExpiredDeletedExpenses().catch(() => {});

  const col = getExpensesCollection();
  const existing = await col.findOne({ _id: new ObjectId(id), householdId: scopedId });
  if (!existing) throw expenseNotFoundError();

  const flags = await viewerFlags(scopedId, requestingUserId);

  if (
    !canManageVaultReceipt({
      addedByUserId: existing.addedBy?.userId,
      requestingUserId,
      isHouseholdOwner: flags.isOwner,
    })
  ) {
    throw forbidVaultManageError('restore');
  }

  if (!isSoftDeletedDoc(existing)) {
    return { ok: true, id, expense: mapExpense(existing, flags) };
  }

  if (!isWithinReceiptRestoreWindow(existing.deletedAt)) {
    await col.deleteOne({ _id: existing._id });
    const err = new Error('This receipt can no longer be restored. The 30-day window has ended.');
    err.status = 410;
    throw err;
  }

  const now = new Date();
  await col.updateOne(
    { _id: existing._id },
    { $unset: { deletedAt: '', deletedBy: '' }, $set: { updatedAt: now } },
  );
  const restored = { ...existing };
  delete restored.deletedAt;
  delete restored.deletedBy;
  restored.updatedAt = now;
  return { ok: true, id, expense: mapExpense(restored, flags) };
}

export async function ensureExpensesIndexes() {
  const col = getExpensesCollection();
  await col.createIndex({ householdId: 1, purchaseDate: -1 });
  await col.createIndex({ householdId: 1, 'addedBy.userId': 1 });
  await col.createIndex({ householdId: 1, deletedAt: -1 });
}
