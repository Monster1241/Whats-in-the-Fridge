import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Download, ExternalLink, Flame, Plus, Search } from 'lucide-react';
import { fetchStoreCatalogues, fetchWeeklyDeals } from '../api.js';
import { StoreLogo } from './StoreLogo.jsx';
import { DEAL_TYPE_SUB_FILTERS, matchesDealTypeSubFilter } from '../inventory/dealTypes.js';
import { normalizeName } from '../inventory/itemUtils.js';

const SECTIONS = [
  {
    id: 'deals',
    label: 'Item Deals',
    shortLabel: 'Deals',
    icon: Flame,
    description: 'Search, filter & add single-item specials to your list',
    accent: {
      ring: 'ring-rose-300/60 dark:ring-rose-800',
      panel:
        'border-amber-200/90 bg-gradient-to-b from-rose-50/90 via-amber-50/50 to-white dark:border-amber-900/50 dark:from-rose-950/40 dark:via-amber-950/20 dark:to-slate-900',
      toggle: 'text-rose-700 dark:text-rose-300',
      indicator: 'bg-white shadow-md ring-1 ring-rose-200/80 dark:bg-slate-900 dark:ring-rose-900',
    },
  },
  {
    id: 'catalogues',
    label: 'Catalogues',
    shortLabel: 'Flyers',
    icon: BookOpen,
    description: 'Browse full weekly flyers — live portal or offline PDF',
    accent: {
      ring: 'ring-sky-300/60 dark:ring-sky-800',
      panel:
        'border-indigo-200/90 bg-gradient-to-b from-sky-50/90 via-indigo-50/40 to-white dark:border-indigo-900/60 dark:from-sky-950/30 dark:via-indigo-950/20 dark:to-slate-900',
      toggle: 'text-sky-700 dark:text-sky-300',
      indicator: 'bg-white shadow-md ring-1 ring-sky-200/80 dark:bg-slate-900 dark:ring-sky-900',
    },
  },
];

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

const CATALOGUE_STORE_ORDER = ['coles', 'woolworths', 'aldi', 'harrisfarm', 'costco'];

const STORE_BADGE_STYLES = {
  coles: 'bg-red-600 text-white',
  woolworths: 'bg-emerald-600 text-white',
  aldi: 'bg-blue-800 text-white',
  harrisfarm: 'bg-orange-500 text-white',
  costco: 'bg-[#E31837] text-white',
};

