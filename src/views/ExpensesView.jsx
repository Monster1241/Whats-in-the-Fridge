import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Image as ImageIcon,
  Loader2,
  Plus,
  Receipt,
  RotateCcw,
  Scale,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  createExpense,
  deleteExpense,
  fetchDeletedExpenses,
  fetchExpenseSplit,
  fetchExpenses,
  restoreExpense,
} from '../api.js';
import { getActiveHouseholdId } from '../inventory/offlineCache.js';
import {
  captureReceiptFromCamera,
  isNativeReceiptCapture,
  pickReceiptFromGallery,
} from '../utils/receiptCapture.js';
import { uploadReceiptPhoto } from '../utils/receiptStorage.js';
import { currencyShortLabel, formatMoney, normalizeCurrency } from '../utils/currency.js';
import {
  describeTimeframe,
  TIMEFRAME_OPTIONS,
  timeframeDayCount,
} from '../utils/expenseTimeframe.js';

const STORE_SUGGESTIONS = ['Woolworths', 'Coles', 'ALDI', 'Local Market'];

function formatDateLabel(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function todayInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysLeftToRestore(restoreUntil, now = Date.now()) {
  if (!restoreUntil) return 0;
  const end = new Date(restoreUntil).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
}

function ModalShell({ titleId, children, onClose, wide = false }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className={`surface-card max-h-[min(92vh,760px)] w-full overflow-y-auto p-5 shadow-2xl ${
          wide ? 'max-w-lg' : 'max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function ImageViewerModal({ url, onClose }) {
  if (typeof document === 'undefined' || !url) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex flex-col bg-black/90"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Receipt photo"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur"
        aria-label="Close receipt photo"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
      <div className="flex flex-1 items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <img
          src={url}
          alt="Receipt"
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />
      </div>
    </div>,
    document.body,
  );
}

function RecentlyDeletedScreen({
  expenses,
  loading,
  restoringId,
  error,
  money,
  onBack,
  onRetry,
  onRestore,
  onView,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onBack();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  return (
    <div className="pb-8">
      <button
        type="button"
        onClick={onBack}
        className="text-muted mb-5 inline-flex items-center gap-2 rounded-lg py-1.5 pr-2 text-sm font-semibold transition hover:text-amber-800 active:scale-[0.98] dark:hover:text-amber-300"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </button>

      <header className="mb-5">
        <h1 className="text-heading flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <RotateCcw className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
          Recently deleted
        </h1>
        <p className="text-muted mt-1 text-sm leading-relaxed">
          The person who added a receipt, or the household owner, can restore it for 30 days.
          After that it is removed for good.
        </p>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
          {onRetry ? (
            <button type="button" onClick={onRetry} className="ml-2 font-semibold underline">
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="surface-card flex items-center justify-center gap-2 p-8 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading deleted receipts…
        </div>
      ) : expenses.length === 0 ? (
        <div className="surface-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-300">
            <RotateCcw className="h-6 w-6" aria-hidden />
          </div>
          <p className="text-heading text-sm font-semibold">Nothing to restore</p>
          <p className="text-muted mt-1 text-xs leading-relaxed">
            Deleted receipts appear here for 30 days, then they are removed for good.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {expenses.map((expense) => {
            const daysLeft = daysLeftToRestore(expense.restoreUntil);
            return (
              <li key={expense.id} className="surface-card flex items-center gap-3 p-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/[0.04] dark:bg-white/[0.06]">
                  {expense.receiptImageUrl ? (
                    <button
                      type="button"
                      onClick={() => onView(expense.receiptImageUrl)}
                      className="h-full w-full"
                      aria-label={`View ${expense.storeName} receipt`}
                    >
                      <img
                        src={expense.receiptImageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ) : (
                    <div className="text-muted flex h-full items-center justify-center">
                      <ImageIcon className="h-4 w-4 opacity-50" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-heading truncate text-sm font-bold">{expense.storeName}</p>
                  <p className="text-muted truncate text-xs">
                    {money(expense.totalAmount)} · {formatDateLabel(expense.purchaseDate)}
                    {expense.addedBy?.displayName ? ` · ${expense.addedBy.displayName}` : ''}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    {daysLeft === 1 ? '1 day left to restore' : `${daysLeft} days left to restore`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-1.5">
                  {expense.receiptImageUrl ? (
                    <button
                      type="button"
                      onClick={() => onView(expense.receiptImageUrl)}
                      className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/[0.08] px-3 text-xs font-bold dark:border-white/15"
                    >
                      View
                    </button>
                  ) : null}
                  {expense.canRestore ? (
                    <button
                      type="button"
                      onClick={() => void onRestore(expense.id)}
                      disabled={restoringId === expense.id}
                      className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-black/[0.08] px-3 text-xs font-bold dark:border-white/15"
                    >
                      {restoringId === expense.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      ) : (
                        <RotateCcw className="h-3 w-3" aria-hidden />
                      )}
                      Restore
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ExpensesView({ currency: currencyProp }) {
  const currency = normalizeCurrency(currencyProp);
  const money = (amount) => formatMoney(amount, currency);
  const currencyCode = currencyShortLabel(currency);
  const addTitleId = useId();
  const splitTitleId = useId();
  const isNative = isNativeReceiptCapture();
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [timeframe, setTimeframe] = useState('weekly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [storeName, setStoreName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayInputValue);
  const [saveToVault, setSaveToVault] = useState(true);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [splitOpen, setSplitOpen] = useState(false);
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitError, setSplitError] = useState(null);
  const [splitData, setSplitData] = useState(null);

  const [viewerUrl, setViewerUrl] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deletedExpenses, setDeletedExpenses] = useState([]);
  const [restoringId, setRestoringId] = useState(null);
  const [deletedOpen, setDeletedOpen] = useState(false);

  const period = useMemo(() => describeTimeframe(timeframe), [timeframe]);
  const periodDays = timeframeDayCount(timeframe);

  const contributions = useMemo(() => {
    /** @type {Map<string, { id: string, name: string, total: number, count: number }>} */
    const map = new Map();
    for (const expense of expenses) {
      const userId = expense.addedBy?.userId || 'unknown';
      const name = expense.addedBy?.displayName || 'Member';
      const existing = map.get(userId);
      if (existing) {
        existing.total = Math.round((existing.total + Number(expense.totalAmount || 0)) * 100) / 100;
        existing.count += 1;
      } else {
        map.set(userId, { id: userId, name, total: Number(expense.totalAmount) || 0, count: 1 });
      }
    }
    const rows = [...map.values()].sort((a, b) => b.total - a.total);
    return rows.map((entry) => ({
      ...entry,
      share: total > 0 ? Math.round((entry.total / total) * 100) : 0,
    }));
  }, [expenses, total]);

  const periodStats = useMemo(() => {
    const photoCount = expenses.filter((expense) => expense.receiptImageUrl).length;
    const dailyAverage = periodDays > 0 ? Math.round((total / periodDays) * 100) / 100 : 0;
    return {
      receiptCount: expenses.length,
      photoCount,
      dailyAverage,
    };
  }, [expenses, periodDays, total]);

  const loadExpenses = useCallback(async (selectedTimeframe = timeframe, options = {}) => {
    const silent = Boolean(options.silent);
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [data, deletedData] = await Promise.all([
        fetchExpenses(selectedTimeframe),
        fetchDeletedExpenses().catch(() => ({ expenses: [] })),
      ]);
      setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
      setTotal(Number(data.total) || 0);
      setDeletedExpenses(Array.isArray(deletedData?.expenses) ? deletedData.expenses : []);
      if (silent) setError(null);
    } catch (err) {
      setError(err?.message || 'Could not load expenses.');
      if (!silent) {
        setExpenses([]);
        setTotal(0);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    void loadExpenses(timeframe);
  }, [timeframe, loadExpenses]);

  useEffect(() => {
    return () => {
      if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    };
  }, [receiptPreview]);

  const clearReceiptSelection = () => {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const assignReceiptFile = (file) => {
    if (!file) return;
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
    setFormError(null);
  };

  const openCamera = async () => {
    setFormError(null);
    if (isNative) {
      try {
        const file = await captureReceiptFromCamera();
        if (file) assignReceiptFile(file);
      } catch (err) {
        setFormError(err?.message || 'Could not open camera.');
      }
      return;
    }
    cameraInputRef.current?.click();
  };

  const openGallery = async () => {
    setFormError(null);
    if (isNative) {
      try {
        const file = await pickReceiptFromGallery();
        if (file) assignReceiptFile(file);
      } catch (err) {
        setFormError(err?.message || 'Could not open gallery.');
      }
      return;
    }
    fileInputRef.current?.click();
  };

  const resetAddForm = () => {
    setAmount('');
    setStoreName('');
    setPurchaseDate(todayInputValue());
    setSaveToVault(true);
    clearReceiptSelection();
    setFormError(null);
    setSubmitting(false);
  };

  const openAddExpense = () => {
    resetAddForm();
    setAddOpen(true);
  };

  /** Opens add-expense with vault on, then launches camera for quick receipt capture. */
  const openAddReceipt = () => {
    resetAddForm();
    setSaveToVault(true);
    setAddOpen(true);
    window.setTimeout(() => {
      void openCamera();
    }, 180);
  };

  const closeAddModal = () => {
    if (submitting) return;
    setAddOpen(false);
    resetAddForm();
  };

  const handleSubmitExpense = async (event) => {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setFormError(`Enter a valid total amount in ${currencyCode}.`);
      return;
    }
    if (!String(storeName).trim()) {
      setFormError('Enter a store name.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      let receiptImageUrl = null;
      if (receiptFile && saveToVault) {
        const householdId = getActiveHouseholdId();
        if (!householdId) {
          throw new Error('Household session missing. Sign in again, then retry.');
        }
        try {
          receiptImageUrl = await uploadReceiptPhoto(householdId, receiptFile);
        } catch (uploadErr) {
          throw new Error(
            uploadErr?.message ||
              'Receipt upload failed. Check your connection and Firebase Storage rules.',
          );
        }
      }

      await createExpense({
        totalAmount: parsedAmount,
        storeName: String(storeName).trim(),
        purchaseDate,
        receiptImageUrl,
        savedToVault: saveToVault,
      });

      setAddOpen(false);
      resetAddForm();
      await loadExpenses(timeframe);
    } catch (err) {
      setFormError(err?.message || 'Could not save expense.');
      setSubmitting(false);
    }
  };

  const openSplitModal = async () => {
    setSplitOpen(true);
    setSplitLoading(true);
    setSplitError(null);
    setSplitData(null);
    try {
      const data = await fetchExpenseSplit(timeframe);
      setSplitData(data);
    } catch (err) {
      setSplitError(err?.message || 'Could not calculate split.');
    } finally {
      setSplitLoading(false);
    }
  };

  const handleDelete = async (expenseId) => {
    if (!expenseId || deletingId || restoringId) return;
    const confirmed = window.confirm(
      'Delete this receipt from the vault? Only you or the household owner can do this. You can restore it for 30 days.',
    );
    if (!confirmed) return;
    setDeletingId(expenseId);
    try {
      await deleteExpense(expenseId);
      await loadExpenses(timeframe, { silent: true });
    } catch (err) {
      setError(err?.message || 'Could not delete receipt.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestore = async (expenseId) => {
    if (!expenseId || restoringId || deletingId) return;
    setRestoringId(expenseId);
    try {
      await restoreExpense(expenseId);
      await loadExpenses(timeframe, { silent: true });
    } catch (err) {
      setError(err?.message || 'Could not restore receipt.');
    } finally {
      setRestoringId(null);
    }
  };

  const closeDeletedScreen = useCallback(() => {
    setDeletedOpen(false);
  }, []);

  if (deletedOpen) {
    return (
      <>
        <RecentlyDeletedScreen
          expenses={deletedExpenses}
          loading={loading}
          restoringId={restoringId}
          error={error}
          money={money}
          onBack={closeDeletedScreen}
          onRetry={() => void loadExpenses(timeframe)}
          onRestore={handleRestore}
          onView={setViewerUrl}
        />
        {viewerUrl ? <ImageViewerModal url={viewerUrl} onClose={() => setViewerUrl(null)} /> : null}
      </>
    );
  }

  return (
    <div className="pb-8">
      <header className="mb-5">
        <h1 className="text-heading flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
          Expenses & Receipts
        </h1>
        <p className="text-muted mt-1 text-sm">
          Track household spend, split fairly, and keep receipt photos in your vault.
        </p>
      </header>

      <div
        className="mb-3 grid grid-cols-3 gap-2"
        role="tablist"
        aria-label="Spending period"
      >
        {TIMEFRAME_OPTIONS.map((option) => {
          const active = timeframe === option.id;
          const optionPeriod = describeTimeframe(option.id);
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`${option.label}, ${option.hint}, ${optionPeriod.rangeLabel}`}
              onClick={() => setTimeframe(option.id)}
              className={`min-h-[4.5rem] rounded-2xl border px-2 py-2.5 text-center transition active:scale-[0.98] ${
                active
                  ? 'border-amber-400 bg-amber-50 shadow-sm dark:border-amber-600 dark:bg-amber-950/50'
                  : 'border-black/[0.08] bg-white hover:border-amber-200 hover:bg-amber-50/40 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-amber-800 dark:hover:bg-amber-950/20'
              }`}
            >
              <span
                className={`block text-sm font-extrabold ${
                  active ? 'text-amber-900 dark:text-amber-200' : 'text-heading'
                }`}
              >
                {option.label}
              </span>
              <span className="text-muted mt-0.5 block text-[11px] font-semibold leading-tight">
                {option.hint}
              </span>
              <span
                className={`mt-1 block text-[11px] font-bold leading-tight tabular-nums ${
                  active ? 'text-amber-800 dark:text-amber-300' : 'text-muted'
                }`}
              >
                {optionPeriod.rangeLabel}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-muted mb-4 text-xs leading-relaxed">
        Showing purchases from <span className="font-semibold text-slate-700 dark:text-zinc-200">{period.rangeLabel}</span>
        {' '}({period.days} days, including today).
      </p>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
          <button
            type="button"
            onClick={() => void loadExpenses(timeframe)}
            className="ml-2 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      <section className="mb-5 grid gap-3 sm:grid-cols-2">
        <article className="surface-card border-2 border-amber-200/80 p-4 dark:border-amber-800/50">
          <p className="text-muted flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            Household spend
          </p>
          <p className="text-heading mt-2 text-3xl font-extrabold tracking-tight">
            {loading ? '…' : money(total)}
          </p>
          <p className="text-muted mt-1 text-xs leading-relaxed">
            {period.rangeLabel} · {currencyCode}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-amber-50/80 px-2.5 py-2 dark:bg-amber-950/40">
              <dt className="text-muted font-semibold">Per day</dt>
              <dd className="text-heading mt-0.5 font-extrabold tabular-nums">
                {loading ? '…' : money(periodStats.dailyAverage)}
              </dd>
            </div>
            <div className="rounded-xl bg-amber-50/80 px-2.5 py-2 dark:bg-amber-950/40">
              <dt className="text-muted font-semibold">Receipts</dt>
              <dd className="text-heading mt-0.5 font-extrabold tabular-nums">
                {loading ? '…' : periodStats.receiptCount}
              </dd>
            </div>
          </dl>
        </article>

        <article className="surface-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-600" aria-hidden />
            <p className="text-heading text-sm font-bold">Who paid</p>
          </div>
          {loading ? (
            <p className="text-muted text-sm">Loading…</p>
          ) : contributions.length === 0 ? (
            <p className="text-muted text-sm">No spend logged in this {period.days}-day period yet.</p>
          ) : (
            <ul className="space-y-3">
              {contributions.map((entry) => (
                <li key={entry.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-heading truncate font-semibold">{entry.name}</span>
                    <span className="shrink-0 tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                      {money(entry.total)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.max(entry.share, entry.total > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <p className="text-muted mt-1 text-[11px]">
                    {entry.share}% of household spend · {entry.count === 1 ? '1 receipt' : `${entry.count} receipts`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openAddExpense}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-500 active:scale-[0.98] sm:flex-none"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add expense
        </button>
        <button
          type="button"
          onClick={() => void openSplitModal()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:flex-none"
        >
          <Scale className="h-4 w-4" aria-hidden />
          Calculate split
        </button>
      </div>

      <button
        type="button"
        onClick={() => setDeletedOpen(true)}
        className="surface-card mb-6 flex w-full items-center gap-3 p-3.5 text-left transition hover:bg-slate-50 active:scale-[0.99] dark:hover:bg-zinc-900/60"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
          <RotateCcw className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-heading block text-sm font-bold">Recently deleted</span>
          <span className="text-muted mt-0.5 block text-xs leading-relaxed">
            {loading
              ? 'Checking restore bin…'
              : deletedExpenses.length === 0
                ? 'Restore receipts here for 30 days'
                : deletedExpenses.length === 1
                  ? '1 receipt can be restored for 30 days'
                  : `${deletedExpenses.length} receipts can be restored for 30 days`}
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </button>

      <section>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-amber-600" aria-hidden />
              <h2 className="text-heading text-sm font-bold">Receipt vault</h2>
            </div>
            <p className="text-muted mt-1 text-xs leading-relaxed">
              {loading
                ? 'Loading this period…'
                : periodStats.receiptCount === 0
                  ? `Nothing saved for ${period.rangeLabel}.`
                  : `${periodStats.receiptCount === 1 ? '1 receipt' : `${periodStats.receiptCount} receipts`} · ${
                      periodStats.photoCount === 1 ? '1 photo' : `${periodStats.photoCount} photos`
                    } · ${period.rangeLabel}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAddReceipt()}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-500 active:scale-[0.98]"
          >
            <Camera className="h-3.5 w-3.5" aria-hidden />
            Add receipt
          </button>
        </div>

        {loading ? (
          <div className="surface-card flex items-center justify-center gap-2 p-8 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading expenses…
          </div>
        ) : expenses.length === 0 ? (
          <div className="surface-card p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              <Receipt className="h-6 w-6" aria-hidden />
            </div>
            <p className="text-heading text-sm font-semibold">No receipts in this period</p>
            <p className="text-muted mt-1 text-xs leading-relaxed">
              Nothing logged from {period.rangeLabel}. Snap a receipt or add an expense to start this {period.days}-day view.
            </p>
            <button
              type="button"
              onClick={() => openAddReceipt()}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-500 active:scale-[0.98]"
            >
              <Camera className="h-4 w-4" aria-hidden />
              Add receipt
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {expenses.map((expense) => (
              <li key={expense.id} className="surface-card p-3">
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={!expense.receiptImageUrl}
                    onClick={() => {
                      if (expense.receiptImageUrl) setViewerUrl(expense.receiptImageUrl);
                    }}
                    className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black/[0.04] disabled:cursor-default dark:bg-white/[0.06]"
                    aria-label={expense.receiptImageUrl ? `View ${expense.storeName} receipt` : undefined}
                  >
                    {expense.receiptImageUrl ? (
                      <img
                        src={expense.receiptImageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-muted flex h-full items-center justify-center">
                        <ImageIcon className="h-5 w-5 opacity-50" aria-hidden />
                      </span>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-heading truncate text-sm font-bold">{expense.storeName}</p>
                      <p className="shrink-0 text-sm font-extrabold tabular-nums text-amber-700 dark:text-amber-400">
                        {money(expense.totalAmount)}
                      </p>
                    </div>
                    <p className="text-muted mt-0.5 text-xs leading-relaxed">
                      {formatDateLabel(expense.purchaseDate)}
                      {expense.addedBy?.displayName ? ` · Added by ${expense.addedBy.displayName}` : ''}
                    </p>
                    <p className="text-muted mt-0.5 text-[11px] font-semibold">
                      {expense.receiptImageUrl ? 'Photo saved in vault' : 'Logged without a photo'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {expense.receiptImageUrl ? (
                        <button
                          type="button"
                          onClick={() => setViewerUrl(expense.receiptImageUrl)}
                          className="inline-flex min-h-9 items-center rounded-full border border-black/[0.08] px-3 text-xs font-bold dark:border-white/15"
                        >
                          View photo
                        </button>
                      ) : null}
                      {expense.canDelete ? (
                        <button
                          type="button"
                          onClick={() => void handleDelete(expense.id)}
                          disabled={deletingId === expense.id}
                          className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                        >
                          {deletingId === expense.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="h-3 w-3" aria-hidden />
                          )}
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {addOpen && (
        <ModalShell titleId={addTitleId} onClose={closeAddModal} wide>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 id={addTitleId} className="text-heading text-lg font-extrabold">
                Add expense
              </h2>
              <p className="text-muted mt-0.5 text-xs">Log spend and optionally vault the receipt.</p>
            </div>
            <button
              type="button"
              onClick={closeAddModal}
              className="text-muted rounded-lg p-1.5 hover:bg-black/[0.05] dark:hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmitExpense}>
            <label className="block space-y-1.5">
              <span className="text-heading text-xs font-bold">Total amount ({currencyCode})</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field"
                placeholder="0.00"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-heading text-xs font-bold">Store name</span>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                list="expense-store-suggestions"
                className="input-field"
                placeholder="Woolworths, Coles, ALDI…"
                maxLength={80}
              />
              <datalist id="expense-store-suggestions">
                {STORE_SUGGESTIONS.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>

            <label className="block space-y-1.5">
              <span className="text-heading text-xs font-bold">Purchase date</span>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="input-field"
              />
            </label>

            <div className="space-y-2">
              <span className="text-heading text-xs font-bold">Receipt photo</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void openCamera()}
                  className="inline-flex items-center gap-2 rounded-xl border border-black/[0.1] px-3 py-2 text-xs font-bold dark:border-white/15"
                >
                  <Camera className="h-4 w-4" aria-hidden />
                  Camera
                </button>
                <button
                  type="button"
                  onClick={() => void openGallery()}
                  className="inline-flex items-center gap-2 rounded-xl border border-black/[0.1] px-3 py-2 text-xs font-bold dark:border-white/15"
                >
                  <ImageIcon className="h-4 w-4" aria-hidden />
                  Gallery
                </button>
                {receiptFile && (
                  <button
                    type="button"
                    onClick={clearReceiptSelection}
                    className="text-muted text-xs font-semibold underline"
                  >
                    Remove photo
                  </button>
                )}
              </div>
              {receiptPreview && (
                <img
                  src={receiptPreview}
                  alt="Selected receipt preview"
                  className="mt-2 h-28 w-full rounded-xl object-cover"
                />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  assignReceiptFile(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  assignReceiptFile(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
              />
            </div>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.08] px-3 py-3 dark:border-white/10">
              <span className="text-heading text-xs font-semibold leading-snug">
                Save receipt photo to household vault?
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={saveToVault}
                onChange={(e) => setSaveToVault(e.target.checked)}
                className="h-5 w-9 accent-amber-600"
              />
            </label>

            {formError && (
              <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                {formError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={closeAddModal}
                disabled={submitting}
                className="flex-1 rounded-xl border border-black/[0.08] py-3 text-sm font-semibold dark:border-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  'Save expense'
                )}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {splitOpen && (
        <ModalShell
          titleId={splitTitleId}
          onClose={() => {
            if (!splitLoading) setSplitOpen(false);
          }}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 id={splitTitleId} className="text-heading text-lg font-extrabold">
                Settlement split
              </h2>
              <p className="text-muted mt-0.5 text-xs leading-relaxed">
                Equal share of household spend from {period.rangeLabel} ({period.days} days).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSplitOpen(false)}
              className="text-muted rounded-lg p-1.5 hover:bg-black/[0.05] dark:hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {splitLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Calculating…
            </div>
          ) : splitError ? (
            <p className="text-sm text-rose-700 dark:text-rose-400">{splitError}</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm dark:bg-amber-950/40">
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  Total {money(splitData?.total)} · fair share {money(splitData?.fairShare)} each
                </p>
                <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80">
                  {period.rangeLabel} · {period.days} days
                </p>
              </div>

              {Array.isArray(splitData?.contributions) && splitData.contributions.length > 0 ? (
                <ul className="space-y-2">
                  {splitData.contributions.map((entry) => {
                    const paid = Number(entry.total) || 0;
                    const fair = Number(splitData.fairShare) || 0;
                    const delta = Math.round((paid - fair) * 100) / 100;
                    const settled = Math.abs(delta) < 0.01;
                    return (
                      <li
                        key={entry.userId}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="text-heading min-w-0 truncate font-semibold">
                          {entry.displayName}
                        </span>
                        <span className="shrink-0 text-right text-xs">
                          <span className="text-heading block font-bold tabular-nums">{money(paid)} paid</span>
                          <span
                            className={`font-semibold ${
                              settled
                                ? 'text-muted'
                                : delta > 0
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {settled
                              ? 'Settled'
                              : delta > 0
                                ? `${money(delta)} over`
                                : `${money(-delta)} short`}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {Array.isArray(splitData?.settlements) && splitData.settlements.length > 0 ? (
                <ul className="space-y-2">
                  {splitData.settlements.map((row) => (
                    <li
                      key={`${row.fromUserId}-${row.toUserId}-${row.amount}`}
                      className="surface-card border border-black/[0.06] px-3 py-2.5 text-sm dark:border-white/10"
                    >
                      <span className="text-heading font-semibold">{row.fromName}</span>
                      {' owes '}
                      <span className="text-heading font-semibold">{row.toName}</span>
                      {' '}
                      <span className="font-extrabold text-amber-700 dark:text-amber-400">
                        {money(row.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted text-sm">
                  Everyone is settled for this period — no balances to pay.
                </p>
              )}
            </div>
          )}
        </ModalShell>
      )}

      {viewerUrl && <ImageViewerModal url={viewerUrl} onClose={() => setViewerUrl(null)} />}
    </div>
  );
}
