import {
  BABY_CATEGORY,
  FOOD_CATEGORY,
  HOUSEHOLD_CATEGORY,
  ITEM_TYPE,
  STATUS,
  isOnShoppingList,
} from './constants.js';
import { isItemTypeEnabled } from './modules.js';

/** Fraction of consumptionDuration elapsed before flagging Almost Finished. */
export const CONSUMPTION_ALERT_THRESHOLD = 0.85;

const EXPIRING_SOON_DAYS = 3;

/** @type {{ keywords: string[], days: number }[]} */
const NAME_DURATION_RULES = [
  { keywords: ['milk'], days: 7 },
  {
    keywords: [
      'barramundi',
      'baramundi',
      'snapper',
      'flathead',
      'prawn',
      'shrimp',
      'calamari',
      'squid',
      'fish fillet',
      'tuna steak',
      'seafood',
    ],
    days: 2,
  },
  {
    keywords: ['chicken', 'beef', 'pork', 'lamb', 'mince', 'meat', 'salmon', 'chorizo', 'bacon', 'sausage', 'steak'],
    days: 3,
  },
  { keywords: ['napp', 'diaper'], days: 21 },
  { keywords: ['dishwashing tablet', 'dish tablet'], days: 30 },
  { keywords: ['toilet cleaner', 'toilet bowl', 'bathroom cleaner', 'oven cleaner'], days: 120 },
  {
    keywords: [
      'salt',
      'pepper',
      'spice',
      'cumin',
      'paprika',
      'turmeric',
      'oregano',
      'cinnamon',
      'chili',
      'herb',
    ],
    days: 365,
  },
  { keywords: ['egg'], days: 14 },
  { keywords: ['bread'], days: 5 },
  { keywords: ['yogurt', 'yoghurt', 'yogurt pouch', 'drinking yogurt'], days: 10 },
  { keywords: ['cottage cheese'], days: 7 },
  { keywords: ['cheese'], days: 14 },
  { keywords: ['orange', 'mandarin', 'clementine', 'grapefruit', 'lemon', 'lime'], days: 10 },
  {
    keywords: ['strawberry', 'blueberry', 'raspberry', 'blackberry', 'berry', 'cranberry', 'cherry'],
    days: 5,
  },
  { keywords: ['celery', 'asparagus'], days: 7 },
  { keywords: ['cauliflower', 'broccoli', 'cabbage', 'bok choy', 'kale', 'spinach', 'lettuce'], days: 5 },
  { keywords: ['potato', 'sweet potato', 'kumara'], days: 14 },
  { keywords: ['potato chips', 'corn chips', 'tortilla chips', 'crisps', 'chips'], days: 21 },
  { keywords: ['toilet paper'], days: 21 },
  { keywords: ['laundry'], days: 30 },
];

/** @type {Record<string, Record<string, number>>} */
const CATEGORY_DURATION_DEFAULTS = {
  [ITEM_TYPE.FOOD]: {
    [FOOD_CATEGORY.FRESH]: 7,
    [FOOD_CATEGORY.AMBIENT]: 30,
    [FOOD_CATEGORY.FREEZER]: 60,
  },
  [ITEM_TYPE.HOUSEHOLD]: {
    [HOUSEHOLD_CATEGORY.CLEANING]: 30,
    [HOUSEHOLD_CATEGORY.LAUNDRY]: 30,
    [HOUSEHOLD_CATEGORY.BATHROOM]: 45,
  },
  [ITEM_TYPE.BABY]: {
    [BABY_CATEGORY.DIAPERS]: 21,
    [BABY_CATEGORY.FOOD]: 14,
    [BABY_CATEGORY.ESSENTIALS]: 30,
  },
};

function normalizeForMatch(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/yoghurt/g, 'yogurt')
    .replace(/[^a-z0-9]+/g, ' ');
}

/**
 * Default expected consumption window in days for a household item.
 * @param {string} name
 * @param {string} itemType
 * @param {string} category
 * @returns {number}
 */