const CATALOGUE_ACCENT = {
  coles: 'border-l-red-500',
  woolworths: 'border-l-emerald-500',
  aldi: 'border-l-blue-700',
  harrisfarm: 'border-l-orange-500',
  costco: 'border-l-[#E31837]',
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

function openExternalUrl(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * @param {{ dealType?: string, store?: string }} deal
 */
function getDealTypeBadgeStyle(deal) {
  if (deal.dealType === 'Half Price') {
    return 'bg-rose-700 text-white ring-rose-800 shadow-rose-900/20 dark:bg-rose-800 dark:ring-rose-900';
  }
  if (deal.dealType === 'Super Saver') {
    return 'bg-amber-500 text-amber-950 ring-amber-600 shadow-amber-900/15 dark:bg-amber-600 dark:text-amber-50 dark:ring-amber-700';
  }
  if (deal.dealType === 'Price Drop' || deal.dealType === 'Reduced') {
    return 'bg-sky-700 text-white ring-sky-800 shadow-sky-900/15 dark:bg-sky-800 dark:ring-sky-900';
  }
  if (deal.store === 'aldi' && deal.dealType === 'Special Buy') {
    return 'bg-blue-800 text-white ring-blue-900 shadow-blue-900/20 dark:bg-blue-900 dark:ring-blue-950';
  }
  if (deal.dealType === 'Special Buy') {
    return 'bg-blue-700 text-white ring-blue-800 dark:bg-blue-800 dark:ring-blue-900';
  }
  return DEAL_BADGE_FALLBACK;
}

function SectionToggle({ activeSection, onChange, dealsCount, cataloguesCount }) {
  const activeIndex = SECTIONS.findIndex((section) => section.id === activeSection);

  return (
    <div
      className="mb-4 rounded-2xl bg-slate-100/90 p-1 ring-1 ring-slate-200/80 dark:bg-slate-800/90 dark:ring-slate-700"
      role="tablist"
      aria-label="Hot deals sections"
    >
      <div className="relative grid grid-cols-2 gap-1">
        <div
          className={`pointer-events-none absolute bottom-1 top-1 rounded-xl transition-transform duration-300 ease-out ${
            SECTIONS[activeIndex]?.accent.indicator ?? 'bg-white'
          }`}
          style={{
            width: 'calc(50% - 4px)',
            left: '4px',
            transform: activeIndex === 1 ? 'translateX(calc(100% + 4px))' : 'translateX(0)',
          }}
          aria-hidden
        />

        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.id;
          const count = section.id === 'deals' ? dealsCount : cataloguesCount;

          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`hot-deals-panel-${section.id}`}
              id={`hot-deals-tab-${section.id}`}
              onClick={() => onChange(section.id)}
              className={`relative z-10 flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2.5 transition-colors duration-200 active:scale-[0.98] ${
                active
                  ? `${section.accent.toggle} font-bold`
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-sm font-bold">{section.label}</span>
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      active
                        ? 'bg-black/10 dark:bg-white/10'
                        : 'bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </span>
              <span className="hidden text-[10px] font-medium opacity-80 sm:inline">
                {section.id === 'deals' ? 'Tap + to add to list' : 'Live & PDF flyers'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyDealCard({ deal, isAdded, onAdd }) {
  const storeBadge = STORE_BADGE_STYLES[deal.store] ?? 'bg-slate-700 text-white';
  const dealBadgeStyle = getDealTypeBadgeStyle(deal);
  const original = formatPrice(deal.originalPrice);
  const dealPrice = formatPrice(deal.dealPrice);

  return (
    <article className="relative flex min-h-[10.5rem] flex-col overflow-hidden rounded-2xl border border-amber-200/60 bg-white shadow-sm dark:border-amber-900/40 dark:bg-slate-900">
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

function CatalogueCard({ catalogue }) {
  const storeBadge = STORE_BADGE_STYLES[catalogue.store] ?? 'bg-slate-700 text-white';
  const accent = CATALOGUE_ACCENT[catalogue.store] ?? 'border-l-slate-500';
  const validity = formatValidityRange(catalogue.validFrom, catalogue.validTo);

  return (
    <article
      className={`overflow-hidden rounded-2xl border border-slate-200/90 border-l-4 bg-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900 ${accent}`}
    >
      <div className="flex gap-3 p-3.5 sm:gap-4 sm:p-4">
        <div className="flex w-[4.5rem] shrink-0 flex-col gap-2 sm:w-20">
          <div className="flex h-11 items-center justify-center rounded-xl bg-slate-50 p-1.5 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:ring-slate-700">
            <StoreLogo store={catalogue.store} label={catalogue.storeLabel} className="text-[10px]" />
          </div>
          <div className="relative h-24 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
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
        </div>

        <div className="min-w-0 flex-1">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${storeBadge}`}
          >
            {catalogue.storeLabel}
          </span>
          <h3 className="text-heading mt-1.5 line-clamp-2 text-sm font-bold leading-snug sm:text-base">
            {catalogue.title}
          </h3>
          <p className="text-muted mt-1.5 text-xs font-medium">{validity}</p>
          <p className="text-muted mt-2 hidden text-[11px] leading-relaxed sm:block">
            Flip through the full weekly flyer online or save the PDF for offline shopping.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
        <button
          type="button"
          onClick={() => openExternalUrl(catalogue.externalLink)}
          className="flex min-h-[2.85rem] items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-2 py-2.5 text-xs font-bold text-white transition active:scale-[0.98] hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
        >
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
          View Live Catalogue
        </button>
        <button
          type="button"
          onClick={() => openExternalUrl(catalogue.pdfUrl)}
          disabled={!catalogue.pdfUrl}
          className="flex min-h-[2.85rem] items-center justify-center gap-1.5 rounded-xl border-2 border-sky-200 bg-sky-50 px-2 py-2.5 text-xs font-bold text-sky-800 transition active:scale-[0.98] hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950/60"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          Download PDF
        </button>
      </div>
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
  const [activeSection, setActiveSection] = useState('deals');
  const [storeFilter, setStoreFilter] = useState('all');
  const [dealTypeFilter, setDealTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deals, setDeals] = useState([]);
  const [catalogues, setCatalogues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cataloguesLoading, setCataloguesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [justAddedIds, setJustAddedIds] = useState(() => new Set());

  const activeSectionMeta = SECTIONS.find((section) => section.id === activeSection) ?? SECTIONS[0];

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

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      if (!matchesDealTypeSubFilter(deal, dealTypeFilter)) return false;
      if (!normalizedSearch) return true;
      const haystack = [deal.name, deal.category, deal.storeLabel, deal.dealType, deal.savingsText]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [deals, dealTypeFilter, normalizedSearch]);

  const orderedCatalogues = useMemo(() => {
    const byStore = Object.fromEntries(catalogues.map((entry) => [entry.store, entry]));
    return CATALOGUE_STORE_ORDER.map((store) => byStore[store]).filter(Boolean);
  }, [catalogues]);

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
    const typeLabel =
      DEAL_TYPE_SUB_FILTERS.find((entry) => entry.id === dealTypeFilter)?.label ?? 'these filters';
    if (normalizedSearch) {
      return `No deals match "${searchQuery.trim()}". Try another search or filter.`;
    }
    if (deals.length === 0) {
      if (storeFilter === 'all') return 'No weekly deals right now — check back after Wednesday.';
      const label = STORE_FILTERS.find((entry) => entry.id === storeFilter)?.label ?? 'This store';
      return `No active deals at ${label} this week.`;
    }
    return `No ${typeLabel === 'Show All' ? 'matching' : typeLabel.toLowerCase()} deals for this selection.`;
  }, [storeFilter, dealTypeFilter, deals.length, normalizedSearch, searchQuery]);

  const dealsCount = loading ? 0 : filteredDeals.length;
  const cataloguesCount = cataloguesLoading ? 0 : orderedCatalogues.length;

  return (
    <div className="pb-4" aria-label="Hot deals portal">
      <SectionToggle
        activeSection={activeSection}
        onChange={setActiveSection}
        dealsCount={dealsCount}
        cataloguesCount={cataloguesCount}
      />

      <div
        key={activeSection}
        id={`hot-deals-panel-${activeSection}`}
        role="tabpanel"
        aria-labelledby={`hot-deals-tab-${activeSection}`}
        className={`rounded-3xl border-2 p-4 shadow-sm transition-opacity duration-300 ${activeSectionMeta.accent.panel} ${activeSectionMeta.accent.ring} ring-1`}
      >
        <div className="mb-4">
          <h2 className="text-heading text-base font-extrabold leading-snug tracking-tight sm:text-lg">
            {activeSection === 'deals'
              ? '🔥 Featured Super Savers & Item Specials'
              : '📖 Full Digital Weekly Catalogues'}
          </h2>
          <p className="text-muted mt-1 text-xs leading-relaxed">{activeSectionMeta.description}</p>
        </div>

        {activeSection === 'deals' && (
          <>
            <label className="relative mb-4 block">
              <span className="sr-only">Search deals</span>
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-700/70 dark:text-amber-300/70"
                aria-hidden
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search deals by product, category, or store…"
                className="w-full rounded-2xl border border-amber-200/80 bg-white py-3 pl-10 pr-4 text-sm font-medium text-slate-800 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/40 dark:border-amber-900/60 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-amber-700 dark:focus:ring-amber-700/40"
              />
            </label>

            <div
              className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1"
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

            <div
              className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1"
              role="tablist"
              aria-label="Filter deals by promotion type"
            >
              {DEAL_TYPE_SUB_FILTERS.map((filter) => {
                const active = dealTypeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setDealTypeFilter(filter.id)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold ring-1 transition active:scale-[0.98] ${
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
                    className="h-40 animate-pulse rounded-2xl bg-amber-100/80 dark:bg-amber-950/40"
                    aria-hidden
                  />
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center dark:border-rose-900 dark:bg-rose-950/40">
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

            {!loading && !error && filteredDeals.length === 0 && (
              <div className="rounded-2xl border border-dashed border-amber-300/80 bg-white/60 px-4 py-10 text-center dark:border-amber-900 dark:bg-slate-900/40">
                <p className="text-muted text-sm">{emptyMessage}</p>
              </div>
            )}

            {!loading && !error && filteredDeals.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {filteredDeals.map((deal) => (
                  <WeeklyDealCard
                    key={deal.id}
                    deal={deal}
                    isAdded={isDealAdded(deal)}
                    onAdd={handleAdd}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeSection === 'catalogues' && (
          <>
            {cataloguesLoading && (
              <div className="space-y-3">
                {CATALOGUE_STORE_ORDER.map((store) => (
                  <div
                    key={store}
                    className="h-44 animate-pulse rounded-2xl bg-indigo-100/80 dark:bg-indigo-950/40"
                    aria-hidden
                  />
                ))}
              </div>
            )}

            {!cataloguesLoading && orderedCatalogues.length === 0 && (
              <p className="text-muted rounded-2xl border border-dashed border-indigo-300/80 bg-white/50 px-4 py-10 text-center text-sm dark:border-indigo-900 dark:bg-slate-900/40">
                No active catalogues this week — check back after Wednesday.
              </p>
            )}

            {!cataloguesLoading && orderedCatalogues.length > 0 && (
              <div className="space-y-3">
                {orderedCatalogues.map((catalogue) => (
                  <CatalogueCard key={catalogue.id} catalogue={catalogue} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
