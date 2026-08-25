import { useEffect, useState } from 'react';
import { AdminAlert } from './components/AdminAlert.jsx';
import { AdminButton } from './components/AdminButton.jsx';
import { AdminModal } from './components/AdminModal.jsx';

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

const fieldClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-zinc-900';

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

  return (
    <AdminModal
      open
      busy={busy}
      onClose={onClose}
      labelledBy="deal-editor-title"
      title={mode === 'create' ? 'Add deal' : 'Edit deal'}
      description={
        mode === 'create'
          ? 'Create a new active deal for the current store cycle.'
          : 'Update deal details. Changing prices clears the verified badge.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="text-muted text-xs font-semibold uppercase tracking-wide">
            Product name
          </span>
          <input
            required
            value={form.name}
            onChange={(event) => setField('name', event.target.value)}
            className={fieldClass}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-muted text-xs font-semibold uppercase tracking-wide">Store</span>
            <select
              value={form.store}
              onChange={(event) => setField('store', event.target.value)}
              className={`${fieldClass} capitalize`}
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
              className={fieldClass}
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
              className={fieldClass}
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
              className={fieldClass}
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
              className={fieldClass}
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
              className={fieldClass}
            />
          </label>
        </div>

        <AdminAlert variant="error">{error}</AdminAlert>

        <div className="flex flex-col gap-2 pt-1">
          <AdminButton type="submit" disabled={busy} size="lg" className="w-full">
            {busy ? 'Saving…' : mode === 'create' ? 'Add deal' : 'Save changes'}
          </AdminButton>
          <AdminButton
            type="button"
            variant="secondary"
            size="lg"
            disabled={busy}
            onClick={onClose}
            className="w-full"
          >
            Cancel
          </AdminButton>
        </div>
      </form>
    </AdminModal>
  );
}
