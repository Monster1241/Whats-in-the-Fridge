import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Download, ExternalLink, Flame, Plus } from 'lucide-react';
import { fetchStoreCatalogues, fetchWeeklyDeals } from '../api.js';
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

const DEAL_BADGE_FALLBACK =
  'bg-slate-700 text-white ring-slate-800 dark:bg-slate-600 dark:ring-slate-500';

function formatPrice(value) {
  if (value == null) return null;
  return `$${Number(value).toFixed(2)}`;
}

function formatValidityRange(validFrom, validTo) {
  const opts = { day: 'numeric', month: 'short' };
  const from = new Date(validFrom).toLocaleDateString('en-AU', opts);
  const to = new Date(validTo).toLocaleDateString('en-AU', opts);
  return `${from} – ${to}`;
}

/**
 * @param {{ dealType?: string, store?: string }} deal
 */
function getDealTypeBadgeStyle(deal) {
  if (deal.dealType === 'Half Price') {
    return 'bg-rose-700 text-white ring-rose-800 shadow-rose-900/20 dark:bg-rose-800 dark:ring-rose-900';
  }
  if (deal.dealType === 'Super Saver' || deal.dealType === 'Price Drop') {
    return 'bg-amber-500 text-amber-950 ring-amber-600 shadow-amber-900/15 dark:bg-amber-600 dark:text-amber-50 dark:ring-amber-700';
  }
  if (deal.store === 'aldi' && deal.dealType === 'Special Buy') {
    return 'bg-blue-800 text-white ring-blue-900 shadow-blue-900/20 dark:bg-blue-900 dark:ring-blue-950';
  }
  if (deal.dealType === 'Bulk Value') {
    return 'bg-indigo-700 text-white ring-indigo-800 dark:bg-indigo-800 dark:ring-indigo-900';
  }
  if (deal.dealType === 'Special Buy') {
    return 'bg-blue-700 text-white ring-blue-800 dark:bg-blue-800 dark:ring-blue-900';
  }
  return DEAL_BADGE_FALLBACK;
}

