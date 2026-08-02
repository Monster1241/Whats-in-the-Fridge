import { FOOD_CATEGORY, ITEM_TYPE } from './constants.js';
import { getDefaultConsumptionDuration } from './consumption.js';

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** @returns {string} YYYY-MM-DD */
export function toIsoDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse Open Food Facts date strings (YYYY-MM-DD, YYYY-MM, DD/MM/YYYY).
 * @param {unknown} raw
 * @returns {string|null} YYYY-MM-DD
 */
export function parseProductExpiryDate(raw) {
  if (raw == null || raw === '') return null;
  const text = String(raw).trim();
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const slash = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (slash) {
    const [, dd, mm, yyyy] = slash;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  const yearMonth = text.match(/^(\d{4})-(\d{2})$/);
  if (yearMonth) {
    const [, yyyy, mm] = yearMonth;
    const lastDay = new Date(Number(yyyy), Number(mm), 0).getDate();
    return `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return toIsoDateOnly(parsed);
  return null;
}

/**
 * Estimate a use-by date from item type, storage, and name.
 * @param {{
 *   name: string,
 *   itemType: string,
 *   category: string,
 *   subCategory?: string|null,
 * }} item
 * @param {{ fromDate?: Date, productExpiry?: string|null }} [options]
 * @returns {{ expiryDate: string|null, source: 'product'|'estimated'|null, label: string|null }}
 */
export function guessExpiryForItem(item, options = {}) {
  const fromDate = options.fromDate ?? new Date();
  const productExpiry = parseProductExpiryDate(options.productExpiry);

  if (productExpiry) {
    return {
      expiryDate: productExpiry,
      source: 'product',
      label: `Use by ${formatExpiryLabel(productExpiry)} (from product data)`,
    };
  }

  if (!item || item.itemType !== ITEM_TYPE.FOOD) {
    return { expiryDate: null, source: null, label: null };
  }

  const { category, name } = item;

  if (category === FOOD_CATEGORY.AMBIENT) {
    const normalized = String(name || '').toLowerCase();
    const shortLifeAmbient =
      /\bbread\b|\btortilla\b|\bwrap\b|\bcake\b|\bcroissant\b/.test(normalized);
    if (!shortLifeAmbient) {
      return { expiryDate: null, source: null, label: null };
    }
  }

  const days = getDefaultConsumptionDuration(name, item.itemType, category);
  const expiryDate = toIsoDateOnly(addDays(fromDate, days));

  let shelfHint = `~${days} days`;
  if (category === FOOD_CATEGORY.FREEZER) shelfHint = `~${days} days frozen`;
  if (category === FOOD_CATEGORY.FRESH) shelfHint = `~${days} days chilled`;

  return {
    expiryDate,
    source: 'estimated',
    label: `Suggested use by ${formatExpiryLabel(expiryDate)} (${shelfHint})`,
  };
}

function formatExpiryLabel(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
