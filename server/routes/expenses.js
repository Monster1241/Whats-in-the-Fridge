import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../routeUtils.js';
import { findUserById } from '../db.js';
import {
  createExpense,
  deleteExpense,
  ensureExpensesIndexes,
  getExpenseSplit,
  listDeletedExpenses,
  listExpenses,
  restoreExpense,
  settleAllExpenseBalances,
  settleExpenseBalance,
  undoExpensePayment,
} from '../expenses.js';

export const expensesRouter = Router();

expensesRouter.use(requireAuth);

let indexesReady = false;
async function readyIndexes() {
  if (indexesReady) return;
  await ensureExpensesIndexes();
  indexesReady = true;
}

function normalizeTimeframe(value) {
  const raw = String(value ?? 'weekly').trim().toLowerCase();
  if (raw === 'fortnightly' || raw === 'monthly') return raw;
  return 'weekly';
}

expensesRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    await readyIndexes().catch(() => {});
    const user = await findUserById(req.user.id);
    const expense = await createExpense({
      householdId: req.user.household_id,
      userId: req.user.id,
      displayName: user?.displayName || req.user.email || '',
      storeName: req.body?.storeName,
      totalAmount: req.body?.totalAmount,
      purchaseDate: req.body?.purchaseDate,
      receiptImageUrl: req.body?.receiptImageUrl,
      savedToVault: req.body?.savedToVault,
    });
    res.status(201).json({ ok: true, expense });
  }, 'POST /api/expenses', 'Could not add expense'),
);

expensesRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    await readyIndexes().catch(() => {});
    const timeframe = normalizeTimeframe(req.query?.timeframe);
    const expenses = await listExpenses(req.user.household_id, timeframe, req.user.id);
    const total =
      Math.round(
        expenses.reduce((sum, entry) => sum + (Number(entry.totalAmount) || 0), 0) * 100,
      ) / 100;
    res.status(200).json({ ok: true, timeframe, total, expenses });
  }, 'GET /api/expenses', 'Could not load expenses'),
);

expensesRouter.get(
  '/deleted',
  asyncRoute(async (req, res) => {
    await readyIndexes().catch(() => {});
    const expenses = await listDeletedExpenses(req.user.household_id, req.user.id);
    res.status(200).json({ ok: true, expenses });
  }, 'GET /api/expenses/deleted', 'Could not load deleted receipts'),
);

expensesRouter.get(
  '/split',
  asyncRoute(async (req, res) => {
    await readyIndexes().catch(() => {});
    const timeframe = normalizeTimeframe(req.query?.timeframe);
    const split = await getExpenseSplit(req.user.household_id, timeframe, req.user.id);
    res.status(200).json({ ok: true, ...split });
  }, 'GET /api/expenses/split', 'Could not calculate split'),
);

expensesRouter.post(
  '/settle',
  asyncRoute(async (req, res) => {
    await readyIndexes().catch(() => {});
    const timeframe = normalizeTimeframe(req.body?.timeframe ?? req.query?.timeframe);
    if (req.body?.settleAll) {
      const result = await settleAllExpenseBalances(
        req.user.household_id,
        timeframe,
        req.user.id,
      );
      res.status(200).json(result);
      return;
    }
    const result = await settleExpenseBalance({
      householdId: req.user.household_id,
      timeframe,
      fromUserId: req.body?.fromUserId,
      toUserId: req.body?.toUserId,
      amount: req.body?.amount,
      createdByUserId: req.user.id,
    });
    res.status(201).json(result);
  }, 'POST /api/expenses/settle', 'Could not record settlement'),
);

expensesRouter.delete(
  '/settlements/:id',
  asyncRoute(async (req, res) => {
    await readyIndexes().catch(() => {});
    const timeframe = normalizeTimeframe(req.query?.timeframe);
    const result = await undoExpensePayment(
      req.user.household_id,
      req.params.id,
      req.user.id,
      timeframe,
    );
    res.status(200).json(result);
  }, 'DELETE /api/expenses/settlements/:id', 'Could not undo settlement'),
);

expensesRouter.post(
  '/:id/restore',
  asyncRoute(async (req, res) => {
    await readyIndexes().catch(() => {});
    const result = await restoreExpense(req.user.household_id, req.params.id, req.user.id);
    res.status(200).json(result);
  }, 'POST /api/expenses/:id/restore', 'Could not restore receipt'),
);

expensesRouter.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    await readyIndexes().catch(() => {});
    const result = await deleteExpense(req.user.household_id, req.params.id, req.user.id);
    res.status(200).json(result);
  }, 'DELETE /api/expenses/:id', 'Could not delete expense'),
);