function openExternalUrl(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function CatalogueCard({ catalogue }) {
  const storeBadge = STORE_BADGE_STYLES[catalogue.store] ?? 'bg-slate-700 text-white';
  const validity = formatValidityRange(catalogue.validFrom, catalogue.validTo);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex gap-3 p-3">
        <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
          {catalogue.imageUrl ? (
            <img
              src={catalogue.imageUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <BookOpen className="h-7 w-7 text-slate-400" aria-hidden />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${storeBadge}`}
          >
            {catalogue.storeLabel}
          </span>
          <h3 className="text-heading mt-1.5 line-clamp-2 text-sm font-bold leading-snug">
            {catalogue.title}
          </h3>
          <p className="text-muted mt-1 text-xs font-medium">{validity}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => openExternalUrl(catalogue.externalLink)}
          className="flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-2 py-2.5 text-xs font-bold text-white transition active:scale-[0.98] hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
        >
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
          View Live Catalogue
        </button>
        <button
          type="button"
          onClick={() => openExternalUrl(catalogue.pdfUrl)}
          disabled={!catalogue.pdfUrl}
          className="flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border-2 border-sky-200 bg-sky-50 px-2 py-2.5 text-xs font-bold text-sky-800 transition active:scale-[0.98] hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950/60"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          Download PDF
        </button>
      </div>
    </article>
  );
}

function WeeklyDealCard({ deal, isAdded, onAdd }) {
  const storeBadge = STORE_BADGE_STYLES[deal.store] ?? 'bg-slate-700 text-white';
  const dealBadgeStyle = getDealTypeBadgeStyle(deal);
  const original = formatPrice(deal.originalPrice);
  const dealPrice = formatPrice(deal.dealPrice);

  return (
    <article className="surface-card relative flex min-h-[10.5rem] flex-col overflow-hidden rounded-2xl border border-slate-200/90 shadow-sm dark:border-slate-700">
      <div className="p-3 pb-14">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 shadow-sm ${dealBadgeStyle}`}
          >
            {deal.dealType}
          </span>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${storeBadge}`}
          >
            {deal.storeLabel}
          </span>
        </div>

        {deal.savingsText && deal.savingsText !== deal.dealType && (
          <p className="mb-1.5 text-[10px] font-semibold leading-snug text-rose-700 dark:text-rose-400">
            {deal.savingsText}
          </p>
        )}

        <h3 className="text-heading line-clamp-2 text-sm font-bold leading-snug">{deal.name}</h3>

        <p className="text-muted mt-1 text-[10px] font-semibold uppercase tracking-wide">
          {deal.category}
        </p>

        <div className="mt-2 flex items-end gap-2">
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
        aria-label={
          isAdded ? `${deal.name} added to shopping list` : `Add ${deal.name} to shopping list`
        }
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
  const [catalogues, setCatalogues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cataloguesLoading, setCataloguesLoading] = useState(true);
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

  useEffect(() => {
    let cancelled = false;
    setCataloguesLoading(true);
    fetchStoreCatalogues()
      .then((data) => {
        if (!cancelled) setCatalogues(data.catalogues ?? []);
      })
      .catch(() => {
        if (!cancelled) setCatalogues([]);
      })
      .finally(() => {
        if (!cancelled) setCataloguesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCatalogues = useMemo(() => {
    if (storeFilter === 'all') return catalogues;
    return catalogues.filter((entry) => entry.store === storeFilter);
  }, [catalogues, storeFilter]);

  const isDealAdded = useCallback(
    (deal) => justAddedIds.has(deal.id) || addedNames.has(normalizeName(deal.name)),
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
    <div className="space-y-6 pb-4" aria-label="Weekly deals portal">
      {/* Section 1: Itemized Hot Deals */}
      <section aria-labelledby="hot-deals-heading">
        <div className="mb-3 flex items-center gap-2">
          <Flame className="h-5 w-5 text-rose-600 dark:text-rose-400" aria-hidden />
          <div>
            <h2
              id="hot-deals-heading"
              className="text-heading text-sm font-bold uppercase tracking-wide"
            >
              Itemized Hot Deals
            </h2>
            <p className="text-muted text-xs">Refreshes every Wednesday · tap + to add to your list</p>
          </div>
        </div>

        <div
          className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1"
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
                className={`shrink-0 rounded-full px-4 py-2.5 text-xs font-bold ring-1 transition active:scale-[0.98] ${
                  active ? filter.active : filter.idle
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700"
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
              className="mt-3 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500"
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

      {/* Section 2: Store Catalogues */}
      <section
        aria-labelledby="catalogues-heading"
        className="surface-card rounded-2xl border-2 border-sky-200 bg-gradient-to-b from-sky-50/80 to-white p-4 dark:border-sky-900 dark:from-sky-950/30 dark:to-slate-900"
      >
        <h2
          id="catalogues-heading"
          className="text-heading mb-1 text-sm font-bold uppercase tracking-wide"
        >
          📖 Latest Digital Catalogues
        </h2>
        <p className="text-muted mb-4 text-xs leading-relaxed">
          Browse this week&apos;s flyers or save a PDF for offline shopping.
        </p>

        {cataloguesLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-36 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700"
                aria-hidden
              />
            ))}
          </div>
        )}

        {!cataloguesLoading && filteredCatalogues.length === 0 && (
          <p className="text-muted rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm dark:border-slate-600">
            {storeFilter === 'all'
              ? 'No active catalogues this week.'
              : `No catalogue available for ${
                  STORE_FILTERS.find((entry) => entry.id === storeFilter)?.label ?? 'this store'
                } right now.`}
          </p>
        )}

        {!cataloguesLoading && filteredCatalogues.length > 0 && (
          <div className="space-y-3">
            {filteredCatalogues.map((catalogue) => (
              <CatalogueCard key={catalogue.id} catalogue={catalogue} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
