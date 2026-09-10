import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const isHouseholdOwner = vi.fn();
const getHouseholdMembers = vi.fn();

vi.mock('./db.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isHouseholdOwner: (...args) => isHouseholdOwner(...args),
    getHouseholdMembers: (...args) => getHouseholdMembers(...args),
  };
});

import {
  applyExpensePayments,
  buildSettlementTransfers,
  canManageVaultReceipt,
  deleteExpense,
  EXPENSE_PAYMENTS_COLLECTION,
  getExpenseSplit,
  isWithinReceiptRestoreWindow,
  listDeletedExpenses,
  listExpenses,
  RECEIPT_SOFT_DELETE_DAYS,
  receiptRestoreCutoff,
  receiptRestoreDeadline,
  restoreExpense,
  settleAllExpenseBalances,
  settleExpenseBalance,
  undoExpensePayment,
} from './expenses.js';

const HOUSEHOLD_ID = new ObjectId().toString();
const ADDER_ID = new ObjectId().toString();
const OWNER_ID = new ObjectId().toString();
const OTHER_ID = new ObjectId().toString();

function matchesQuery(doc, query = {}) {
  for (const [key, value] of Object.entries(query)) {
    if (key === '$or') {
      if (!value.some((clause) => matchesQuery(doc, clause))) return false;
      continue;
    }
    const current = doc[key];
    if (value instanceof ObjectId) {
      if (!current || !new ObjectId(current).equals(value)) return false;
      continue;
    }
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('$exists' in value) {
        const exists = current !== undefined && current !== null;
        if (Boolean(value.$exists) !== exists && !('$gte' in value || '$lte' in value)) {
          return false;
        }
        if (value.$exists === false && exists) return false;
        if (value.$exists === true && !exists && !('$gte' in value || '$lte' in value)) return false;
      }
      if ('$gte' in value) {
        if (current == null || new Date(current).getTime() < new Date(value.$gte).getTime()) {
          return false;
        }
      }
      if ('$lte' in value) {
        if (current == null || new Date(current).getTime() > new Date(value.$lte).getTime()) {
          return false;
        }
      }
      continue;
    }
    if (key === '_id') {
      if (!doc._id.equals(value)) return false;
      continue;
    }
    if (doc[key] !== value) return false;
  }
  return true;
}

function makeCollection(docs) {
  return {
    async findOne(query) {
      return docs.find((doc) => matchesQuery(doc, query)) ?? null;
    },
    find(query) {
      const matched = docs.filter((doc) => matchesQuery(doc, query));
      return {
        sort() {
          return {
            async toArray() {
              return matched;
            },
          };
        },
      };
    },
    async insertOne(doc) {
      const _id = doc._id instanceof ObjectId ? doc._id : new ObjectId();
      const stored = { ...doc, _id };
      docs.push(stored);
      return { insertedId: _id };
    },
    async updateOne(query, update) {
      const doc = docs.find((entry) => matchesQuery(entry, query));
      if (!doc) return { modifiedCount: 0 };
      if (update.$set) Object.assign(doc, update.$set);
      if (update.$unset) {
        for (const key of Object.keys(update.$unset)) delete doc[key];
      }
      return { modifiedCount: 1 };
    },
    async deleteOne(query) {
      const index = docs.findIndex((entry) => matchesQuery(entry, query));
      if (index < 0) return { deletedCount: 0 };
      docs.splice(index, 1);
      return { deletedCount: 1 };
    },
    async deleteMany(query) {
      const keep = docs.filter((entry) => !matchesQuery(entry, query));
      const deletedCount = docs.length - keep.length;
      docs.length = 0;
      docs.push(...keep);
      return { deletedCount };
    },
    async createIndex() {},
  };
}

