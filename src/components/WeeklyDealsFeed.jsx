import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Flame, Plus } from 'lucide-react';
import { fetchWeeklyDeals } from '../api.js';
import { normalizeName } from '../inventory/itemUtils.js';

const STORE_FILTERS = [
  {
    id: 'all',
    label: 'All',
    active: 'bg-slate-800 text-white ring-slate-900 dark:bg-slate-200 dark:text-slate-900',
    idle:
      'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600',
  },
  {
    id: 'coles',
    label: 'Coles',
    active: 'bg-red-600 text-white ring-red-700',
    idle: 'bg-red-50 text-red-800 ring-red-200 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-800',
  },
  {
    id: 'woolworths',
    label: 'Woolworths',
    active: 'bg-emerald-600 text-white ring-emerald-700',
    idle:
      'bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800',
  },
  {
    id: 'aldi',
    label: 'ALDI',
    active: 'bg-blue-800 text-white ring-blue-900',
    idle: 'bg-blue-50 text-blue-900 ring-blue-200 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-200 dark:ring-blue-800',
  },
  {
    id: 'harrisfarm',
    label: 'Harris Farm',
    active: 'bg-orange-500 text-white ring-orange-600',
    idle:
      'bg-orange-50 text-orange-900 ring-orange-200 hover:bg-orange-100 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-800',
  },
  {
    id: 'costco',
    label: 'Costco',
    active: 'bg-[#E31837] text-white ring-[#c41230]',
    idle:
      'bg-rose-50 text-[#E31837] ring-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800',
  },
];

const STORE_BADGE_STYLES = {
  coles: 'bg-red-600 text-white',
  woolworths: 'bg-emerald-600 text-white',
  aldi: 'bg-blue-800 text-white',
  harrisfarm: 'bg-orange-500 text-white',
  costco: 'bg-[#E31837] text-white',
};

function formatPrice(value) {
  if (value == null) return null;
  return `$${Number(value).toFixed(2)}`;
}

function WeeklyDealCard({ deal, isAdded, onAdd }) {
  const storeBadge = STORE_BADGE_STYLES[deal.store] ?? 'bg-slate-700 text-white';
  const original = formatPrice(deal.originalPrice);
  const dealPrice = formatPrice(deal.dealPrice);

  return (
    <article className="surface-card relative flex min-h-[11rem] flex-col overflow-hidden rounded-2xl border border-slate-200/90 shadow-sm dark:border-slate-700">
      <div className="bg-rose-700 px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-white dark:bg-rose-800">
        {deal.savingsText}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 pb-14">
        <span
          className={`inline-flex w-fit max-w-full items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${storeBadge}`}
        >
          {deal.storeLabel}
        </span>

        <h3 className="text-heading line-clamp-2 text-sm font-bold leading-snug">{deal.name}</h3>

        <p className="text-muted text-[10px] font-semibold uppercase tracking-wide">
          {deal.category}
        </p>

        <div className="mt-auto flex items-end gap-2">
          <p className="text-heading text-2xl font-extrabold leading-none">{dealPrice}</p>
          {original && (
            <p className="text-muted pb-0.5 text-sm font-medium line-through">{original}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onAdd(deal)}
        disabled={isAdded}
        className={`absolute bottom-3 right-3 flex h-12 min-w-[3rem] items-center justify-center gap-1 rounded-2xl px-3 text-sm font-bold shadow-lg transition active:scale-95 disabled:cursor-default ${
          isAdded
            ? 'bg-emerald-600 text-white shadow-emerald-900/30'
            : 'bg-sky-600 text-white shadow-sky-900/30 hover:bg-sky-500'
        }`}
        aria-label={isAdded ? `${deal.name} added to shopping list` : `Add ${deal.name} to shopping list`}
      >
        {isAdded ? (
          <>
            <Check className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden />
            <span className="text-xs">Added!</span>
          </>
        ) : (
          <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        )}
      </button>
    </article>
  );
}

/**
 * @param {{
 *   onAddDeal: (deal: object) => void,
 *   addedNames?: Set<string>
 * }} props
 */
export function WeeklyDealsFeed({ onAddDeal, addedNames = new Set() }) {
  const [storeFilter, setStoreFilter] = useState('all');
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [justAddedIds, setJustAddedIds] = useState(() => new Set());

  const loadDeals = useCallback(async (store) => {
    setLoading(true);
    setError(null);
    try {
      const params = store && store !== 'all' ? { store } : {};
      const data = await fetchWeeklyDeals(params);
      setDeals(data.deals ?? []);
    } catch (err) {
      setDeals([]);
      setError(err.message || 'Could not load weekly deals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeals(storeFilter);
  }, [storeFilter, loadDeals]);

  const isDealAdded = useCallback(
    (deal) =>
      justAddedIds.has(deal.id) || addedNames.has(normalizeName(deal.name)),
    [addedNames, justAddedIds],
  );

  const handleAdd = (deal) => {
    if (isDealAdded(deal)) return;
    onAddDeal(deal);
    setJustAddedIds((prev) => new Set(prev).add(deal.id));
  };

  const emptyMessage = useMemo(() => {
    if (storeFilter === 'all') return 'No weekly deals right now — check back after Wednesday.';
    const label = STORE_FILTERS.find((entry) => entry.id === storeFilter)?.label ?? 'This store';
    return `No active deals at ${label} this week.`;
  }, [storeFilter]);

  return (
    <section className="mb-5" aria-label="Weekly deals feed">
      <div className="mb-3 flex items-center gap-2">
        <Flame className="h-5 w-5 text-rose-600 dark:text-rose-400" aria-hidden />
        <div>
          <h2 className="text-heading text-sm font-bold uppercase tracking-wide">
            Weekly Hot Deals
          </h2>
          <p className="text-muted text-xs">Refreshes every Wednesday · tap + to add to your list</p>
        </div>
      </div>

      <div
        className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-thin"
        role="tablist"
        aria-label="Filter deals by store"
      >
        {STORE_FILTERS.map((filter) => {
          const active = storeFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStoreFilter(filter.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ring-1 transition active:scale-[0.98] ${
                active ? filter.active : filter.idle
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700"
              aria-hidden
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="surface-card rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center dark:border-rose-900 dark:bg-rose-950/40">
          <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">{error}</p>
          <button
            type="button"
            onClick={() => loadDeals(storeFilter)}
            className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && deals.length === 0 && (
        <div className="surface-card rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-600">
          <p className="text-muted text-sm">{emptyMessage}</p>
        </div>
      )}

      {!loading && !error && deals.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {deals.map((deal) => (
            <WeeklyDealCard
              key={deal.id}
              deal={deal}
              isAdded={isDealAdded(deal)}
              onAdd={handleAdd}
            />
          ))}
        </div>
      )}
    </section>
  );
}
