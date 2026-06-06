import { useMemo } from 'react';
import { Star } from 'lucide-react';

/**
 * @param {Array<{ store: string, label: string, price: number|null }>} prices
 */
function findCheapestStores(prices) {
  const valid = prices.filter((entry) => entry.price != null);
  if (valid.length === 0) return new Set();
  const min = Math.min(...valid.map((entry) => entry.price));
  return new Set(valid.filter((entry) => entry.price === min).map((entry) => entry.store));
}

function formatPrice(price) {
  if (price == null) return '—';
  return `$${price.toFixed(2)}`;
}

function buildDealTitle(deal, price) {
  if (!deal?.active || !deal.store) return undefined;
  const label = deal.label || deal.store;
  const pricePart = price != null ? ` ${formatPrice(price)}` : '';
  const discount = deal.discountText
    ? ` (${deal.discountText}${deal.isHalfPrice ? ' Sale!' : ''})`
    : '';
  return `${label}:${pricePart}${discount}`;
}

/**
 * @param {{
 *   pricing: {
 *     prices: Array<{ store: string, label: string, price: number|null }>,
 *     deal: { active: boolean, store: string|null, label: string|null, discountText: string|null, isHalfPrice: boolean, originalPrice: number|null }
 *   }|null|undefined,
 *   loading?: boolean
 * }} props
 */
export function ShoppingListPriceBadges({ pricing, loading = false }) {
  const cheapestStores = useMemo(
    () => (pricing?.prices ? findCheapestStores(pricing.prices) : new Set()),
    [pricing],
  );

  if (loading) {
    return (
      <div className="mt-1.5 flex flex-wrap gap-1" aria-hidden>
        {Array.from({ length: 4 }).map((_, index) => (
          <span
            key={index}
            className="h-6 w-[4.5rem] animate-pulse rounded-full bg-slate-200 dark:bg-slate-700"
          />
        ))}
      </div>
    );
  }

  if (!pricing?.prices?.length) return null;

  const { prices, deal } = pricing;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1" role="list" aria-label="Local supermarket prices">
      {prices.map((entry) => {
        const isCheapest = cheapestStores.has(entry.store);
        const hasDeal = Boolean(deal?.active && deal.store === entry.store);
        const dealTitle = hasDeal ? buildDealTitle(deal, entry.price) : undefined;

        return (
          <span
            key={entry.store}
            role="listitem"
            title={dealTitle}
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ring-1 ${
              isCheapest
                ? 'bg-emerald-100 text-emerald-900 ring-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:ring-emerald-700'
                : 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'
            }`}
          >
            {hasDeal && (
              <Star
                className="h-2.5 w-2.5 shrink-0 fill-rose-600 text-rose-600 dark:fill-rose-500 dark:text-rose-500"
                aria-label={`${entry.label} deal`}
              />
            )}
            <span className="truncate">{entry.label}</span>
            <span className={isCheapest ? 'font-bold' : 'font-medium'}>
              {formatPrice(entry.price)}
            </span>
          </span>
        );
      })}
    </div>
  );
}