function setupCollections({ expenses = [], payments = [] } = {}) {
  const expenseCol = makeCollection(expenses);
  const paymentCol = makeCollection(payments);
  globalThis._mongo = {
    db: {
      collection(name) {
        if (name === EXPENSE_PAYMENTS_COLLECTION) return paymentCol;
        return expenseCol;
      },
    },
  };
  return { docs: expenses, expenses, payments, expenseCol, paymentCol, col: expenseCol };
}

function setupCollection(docs) {
  return setupCollections({ expenses: docs });
}

function makeExpense(overrides = {}) {
  return {
    _id: new ObjectId(),
    householdId: HOUSEHOLD_ID,
    addedBy: { userId: ADDER_ID, displayName: 'Ada' },
    storeName: 'Woolworths',
    totalAmount: 42,
    purchaseDate: new Date(),
    receiptImageUrl: 'https://example.com/receipt.jpg',
    savedToVault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('receipt vault restore window', () => {
  it('is 30 days', () => {
    expect(RECEIPT_SOFT_DELETE_DAYS).toBe(30);
  });

  it('keeps restore open through day 30 and closed after', () => {
    const deletedAt = new Date('2026-01-01T00:00:00.000Z');
    const deadline = receiptRestoreDeadline(deletedAt);
    expect(deadline.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(isWithinReceiptRestoreWindow(deletedAt, deadline)).toBe(true);
    expect(
      isWithinReceiptRestoreWindow(deletedAt, new Date(deadline.getTime() + 1)),
    ).toBe(false);
    expect(receiptRestoreCutoff(deadline).toISOString()).toBe(deletedAt.toISOString());
  });
});

describe('canManageVaultReceipt', () => {
  it('allows the member who added the receipt', () => {
    expect(
      canManageVaultReceipt({
        addedByUserId: ADDER_ID,
        requestingUserId: ADDER_ID,
        isHouseholdOwner: false,
      }),
    ).toBe(true);
  });

  it('allows the household owner even if they did not add it', () => {
    expect(
      canManageVaultReceipt({
        addedByUserId: ADDER_ID,
        requestingUserId: OWNER_ID,
        isHouseholdOwner: true,
      }),
    ).toBe(true);
  });

  it('rejects other household members', () => {
    expect(
      canManageVaultReceipt({
        addedByUserId: ADDER_ID,
        requestingUserId: OTHER_ID,
        isHouseholdOwner: false,
      }),
    ).toBe(false);
  });
});

describe('deleteExpense and restoreExpense', () => {
  beforeEach(() => {
    isHouseholdOwner.mockReset();
    getHouseholdMembers.mockReset();
  });

  afterEach(() => {
    delete globalThis._mongo;
  });

  it('lets the adder soft-delete and later restore within 30 days', async () => {
    const expense = makeExpense();
    const { docs } = setupCollection([expense]);
    isHouseholdOwner.mockResolvedValue(false);

    const deleted = await deleteExpense(HOUSEHOLD_ID, expense._id.toString(), ADDER_ID);
    expect(deleted.ok).toBe(true);
    expect(docs[0].deletedAt).toBeInstanceOf(Date);

    const restored = await restoreExpense(HOUSEHOLD_ID, expense._id.toString(), ADDER_ID);
    expect(restored.ok).toBe(true);
    expect(docs[0].deletedAt).toBeUndefined();
    expect(restored.expense.canDelete).toBe(true);
  });

  it('lets the household owner delete a receipt they did not add', async () => {
    const expense = makeExpense();
    setupCollection([expense]);
    isHouseholdOwner.mockImplementation(async (_householdId, userId) => userId === OWNER_ID);

    const result = await deleteExpense(HOUSEHOLD_ID, expense._id.toString(), OWNER_ID);
    expect(result.ok).toBe(true);
    expect(result.expense.deletedAt).toBeTruthy();
  });

  it('forbids other members from deleting', async () => {
    const expense = makeExpense();
    setupCollection([expense]);
    isHouseholdOwner.mockResolvedValue(false);

    await expect(
      deleteExpense(HOUSEHOLD_ID, expense._id.toString(), OTHER_ID),
    ).rejects.toMatchObject({
      status: 403,
      message: 'Only the person who added this receipt or the household owner can delete it.',
    });
  });

  it('refuses restore after the 30-day window and purges the receipt', async () => {
    const expired = makeExpense({
      deletedAt: new Date('2025-01-01T00:00:00.000Z'),
    });
    const { docs } = setupCollection([expired]);
    isHouseholdOwner.mockResolvedValue(false);

    await expect(
      restoreExpense(HOUSEHOLD_ID, expired._id.toString(), ADDER_ID),
    ).rejects.toMatchObject({ status: 404 });
    expect(docs).toHaveLength(0);
  });

  it('forbids other members from restoring a deleted receipt', async () => {
    const expense = makeExpense({ deletedAt: new Date() });
    setupCollection([expense]);
    isHouseholdOwner.mockResolvedValue(false);

    await expect(
      restoreExpense(HOUSEHOLD_ID, expense._id.toString(), OTHER_ID),
    ).rejects.toMatchObject({
      status: 403,
    });
  });

  it('hides deleted receipts from the active vault list', async () => {
    const live = makeExpense();
    const removed = makeExpense({ deletedAt: new Date() });
    setupCollection([live, removed]);
    isHouseholdOwner.mockResolvedValue(false);

    const listed = await listExpenses(HOUSEHOLD_ID, 'monthly', ADDER_ID);
    expect(listed.map((entry) => entry.id)).toEqual([live._id.toString()]);
    expect(listed[0].canDelete).toBe(true);

    const deleted = await listDeletedExpenses(HOUSEHOLD_ID, ADDER_ID);
    expect(deleted.map((entry) => entry.id)).toEqual([removed._id.toString()]);
    expect(deleted[0].canRestore).toBe(true);
  });
});

describe('expense split settlements', () => {
  beforeEach(() => {
    isHouseholdOwner.mockReset();
    getHouseholdMembers.mockReset();
    getHouseholdMembers.mockResolvedValue([
      { id: ADDER_ID, displayName: 'Ada', email: 'ada@example.com' },
      { id: OTHER_ID, displayName: 'Bob', email: 'bob@example.com' },
    ]);
    isHouseholdOwner.mockImplementation(async (_householdId, userId) => userId === OWNER_ID);
  });

  afterEach(() => {
    delete globalThis._mongo;
  });

  it('applies a repayment so the debtor covers the creditor', () => {
    const adjusted = applyExpensePayments(
      [
        { userId: ADDER_ID, displayName: 'Ada', total: 100 },
        { userId: OTHER_ID, displayName: 'Bob', total: 0 },
      ],
      [{ fromUserId: OTHER_ID, toUserId: ADDER_ID, amount: 50 }],
    );
    expect(adjusted.find((row) => row.userId === ADDER_ID).total).toBe(50);
    expect(adjusted.find((row) => row.userId === OTHER_ID).total).toBe(50);
  });

  it('builds a single transfer from the member who spent less', () => {
    const transfers = buildSettlementTransfers([
      { userId: ADDER_ID, displayName: 'Ada', total: 100, balance: 50 },
      { userId: OTHER_ID, displayName: 'Bob', total: 0, balance: -50 },
    ]);
    expect(transfers).toEqual([
      {
        fromUserId: OTHER_ID,
        fromName: 'Bob',
        toUserId: ADDER_ID,
        toName: 'Ada',
        amount: 50,
      },
    ]);
  });

  it('records a settlement and clears the remaining balance', async () => {
    const expense = makeExpense({ totalAmount: 80 });
    const { payments } = setupCollections({ expenses: [expense] });

    const before = await getExpenseSplit(HOUSEHOLD_ID, 'monthly', OTHER_ID);
    expect(before.settlements).toEqual([
      expect.objectContaining({
        fromUserId: OTHER_ID,
        toUserId: ADDER_ID,
        amount: 40,
      }),
    ]);
    expect(before.contributions.find((row) => row.userId === ADDER_ID).balance).toBe(40);

    const settled = await settleExpenseBalance({
      householdId: HOUSEHOLD_ID,
      timeframe: 'monthly',
      fromUserId: OTHER_ID,
      toUserId: ADDER_ID,
      createdByUserId: OTHER_ID,
    });

    expect(settled.settlements).toEqual([]);
    expect(settled.payments).toHaveLength(1);
    expect(settled.payments[0]).toMatchObject({
      fromUserId: OTHER_ID,
      toUserId: ADDER_ID,
      amount: 40,
      canUndo: true,
    });
    expect(settled.contributions.find((row) => row.userId === OTHER_ID).balance).toBe(0);
    expect(payments).toHaveLength(1);
  });

  it('allows a partial settlement and keeps the remainder', async () => {
    const expense = makeExpense({ totalAmount: 80 });
    setupCollections({ expenses: [expense] });

    const settled = await settleExpenseBalance({
      householdId: HOUSEHOLD_ID,
      timeframe: 'monthly',
      fromUserId: OTHER_ID,
      toUserId: ADDER_ID,
      amount: 15,
      createdByUserId: ADDER_ID,
    });

    expect(settled.settlements).toEqual([
      expect.objectContaining({
        fromUserId: OTHER_ID,
        toUserId: ADDER_ID,
        amount: 25,
      }),
    ]);
  });

  it('rejects settling more than the outstanding balance', async () => {
    const expense = makeExpense({ totalAmount: 80 });
    setupCollections({ expenses: [expense] });

    await expect(
      settleExpenseBalance({
        householdId: HOUSEHOLD_ID,
        timeframe: 'monthly',
        fromUserId: OTHER_ID,
        toUserId: ADDER_ID,
        amount: 99,
        createdByUserId: OTHER_ID,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('settles every outstanding transfer at once', async () => {
    getHouseholdMembers.mockResolvedValue([
      { id: ADDER_ID, displayName: 'Ada' },
      { id: OTHER_ID, displayName: 'Bob' },
      { id: OWNER_ID, displayName: 'Cam' },
    ]);
    const expense = makeExpense({ totalAmount: 90 });
    setupCollections({ expenses: [expense] });

    const result = await settleAllExpenseBalances(HOUSEHOLD_ID, 'monthly', OWNER_ID);
    expect(result.recordedCount).toBe(2);
    expect(result.settlements).toEqual([]);
    expect(result.payments).toHaveLength(2);
  });

  it('lets a party undo a recorded settlement', async () => {
    const expense = makeExpense({ totalAmount: 80 });
    setupCollections({ expenses: [expense] });

    const settled = await settleExpenseBalance({
      householdId: HOUSEHOLD_ID,
      timeframe: 'monthly',
      fromUserId: OTHER_ID,
      toUserId: ADDER_ID,
      createdByUserId: ADDER_ID,
    });
    expect(settled.settlements).toEqual([]);

    const undone = await undoExpensePayment(
      HOUSEHOLD_ID,
      settled.payment.id,
      OTHER_ID,
      'monthly',
    );
    expect(undone.settlements).toEqual([
      expect.objectContaining({ fromUserId: OTHER_ID, toUserId: ADDER_ID, amount: 40 }),
    ]);
  });

  it('forbids an unrelated member from undoing a settlement', async () => {
    const expense = makeExpense({ totalAmount: 80 });
    setupCollections({ expenses: [expense] });
    const outsiderId = new ObjectId().toString();

    const settled = await settleExpenseBalance({
      householdId: HOUSEHOLD_ID,
      timeframe: 'monthly',
      fromUserId: OTHER_ID,
      toUserId: ADDER_ID,
      createdByUserId: OTHER_ID,
    });

    isHouseholdOwner.mockResolvedValue(false);
    await expect(
      undoExpensePayment(HOUSEHOLD_ID, settled.payment.id, outsiderId, 'monthly'),
    ).rejects.toMatchObject({ status: 403 });
  });
});
