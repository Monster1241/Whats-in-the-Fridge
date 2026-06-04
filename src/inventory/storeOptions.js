export const PREFERRED_STORE_OPTIONS = [
  'ALDI',
  'Woolworths',
  'Coles',
  'Costco',
  'IGA',
  'Harris Farm',
  'Foodland',
  'Drakes',
  'Kmart',
  'Big W',
  'Chemist Warehouse',
];

const STORE_BADGE_STYLES = {
  ALDI: 'bg-orange-100 text-orange-900 ring-orange-200 dark:bg-orange-950/60 dark:text-orange-200 dark:ring-orange-800',
  Woolworths:
    'bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-800',
  Coles: 'bg-rose-100 text-rose-900 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:ring-rose-800',
  Costco:
    'bg-blue-100 text-blue-900 ring-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:ring-blue-800',
  IGA: 'bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-800',
  'Harris Farm':
    'bg-lime-100 text-lime-900 ring-lime-200 dark:bg-lime-950/60 dark:text-lime-200 dark:ring-lime-800',
  Foodland:
    'bg-red-100 text-red-900 ring-red-200 dark:bg-red-950/60 dark:text-red-200 dark:ring-red-800',
  Drakes:
    'bg-indigo-100 text-indigo-900 ring-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-200 dark:ring-indigo-800',
  Kmart: 'bg-sky-100 text-sky-900 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:ring-sky-800',
  'Big W':
    'bg-fuchsia-100 text-fuchsia-900 ring-fuchsia-200 dark:bg-fuchsia-950/60 dark:text-fuchsia-200 dark:ring-fuchsia-800',
  'Chemist Warehouse':
    'bg-violet-100 text-violet-900 ring-violet-200 dark:bg-violet-950/60 dark:text-violet-200 dark:ring-violet-800',
};

const DEFAULT_BADGE_STYLE =
  'bg-white/70 text-sky-800 ring-sky-200/80 dark:bg-slate-900/60 dark:text-sky-200 dark:ring-sky-700';

export function isValidPreferredStore(store) {
  return PREFERRED_STORE_OPTIONS.includes(store);
}

export function normalizePreferredStore(store) {
  if (store == null || store === '') return null;
  const trimmed = String(store).trim();
  if (!trimmed) return null;
  const match = PREFERRED_STORE_OPTIONS.find(
    (opt) => opt.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ?? null;
}

export function getStoreBadgeClassName(store) {
  return STORE_BADGE_STYLES[store] ?? DEFAULT_BADGE_STYLE;
}
