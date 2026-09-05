import { ObjectId } from 'mongodb';
import { assertScopedHouseholdId, getHouseholdMembers } from './db.js';

export const EXPENSES_COLLECTION = 'expenses';

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

function mapExpense(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    householdId: String(doc.householdId),
    addedBy: {
      userId: String(doc.addedBy?.userId ?? ''),
      displayName: String(doc.addedBy?.displayName ?? '').trim(),
    },
    storeName: String(doc.storeName ?? '').trim(),
    totalAmount: Number(doc.totalAmount) || 0,
    purchaseDate:
      doc.purchaseDate instanceof Date
        ? doc.purchaseDate.toISOString()
        : doc.purchaseDate
          ? new Date(doc.purchaseDate).toISOString()
          : null,
    receiptImageUrl: doc.receiptImageUrl ? String(doc.receiptImageUrl) : null,
    savedToVault: doc.savedToVault !== false,
    createdAt:
      doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt ?? null,
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
  return mapExpense({ ...doc, _id: result.insertedId });
}

/**
 * @param {string} householdId
 * @param {'weekly'|'fortnightly'|'monthly'|string} timeframe
 */
export async function listExpenses(householdId, timeframe = 'weekly') {
  const scopedId = assertScopedHouseholdId(householdId);
  const start = timeframeStartDate(timeframe);
  const docs = await getExpensesCollection()
    .find({
      householdId: scopedId,
      purchaseDate: { $gte: start },
    })
    .sort({ purchaseDate: -1, createdAt: -1 })
    .toArray();
  return docs.map(mapExpense);
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

/**
 * @param {string} householdId
 * @param {string} expenseId
 * @param {string} [requestingUserId]
 */
export async function deleteExpense(householdId, expenseId, requestingUserId) {
  const scopedId = assertScopedHouseholdId(householdId);
  const id = String(expenseId ?? '').trim();
  if (!ObjectId.isValid(id)) {
    const err = new Error('Expense not found.');
    err.status = 404;
    throw err;
  }

  const col = getExpensesCollection();
  const existing = await col.findOne({ _id: new ObjectId(id), householdId: scopedId });
  if (!existing) {
    const err = new Error('Expense not found.');
    err.status = 404;
    throw err;
  }

  await col.deleteOne({ _id: existing._id });
  return { ok: true, id };
}

export async function ensureExpensesIndexes() {
  const col = getExpensesCollection();
  await col.createIndex({ householdId: 1, purchaseDate: -1 });
  await col.createIndex({ householdId: 1, 'addedBy.userId': 1 });
}
