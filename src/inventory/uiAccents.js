import { ITEM_TYPE, STATUS } from './constants.js';

export const SHOPPING_ACCENT = {
  border: 'border-sky-300 dark:border-sky-600',
  borderSoft: 'border-sky-200 dark:border-sky-800',
  bgActive: 'bg-sky-50 ring-2 ring-sky-500 dark:bg-sky-950/50 dark:ring-sky-500',
  bgMuted: 'bg-sky-100 dark:bg-sky-950/40',
  text: 'text-sky-700 dark:text-sky-300',
  textLabel: 'text-sky-800 dark:text-sky-400',
  btn: 'bg-sky-600 shadow-sky-900/40 hover:bg-sky-500',
  badge: 'bg-sky-600',
  focus: 'focus:border-sky-500 focus:ring-sky-500/30',
  section: 'text-sky-600 dark:text-sky-400',
  hover: 'hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-950 dark:hover:text-sky-400',
};

export const STATUS_META = {
  [STATUS.FRESH]: {
    label: 'Plentiful',
    badge: 'bg-emerald-600 text-white',
    section: 'fresh',
  },
  [STATUS.EXPIRING]: {
    label: 'Expiring Soon',
    badge: 'bg-amber-500 text-slate-900',
    section: 'expiring',
  },
  [STATUS.EXPIRED]: {
    label: 'Expired',
    badge: 'bg-rose-700 text-white',
    section: 'expired',
  },
  [STATUS.ALMOST_FINISHED]: {
    label: 'Almost Finished',
    badge: 'bg-orange-500 text-white',
    section: 'almost',
  },
  [STATUS.OUT]: {
    label: 'Out of Stock',
    badge: 'bg-rose-600 text-white',
    section: 'out',
  },
};

export function itemTypeLabelEmoji(itemType) {
  if (itemType === ITEM_TYPE.BABY) return '👶';
  if (itemType === ITEM_TYPE.HOUSEHOLD) return '🕯️';
  return '🍏';
}

/** Semantic icon key for item type (use with MetaIcon). */
export function itemTypeIconName(itemType) {
  if (itemType === ITEM_TYPE.BABY) return ITEM_TYPE.BABY;
  if (itemType === ITEM_TYPE.HOUSEHOLD) return ITEM_TYPE.HOUSEHOLD;
  return ITEM_TYPE.FOOD;
}
