/** Mirrors server weeklyDeals dealType tiers for UI filtering. */

export const DEAL_TYPE_TIERS = [
  'Half Price',
  'Super Saver',
  'Price Drop',
  'Reduced',
  'Special Buy',
];

export const DEAL_TYPE_SUB_FILTERS = [
  {
    id: 'all',
    label: 'Show All',
    types: null,
    active: 'bg-slate-700 text-white ring-slate-800 dark:bg-slate-600',
    idle: 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600',
  },
  {
    id: 'halfPrice',
    label: 'Half Price',
    types: ['Half Price'],
    active: 'bg-rose-700 text-white ring-rose-800',
    idle: 'bg-rose-50 text-rose-800 ring-rose-200 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-800',
  },
  {
    id: 'superSaver',
    label: 'Super Savers',
    types: ['Super Saver'],
    active: 'bg-amber-500 text-amber-950 ring-amber-600',
    idle: 'bg-amber-50 text-amber-900 ring-amber-200 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800',
  },
  {
    id: 'priceDrops',
    label: 'Price Drops',
    types: ['Price Drop', 'Reduced'],
    active: 'bg-sky-700 text-white ring-sky-800',
    idle: 'bg-sky-50 text-sky-800 ring-sky-200 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-800',
  },
];

/**
 * @param {{ dealType?: string }} deal
 * @param {string} filterId
 */
export function matchesDealTypeSubFilter(deal, filterId) {
  const filter = DEAL_TYPE_SUB_FILTERS.find((entry) => entry.id === filterId);
  if (!filter || !filter.types) return true;
  return filter.types.includes(deal.dealType);
}
