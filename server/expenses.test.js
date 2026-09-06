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
  canManageVaultReceipt,
  deleteExpense,
  isWithinReceiptRestoreWindow,
  listDeletedExpenses,
  listExpenses,
  RECEIPT_SOFT_DELETE_DAYS,
  receiptRestoreCutoff,
  receiptRestoreDeadline,
  restoreExpense,
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

function setupCollection(docs) {
  const col = {
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
  globalThis._mongo = {
    db: {
      collection() {
        return col;
      },
    },
  };
  return { docs, col };
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
