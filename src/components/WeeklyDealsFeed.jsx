import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Download,
  ExternalLink,
  Flag,
  Flame,
  MapPin,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { fetchStoreCatalogues, fetchWeeklyDeals } from '../api.js';
import { StoreLogo } from './StoreLogo.jsx';
import { DealsFilterMenu } from './DealsFilterMenu.jsx';
import { ReportDealModal } from './ReportDealModal.jsx';
import {
  DEAL_TYPE_SUB_FILTERS,
  matchesDealTypeSubFilter,
  matchesDealTypesSelection,
} from '../inventory/dealTypes.js';
import { normalizeName } from '../inventory/itemUtils.js';
import {
  isValidAustralianPostcode,
  POSTCODE_CHANGE_EVENT,
  readStoredPostcode,
  writeStoredPostcode,
} from '../inventory/postcodeStorage.js';
import {
  readStoredDealsSection,
  writeStoredDealsSection,
} from '../inventory/dealsSectionStorage.js';

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
        'border-amber-200/90 bg-gradient-to-b from-rose-50/90 via-amber-50/50 to-white dark:border-amber-900/50 dark:from-rose-950/40 dark:via-amber-950/20 dark:to-black',
      toggle: 'text-rose-700 dark:text-rose-300',
      indicator: 'bg-lm-raised shadow-md ring-1 ring-rose-200/80 dark:bg-dm-card dark:ring-rose-900',
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
        'border-indigo-200/90 bg-gradient-to-b from-sky-50/90 via-indigo-50/40 to-white dark:border-indigo-900/60 dark:from-sky-950/30 dark:via-indigo-950/20 dark:to-black',
      toggle: 'text-sky-700 dark:text-sky-300',
      indicator: 'bg-lm-raised shadow-md ring-1 ring-sky-200/80 dark:bg-dm-card dark:ring-sky-900',
    },
  },
];