export function getDefaultConsumptionDuration(name, itemType, category) {
  const normalized = normalizeForMatch(name);

  for (const rule of NAME_DURATION_RULES) {
    if (
      rule.keywords.some((kw) => {
        if (kw.includes(' ')) return normalized.includes(kw);
        return normalized.split(' ').some((w) => w === kw || w.startsWith(kw));
      })
    ) {
      return rule.days;
    }
  }

  const byType = CATEGORY_DURATION_DEFAULTS[itemType];
  if (byType?.[category]) return byType[category];

  if (itemType === ITEM_TYPE.BABY) return 21;
  if (itemType === ITEM_TYPE.HOUSEHOLD) return 30;
  return 14;
}

/**
 * @param {string|undefined|null} stockedAt ISO timestamp
 * @returns {number}
 */
export function daysSinceStocked(stockedAt) {
  if (!stockedAt) return 0;
  const start = new Date(stockedAt);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  const ms = now.getTime() - start.getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24));
}

function daysUntilExpiry(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${iso}T12:00:00`);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function isExpiryUrgent(item, expiringSoonDays = EXPIRING_SOON_DAYS) {
  if (!item?.expiryDate || isOnShoppingList(item)) return false;
  return daysUntilExpiry(item.expiryDate) <= expiringSoonDays;
}

/**
 * @param {{ consumptionDuration?: number, stockedAt?: string, createdAt?: string, name?: string, itemType?: string, category?: string }} item
 */
export function getConsumptionProgress(item) {
  const duration =
    item.consumptionDuration ??
    getDefaultConsumptionDuration(item.name ?? '', item.itemType ?? ITEM_TYPE.FOOD, item.category ?? '');
  if (!duration || duration <= 0) return 0;
  const stockedAt = item.stockedAt ?? item.createdAt;
  return Math.min(1, daysSinceStocked(stockedAt) / duration);
}

/**
 * @param {{ status: string, consumptionDuration?: number, stockedAt?: string, createdAt?: string, name?: string, itemType?: string, category?: string }} item
 */
export function isAlmostFinished(item) {
  if (!item || isOnShoppingList(item)) return false;
  return getConsumptionProgress(item) >= CONSUMPTION_ALERT_THRESHOLD;
}

/**
 * Computes the display status badge (expiry beats consumption timing).
 * @param {{ status: string, expiryDate?: string|null, consumptionDuration?: number, stockedAt?: string, createdAt?: string, name?: string, itemType?: string, category?: string }} item
 * @returns {string}
 */
export function calculateItemStatus(item) {
  if (!item || isOnShoppingList(item)) return STATUS.OUT;
  if (isExpiryUrgent(item)) return STATUS.EXPIRING;
  if (isAlmostFinished(item)) return STATUS.ALMOST_FINISHED;
  return STATUS.FRESH;
}

/**
 * @param {{ name: string, itemType: string, category: string }} item
 */
export function buildConsumptionFields(item) {
  const now = new Date().toISOString();
  return {
    consumptionDuration: getDefaultConsumptionDuration(item.name, item.itemType, item.category),
    stockedAt: now,
    createdAt: now,
  };
}

/**
 * @param {{ consumptionDuration?: number, stockedAt?: string, createdAt?: string, name?: string }} item
 */
export function getConsumptionUrgencyLabel(item) {
  const duration =
    item.consumptionDuration ??
    getDefaultConsumptionDuration(item.name ?? '', item.itemType ?? ITEM_TYPE.FOOD, item.category ?? '');
  const elapsed = Math.round(daysSinceStocked(item.stockedAt ?? item.createdAt));
  const remaining = Math.max(0, Math.round(duration - elapsed));
  const pct = Math.min(100, Math.round(getConsumptionProgress(item) * 100));
  return `Usually ~${duration}d supply · ~${remaining}d left (${pct}% used)`;
}

/**
 * @param {Array<{ status: string, itemType: string, name: string }>} items
 * @param {Record<string, boolean>} enabledModules
 */
export function filterPredictedLowItems(items, enabledModules) {
  return (items ?? [])
    .filter(
      (item) =>
        isItemTypeEnabled(enabledModules, item.itemType) &&
        !isOnShoppingList(item) &&
        isAlmostFinished(item),
    )
    .sort((a, b) => getConsumptionProgress(b) - getConsumptionProgress(a));
}
