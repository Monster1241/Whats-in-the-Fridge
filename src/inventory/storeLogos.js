/**
 * Neutral store badges — plain text only (no official supermarket logos / trademark artwork).
 */

export const STORE_DISPLAY_LABELS = {
  coles: 'Coles',
  woolworths: 'Woolworths',
  aldi: 'ALDI',
  harrisfarm: 'Harris Farm',
  costco: 'Costco',
};

/** Color chips for text badges (not brand logo assets). */
export const STORE_BADGE_STYLES = {
  coles: { bg: 'bg-red-600', text: 'text-white' },
  woolworths: { bg: 'bg-emerald-600', text: 'text-white' },
  aldi: { bg: 'bg-blue-800', text: 'text-white' },
  harrisfarm: { bg: 'bg-orange-500', text: 'text-white' },
  costco: { bg: 'bg-[#E31837]', text: 'text-white' },
};

/** @deprecated Use STORE_BADGE_STYLES — kept for any legacy imports. */
export const STORE_LOGO_FALLBACK = Object.fromEntries(
  Object.entries(STORE_BADGE_STYLES).map(([id, style]) => [
    id,
    {
      initials: (STORE_DISPLAY_LABELS[id] ?? id).slice(0, 2).toUpperCase(),
      bg: style.bg,
      text: style.text,
    },
  ]),
);

/** Official logo URLs intentionally removed for IP / brand-policy compliance. */
export const STORE_LOGO_URLS = {};

export function getStoreDisplayLabel(store, label = '') {
  const trimmed = String(label ?? '').trim();
  if (trimmed) return trimmed;
  const key = String(store ?? '').trim().toLowerCase();
  return STORE_DISPLAY_LABELS[key] || trimmed || key || 'Store';
}