const STORE_FILTERS = [
  {
    id: 'all',
    label: 'All',
    active: 'bg-slate-800 text-white ring-slate-900 dark:bg-slate-200 dark:text-slate-900',
    idle:
      'bg-lm-raised text-zinc-700 ring-black/[0.08] hover:bg-lm-card dark:bg-dm-card dark:text-slate-200 dark:ring-slate-600',
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

const STORE_FILTER_OPTIONS = STORE_FILTERS.filter((filter) => filter.id !== 'all');
const DEAL_TYPE_FILTER_OPTIONS = DEAL_TYPE_SUB_FILTERS.filter((filter) => filter.id !== 'all');

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

function formatDealExpiry(expiresAt) {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getDealSavings(deal) {
  const dealPrice = Number(deal.dealPrice);
  const originalPrice = Number(deal.originalPrice);
  if (!Number.isFinite(dealPrice) || !Number.isFinite(originalPrice) || originalPrice <= dealPrice) {
    return null;
  }
  const amount = originalPrice - dealPrice;
  const percent = Math.round((amount / originalPrice) * 100);
  return { amount, percent };
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

function PostcodeModal({ postcode, draft, onDraftChange, onSave, onClose, error }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="postcode-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-2xl border border-black/[0.08] bg-lm-raised p-4 shadow-2xl dark:border-slate-700 dark:bg-dm-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 id="postcode-modal-title" className="text-heading text-sm font-bold">
              Your postcode
            </h3>
            <p className="text-muted mt-0.5 text-xs">Local flyers &amp; catalogue links for your area</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block">
          <span className="text-muted mb-1.5 block text-[10px] font-bold uppercase tracking-wide">
            4-digit Australian postcode
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={4}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder={postcode}
            className="w-full rounded-xl border border-black/[0.08] bg-lm-raised px-4 py-3 text-center text-lg font-bold tracking-[0.2em] text-slate-900 outline-none ring-sky-300/0 focus:border-sky-400 focus:ring-2 focus:ring-sky-300/40 dark:border-slate-600 dark:bg-dm-card dark:text-slate-100"
          />
        </label>

        {error && (
          <p className="mt-2 text-center text-xs font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onSave}
          className="mt-4 w-full rounded-xl bg-sky-600 py-3 text-sm font-bold text-white transition hover:bg-sky-500 active:scale-[0.98]"
        >
          Save postcode
        </button>
      </div>
    </div>
  );
}

function PostcodeChip({ postcode, regionLabel, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lm-raised/90 px-2.5 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200/90 transition hover:bg-white hover:ring-sky-300 active:scale-[0.98] dark:bg-dm-inset dark:text-slate-200 dark:ring-slate-600 dark:hover:ring-sky-700"
      aria-label={`Postcode ${postcode}. Tap to change your location.`}
      title={regionLabel ? `Flyers for ${regionLabel}` : 'Set your postcode'}
    >
      <MapPin className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" aria-hidden />
      <span className="tabular-nums">{postcode}</span>
    </button>
  );
}

function SectionToggle({ activeSection, onChange, dealsCount, cataloguesCount }) {
  const activeIndex = SECTIONS.findIndex((section) => section.id === activeSection);

  return (
    <div
      className="rounded-2xl bg-lm-inset p-1 ring-1 ring-black/[0.08] dark:bg-dm-inset dark:ring-white/10"
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
                        : 'bg-slate-200/80 text-slate-600 dark:bg-zinc-900 dark:text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </span>
              <span className="hidden text-[10px] font-medium opacity-80 sm:inline">
                {section.id === 'deals' ? 'Tap card for details · + to add' : 'Live & PDF flyers'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyDealCard({ deal, showAddedFeedback, onAdd, onOpen }) {
  const storeBadge = STORE_BADGE_STYLES[deal.store] ?? 'bg-slate-700 text-white';
  const dealBadgeStyle = getDealTypeBadgeStyle(deal);
  const hasPrice = deal.dealPrice != null;
  const original = hasPrice ? formatPrice(deal.originalPrice) : null;
  const dealPrice = hasPrice ? formatPrice(deal.dealPrice) : null;
  const isVerified = deal.priceConfirmed === true && deal.verificationMethod === 'manual';

  return (
    <article className="relative flex min-h-[10.5rem] flex-col overflow-hidden rounded-2xl border border-amber-200/60 bg-lm-card shadow-lm-card dark:border-amber-900/40 dark:bg-dm-card">
      <button
        type="button"
        onClick={() => onOpen(deal)}
        className="flex flex-1 flex-col rounded-2xl p-3 pb-14 text-left transition-colors hover:bg-amber-50/50 active:bg-amber-100/40 dark:hover:bg-amber-950/20 dark:active:bg-amber-950/30"
        aria-label={`View details for ${deal.name}`}
      >
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
          {hasPrice ? (
            <>
              <p className="text-heading text-2xl font-extrabold leading-none">{dealPrice}</p>
              {original && (
                <p className="text-muted pb-0.5 text-sm font-medium line-through">{original}</p>
              )}
            </>
          ) : (
            <p className="text-muted text-xs font-medium">Price unavailable</p>
          )}
        </div>
        {isVerified && (
          <p className="mt-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
            Verified price
          </p>
        )}
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onAdd(deal);
        }}
        disabled={showAddedFeedback}
        className={`deal-add-btn absolute bottom-3 right-3 flex h-12 min-w-[3rem] items-center justify-center gap-1 rounded-2xl px-3 text-sm font-bold shadow-lg transition-all duration-200 active:scale-95 disabled:cursor-default ${
          showAddedFeedback
            ? 'deal-add-btn--confirmed bg-emerald-600 text-white shadow-emerald-900/30'
            : 'bg-sky-600 text-white shadow-sky-900/30 hover:bg-sky-500'
        }`}
        aria-label={
          showAddedFeedback
            ? `${deal.name} added to shopping list`
            : `Add ${deal.name} to shopping list`
        }
      >
        {showAddedFeedback ? (
          <Check
            className="deal-add-btn__icon h-6 w-6 shrink-0"
            strokeWidth={2.5}
            aria-hidden
          />
        ) : (
          <Plus className="h-6 w-6 shrink-0" strokeWidth={2.5} aria-hidden />
        )}
      </button>
    </article>
  );
}

function WeeklyDealDetail({ deal, showAddedFeedback, onAdd, onBack, onReport }) {
  const storeBadge = STORE_BADGE_STYLES[deal.store] ?? 'bg-slate-700 text-white';
  const dealBadgeStyle = getDealTypeBadgeStyle(deal);
  const hasPrice = deal.dealPrice != null;
  const original = hasPrice ? formatPrice(deal.originalPrice) : null;
  const dealPrice = hasPrice ? formatPrice(deal.dealPrice) : null;
  const savings = hasPrice ? getDealSavings(deal) : null;
  const expiryLabel = formatDealExpiry(deal.expiresAt);
  const catalogueUrl = deal.catalogueUrl ?? null;
  const isVerified = deal.priceConfirmed === true && deal.verificationMethod === 'manual';

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onBack();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  return (
    <div className="animate-in fade-in duration-200">
      <button
        type="button"
        onClick={onBack}
        className="text-heading mb-4 inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-bold transition hover:bg-black/5 active:scale-[0.98] dark:hover:bg-white/10"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back to deals
      </button>

      <article className="overflow-hidden rounded-2xl border border-amber-200/70 bg-lm-card shadow-lm-card dark:border-amber-900/50 dark:bg-dm-card">
        <div className="border-b border-amber-200/50 bg-gradient-to-b from-amber-50/80 to-transparent p-4 dark:border-amber-900/40 dark:from-amber-950/30">
          <div className="flex items-start gap-3">
            <StoreLogo
              store={deal.store}
              label={deal.storeLabel}
              className="h-14 w-14 shrink-0 rounded-2xl ring-2 ring-white/80 dark:ring-slate-800"
              imgClassName="rounded-2xl"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 shadow-sm ${dealBadgeStyle}`}
                >
                  {deal.dealType}
                </span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${storeBadge}`}
                >
                  {deal.storeLabel}
                </span>
              </div>
              {deal.savingsText && (
                <p className="mt-2 text-sm font-semibold leading-snug text-rose-700 dark:text-rose-400">
                  {deal.savingsText}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div>
            <h2 className="text-heading text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">
              {deal.name}
            </h2>
            <p className="text-muted mt-2 text-xs font-semibold uppercase tracking-wide">
              {deal.category}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200/60 bg-lm-inset p-4 dark:border-amber-900/40 dark:bg-dm-inset">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-muted text-xs font-semibold uppercase tracking-wide">Deal price</p>
              {isVerified && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                  Verified price
                </span>
              )}
            </div>
            {hasPrice ? (
              <>
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <p className="text-heading text-4xl font-extrabold leading-none">{dealPrice}</p>
                  {original && (
                    <p className="text-muted pb-1 text-lg font-medium line-through">{original}</p>
                  )}
                </div>
                {savings && (
                  <p className="mt-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    You save {formatPrice(savings.amount)} ({savings.percent}% off)
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted mt-2 text-sm">Price unavailable for this item.</p>
            )}
            {!isVerified && (
              <p className="mt-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                {deal.priceDisclaimer ||
                  'Prices may not be accurate — always double-check the official catalogue or in-store price.'}
              </p>
            )}
            {catalogueUrl && (
              <button
                type="button"
                onClick={() => openExternalUrl(catalogueUrl)}
                className="mt-3 inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-[0.98] dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
              >
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                View {deal.storeLabel} catalogue
              </button>
            )}
          </div>

          {expiryLabel && (
            <p className="text-muted text-xs font-medium">
              Offer valid until <span className="text-heading font-semibold">{expiryLabel}</span>
            </p>
          )}

          <button
            type="button"
            onClick={onReport}
            className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
          >
            <Flag className="h-3.5 w-3.5" aria-hidden />
            Report wrong price or expired deal
          </button>

          <button
            type="button"
            onClick={() => onAdd(deal)}
            disabled={showAddedFeedback}
            className={`deal-add-btn flex w-full min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl px-4 text-base font-bold shadow-lg transition-all duration-200 active:scale-[0.98] disabled:cursor-default ${
              showAddedFeedback
                ? 'deal-add-btn--confirmed bg-emerald-600 text-white shadow-emerald-900/30'
                : 'bg-sky-600 text-white shadow-sky-900/30 hover:bg-sky-500'
            }`}
            aria-label={
              showAddedFeedback
                ? `${deal.name} added to shopping list`
                : `Add ${deal.name} to shopping list`
            }
          >
            {showAddedFeedback ? (
              <>
                <Check className="deal-add-btn__icon h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden />
                Added to shopping list
              </>
            ) : (
              <>
                <Plus className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden />
                Add to shopping list
              </>
            )}
          </button>
        </div>
      </article>
    </div>
  );
}

function CatalogueCard({ catalogue }) {
  const storeBadge = STORE_BADGE_STYLES[catalogue.store] ?? 'bg-slate-700 text-white';
  const accent = CATALOGUE_ACCENT[catalogue.store] ?? 'border-l-slate-500';
  const validity = formatValidityRange(catalogue.validFrom, catalogue.validTo);

  return (
    <article
      className={`overflow-hidden rounded-2xl border border-black/[0.08] border-l-4 bg-lm-card shadow-lm-card transition hover:shadow-md dark:border-slate-700 dark:bg-dm-card ${accent}`}
    >
      <div className="flex gap-3 p-3.5 sm:gap-4 sm:p-4">
        <div className="flex w-[4.5rem] shrink-0 flex-col gap-2 sm:w-20">
          <div className="flex h-11 items-center justify-center rounded-xl bg-lm-inset p-1.5 ring-1 ring-black/[0.08] dark:bg-dm-card dark:ring-slate-700">
            <StoreLogo store={catalogue.store} label={catalogue.storeLabel} className="text-[10px]" />
          </div>
          <div className="relative h-24 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-black dark:to-black">
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

      <div className="grid grid-cols-2 gap-2 border-t border-black/[0.06] bg-lm-inset/80 p-3 dark:border-slate-800 dark:bg-dm-inset">
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
  const [activeSection, setActiveSection] = useState(() => readStoredDealsSection());
  const [selectedStores, setSelectedStores] = useState(() => new Set());
  const [selectedDealTypes, setSelectedDealTypes] = useState(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [postcode, setPostcode] = useState(() => readStoredPostcode());
  const [regionLabel, setRegionLabel] = useState('');
  const [showPostcodeModal, setShowPostcodeModal] = useState(false);
  const [postcodeDraft, setPostcodeDraft] = useState(postcode);
  const [postcodeError, setPostcodeError] = useState('');
  const [deals, setDeals] = useState([]);
  const [dealCycle, setDealCycle] = useState(null);
  const [pricingPolicy, setPricingPolicy] = useState(null);
  const [catalogues, setCatalogues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cataloguesLoading, setCataloguesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flashAddedIds, setFlashAddedIds] = useState(() => new Set());
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [reportDeal, setReportDeal] = useState(null);
  const flashTimersRef = useRef(new Map());

  const handleSectionChange = useCallback((section) => {
    setActiveSection(section);
    setSelectedDeal(null);
    writeStoredDealsSection(section);
  }, []);

  useEffect(() => {
    return () => {
      flashTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      flashTimersRef.current.clear();
    };
  }, []);

  const activeSectionMeta = SECTIONS.find((section) => section.id === activeSection) ?? SECTIONS[0];

  const loadDeals = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeeklyDeals({ postcode }, { force });
      setDeals(data.deals ?? []);
      setDealCycle(data.cycle ?? null);
      setPricingPolicy(data.pricingPolicy ?? null);
      if (data.regionLabel) setRegionLabel(data.regionLabel);
      if (data.postcode) setPostcode(data.postcode);
    } catch (err) {
      setDeals([]);
      setDealCycle(null);
      setPricingPolicy(null);
      setError(err.message || 'Could not load weekly deals.');
    } finally {
      setLoading(false);
    }
  }, [postcode]);

  useEffect(() => {
    setSelectedStores(new Set());
    loadDeals(false);
  }, [postcode, loadDeals]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadDeals(true);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadDeals]);

  const toggleStoreFilter = useCallback((storeId) => {
    setSelectedStores((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  }, []);

  const toggleDealTypeFilter = useCallback((typeId) => {
    setSelectedDealTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId);
      else next.add(typeId);
      return next;
    });
  }, []);

  const clearDealFilters = useCallback(() => {
    setSelectedStores(new Set());
    setSelectedDealTypes(new Set());
  }, []);

  const loadCatalogues = useCallback(async (currentPostcode) => {
    setCataloguesLoading(true);
    try {
      const data = await fetchStoreCatalogues({ postcode: currentPostcode });
      setCatalogues(data.catalogues ?? []);
      setRegionLabel(data.regionLabel ?? '');
      if (data.postcode) setPostcode(data.postcode);
    } catch {
      setCatalogues([]);
    } finally {
      setCataloguesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogues(postcode);
  }, [postcode, loadCatalogues]);

  useEffect(() => {
    const onPostcodeChanged = (event) => {
      const next = event?.detail?.postcode || readStoredPostcode();
      setPostcode((prev) => (prev === next ? prev : next));
    };
    window.addEventListener(POSTCODE_CHANGE_EVENT, onPostcodeChanged);
    return () => window.removeEventListener(POSTCODE_CHANGE_EVENT, onPostcodeChanged);
  }, []);

  const openPostcodeModal = () => {
    setPostcodeDraft(postcode);
    setPostcodeError('');
    setShowPostcodeModal(true);
  };

  const savePostcode = () => {
    if (!isValidAustralianPostcode(postcodeDraft)) {
      setPostcodeError('Enter a valid 4-digit Australian postcode.');
      return;
    }
    const saved = writeStoredPostcode(postcodeDraft);
    if (!saved) {
      setPostcodeError('Could not save postcode. Try again.');
      return;
    }
    setPostcode(saved);
    setShowPostcodeModal(false);
    setPostcodeError('');
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const searchMatchedDeals = useMemo(() => {
    if (!normalizedSearch) return deals;
    return deals.filter((deal) => {
      const haystack = [deal.name, deal.category, deal.storeLabel, deal.dealType, deal.savingsText]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [deals, normalizedSearch]);

  const storeCounts = useMemo(() => {
    const counts = new Map();
    for (const option of STORE_FILTER_OPTIONS) {
      counts.set(option.id, 0);
    }
    for (const deal of searchMatchedDeals) {
      counts.set(deal.store, (counts.get(deal.store) ?? 0) + 1);
    }
    return counts;
  }, [searchMatchedDeals]);

  const dealTypeCounts = useMemo(() => {
    const counts = new Map();
    for (const option of DEAL_TYPE_FILTER_OPTIONS) {
      counts.set(option.id, 0);
    }
    for (const deal of searchMatchedDeals) {
      if (selectedStores.size > 0 && !selectedStores.has(deal.store)) continue;
      for (const option of DEAL_TYPE_FILTER_OPTIONS) {
        if (matchesDealTypeSubFilter(deal, option.id)) {
          counts.set(option.id, (counts.get(option.id) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [searchMatchedDeals, selectedStores]);

  const filteredDeals = useMemo(() => {
    return searchMatchedDeals.filter((deal) => {
      if (selectedStores.size > 0 && !selectedStores.has(deal.store)) return false;
      if (!matchesDealTypesSelection(deal, selectedDealTypes)) return false;
      return true;
    });
  }, [searchMatchedDeals, selectedStores, selectedDealTypes]);

  const orderedCatalogues = useMemo(() => {
    const byStore = Object.fromEntries(catalogues.map((entry) => [entry.store, entry]));
    return CATALOGUE_STORE_ORDER.map((store) => byStore[store]).filter(Boolean);
  }, [catalogues]);

  const isOnShoppingList = useCallback(
    (deal) => addedNames.has(normalizeName(deal.name)),
    [addedNames],
  );

  const showAddedFeedback = useCallback(
    (deal) => flashAddedIds.has(deal.id) || isOnShoppingList(deal),
    [flashAddedIds, isOnShoppingList],
  );

  const handleAdd = (deal) => {
    if (isOnShoppingList(deal) || flashAddedIds.has(deal.id)) return;
    onAddDeal(deal);

    setFlashAddedIds((prev) => new Set(prev).add(deal.id));

    const existingTimer = flashTimersRef.current.get(deal.id);
    if (existingTimer) window.clearTimeout(existingTimer);

    const timer = window.setTimeout(() => {
      setFlashAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(deal.id);
        return next;
      });
      flashTimersRef.current.delete(deal.id);
    }, 1500);

    flashTimersRef.current.set(deal.id, timer);
  };

  const emptyMessage = useMemo(() => {
    if (normalizedSearch) {
      return `No deals match "${searchQuery.trim()}". Try another search or filter.`;
    }
    if (deals.length === 0) {
      if (regionLabel && postcode) {
        return `No item deals for ${regionLabel} (${postcode}) this week — try another postcode or check back after Wednesday.`;
      }
      return dealCycle?.nextRefreshAt
        ? 'No item deals this week — check back after Wednesday.'
        : 'No weekly deals right now — check back after Wednesday.';
    }
    if (selectedStores.size > 0 || selectedDealTypes.size > 0) {
      return 'No deals match your filters. Try clearing filters or selecting different options.';
    }
    return 'No matching deals for this selection.';
  }, [deals.length, dealCycle, normalizedSearch, postcode, regionLabel, searchQuery, selectedStores.size, selectedDealTypes.size]);

  const dealsCount = loading ? 0 : filteredDeals.length;
  const cataloguesCount = cataloguesLoading ? 0 : orderedCatalogues.length;

  return (
    <div className="pb-16" aria-label="Hot deals portal">
      <div className="mb-4 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <SectionToggle
            activeSection={activeSection}
            onChange={handleSectionChange}
            dealsCount={dealsCount}
            cataloguesCount={cataloguesCount}
          />
        </div>
        <PostcodeChip
          postcode={postcode}
          regionLabel={regionLabel}
          onClick={openPostcodeModal}
        />
      </div>

      {showPostcodeModal && (
        <PostcodeModal
          postcode={postcode}
          draft={postcodeDraft}
          onDraftChange={setPostcodeDraft}
          onSave={savePostcode}
          onClose={() => setShowPostcodeModal(false)}
          error={postcodeError}
        />
      )}

      {reportDeal && (
        <ReportDealModal deal={reportDeal} onClose={() => setReportDeal(null)} />
      )}

      <div
        key={activeSection}
        id={`hot-deals-panel-${activeSection}`}
        role="tabpanel"
        aria-labelledby={`hot-deals-tab-${activeSection}`}
        className={`rounded-3xl border-2 p-4 shadow-sm transition-opacity duration-300 ${activeSectionMeta.accent.panel} ${activeSectionMeta.accent.ring} ring-1`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-heading text-base font-extrabold leading-snug tracking-tight sm:text-lg">
              {activeSection === 'deals'
                ? '🔥 Featured Super Savers & Item Specials'
                : '📖 Full Digital Weekly Catalogues'}
            </h2>
            <p className="text-muted mt-1 text-xs leading-relaxed">
              {activeSectionMeta.description}
              {regionLabel && (
                <span className="text-heading font-semibold">
                  {' '}
                  · {regionLabel} ({postcode})
                </span>
              )}
            </p>
          </div>
          {activeSection === 'deals' && !loading && deals.length > 0 && !selectedDeal && (
            <DealsFilterMenu
              storeOptions={STORE_FILTER_OPTIONS}
              dealTypeOptions={DEAL_TYPE_FILTER_OPTIONS}
              selectedStores={selectedStores}
              selectedDealTypes={selectedDealTypes}
              onToggleStore={toggleStoreFilter}
              onToggleDealType={toggleDealTypeFilter}
              onClear={clearDealFilters}
              storeCounts={storeCounts}
              dealTypeCounts={dealTypeCounts}
            />
          )}
        </div>

        {activeSection === 'deals' && (
          <>
            {selectedDeal ? (
              <WeeklyDealDetail
                deal={selectedDeal}
                showAddedFeedback={showAddedFeedback(selectedDeal)}
                onAdd={handleAdd}
                onBack={() => setSelectedDeal(null)}
                onReport={() => setReportDeal(selectedDeal)}
              />
            ) : (
              <>
            {pricingPolicy?.message && (
              <p className="text-muted mb-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs leading-relaxed dark:border-amber-900/50 dark:bg-amber-950/25">
                <span className="text-heading font-semibold">Note:</span> {pricingPolicy.message}
              </p>
            )}
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
                className="w-full rounded-2xl border border-amber-200/80 bg-lm-raised py-3 pl-10 pr-4 text-base font-medium text-zinc-800 shadow-lm-raised outline-none transition placeholder:text-zinc-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/40 dark:border-amber-900/60 dark:bg-dm-card dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-amber-700 dark:focus:ring-amber-700/40"
              />
            </label>

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
                  onClick={() => loadDeals(true)}
                  className="mt-3 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500"
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && filteredDeals.length === 0 && (
              <div className="rounded-2xl border border-dashed border-amber-300/80 bg-white/60 px-4 py-10 text-center dark:border-amber-900 dark:bg-dm-inset">
                <p className="text-muted text-sm">{emptyMessage}</p>
              </div>
            )}

            {!loading && !error && filteredDeals.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {filteredDeals.map((deal) => (
              <WeeklyDealCard
                key={deal.id}
                deal={deal}
                showAddedFeedback={showAddedFeedback(deal)}
                onAdd={handleAdd}
                onOpen={setSelectedDeal}
              />
                ))}
              </div>
            )}
              </>
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
              <p className="text-muted rounded-2xl border border-dashed border-indigo-300/80 bg-white/50 px-4 py-10 text-center text-sm dark:border-indigo-900 dark:bg-dm-inset">
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

      <aside
        role="note"
        aria-label="Pricing and affiliation notice"
        className="sticky bottom-2 z-20 mt-4 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2.5 text-[10px] leading-relaxed text-slate-600 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-zinc-950/95 dark:text-slate-300"
      >
        <p>
          <span className="font-semibold text-slate-800 dark:text-slate-100">Notice:</span> Deals,
          prices, and special offers are user-reported or aggregated for reference only. Prices
          in-store at checkout prevail. Not affiliated with or endorsed by Coles, Woolworths, or
          ALDI.
        </p>
      </aside>
    </div>
  );
}
