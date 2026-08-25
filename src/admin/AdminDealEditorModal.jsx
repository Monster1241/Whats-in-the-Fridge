import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export const DEAL_STORES = ['coles', 'woolworths', 'aldi', 'harrisfarm', 'costco'];

export const DEAL_TYPES = [
  'Half Price',
  'Super Saver',
  'Price Drop',
  'Reduced',
  'Special Buy',
];

export const DEAL_CATEGORIES = ['Fresh', 'Pantry', 'Household', 'Baby'];

const EMPTY_FORM = {
  name: '',
  store: 'coles',
  dealPrice: '',
  originalPrice: '',
  dealType: 'Half Price',
  savingsText: 'Half Price!',
  category: 'Pantry',
};

function toForm(deal) {
  if (!deal) {
    return { ...EMPTY_FORM };
  }
  return {
    name: deal.name ?? '',
    store: deal.store ?? 'coles',
    dealPrice: deal.dealPrice != null ? String(deal.dealPrice) : '',
    originalPrice: deal.originalPrice != null ? String(deal.originalPrice) : '',
    dealType: deal.dealType ?? 'Half Price',
    savingsText: deal.savingsText ?? '',
    category: deal.category ?? 'Pantry',
  };
}

function parsePayload(form) {
  const dealPrice = Number(form.dealPrice);
  const originalRaw = String(form.originalPrice ?? '').trim();
  const originalPrice = originalRaw === '' ? null : Number(originalRaw);
  return {
    name: String(form.name ?? '').trim(),
    store: form.store,
    dealPrice,
    originalPrice,
    dealType: form.dealType,
    savingsText: String(form.savingsText ?? '').trim(),
    category: form.category,
  };
}

export function AdminDealEditorModal({
  mode,
  deal,
  defaultStore,
  busy,
  error,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() => {
    const base = toForm(deal);
    if (mode === 'create' && defaultStore) {
      base.store = defaultStore;
    }
    return base;
  });

  useEffect(() => {
    const base = toForm(deal);
    if (mode === 'create' && defaultStore) {
      base.store = defaultStore;
    }
    setForm(base);
  }, [deal, mode, defaultStore]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(parsePayload(form));
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deal-editor-title"
      onClick={onClose}
    >
      <div
        className="surface-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="deal-editor-title" className="text-heading text-lg font-bold">
              {mode === 'create' ? 'Add deal' : 'Edit deal'}
            </h3>
            <p className="text-muted mt-1 text-sm">
              {mode === 'create'
                ? 'Create a new active deal for the current store cycle.'
                : 'Update deal details. Changing prices clears the verified badge.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-muted text-xs font-semibold uppercase tracking-wide">
              Product name
            </span>
            <input
              required
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-zinc-900"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-muted text-xs font-semibold uppercase tracking-wide">Store</span>
              <select
                value={form.store}
                onChange={(event) => setField('store', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm capitalize dark:border-slate-700 dark:bg-zinc-900"
              >
                {DEAL_STORES.map((store) => (
                  <option key={store} value={store} className="capitalize">
                    {store}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-muted text-xs font-semibold uppercase tracking-wide">
                Category
              </span>
              <select
                value={form.category}
                onChange={(event) => setField('category', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-zinc-900"
              >
                {DEAL_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-muted text-xs font-semibold uppercase tracking-wide">
                Deal price ($)
              </span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.dealPrice}
                onChange={(event) => setField('dealPrice', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block">
              <span className="text-muted text-xs font-semibold uppercase tracking-wide">
                Was price ($)
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.originalPrice}
                onChange={(event) => setField('originalPrice', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-zinc-900"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-muted text-xs font-semibold uppercase tracking-wide">
                Deal type
              </span>
              <select
                value={form.dealType}
                onChange={(event) => setField('dealType', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-zinc-900"
              >
                {DEAL_TYPES.map((dealType) => (
                  <option key={dealType} value={dealType}>
                    {dealType}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-muted text-xs font-semibold uppercase tracking-wide">
                Savings label
              </span>
              <input
                value={form.savingsText}
                onChange={(event) => setField('savingsText', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-zinc-900"
              />
            </label>
          </div>

          {error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {busy ? 'Saving…' : mode === 'create' ? 'Add deal' : 'Save changes'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
