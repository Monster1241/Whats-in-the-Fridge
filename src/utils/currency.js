/** Supported household currencies (ISO 4217). */
export const DEFAULT_CURRENCY = 'AUD';

export const CURRENCY_OPTIONS = [
  { code: 'AUD', label: 'Australian Dollar', symbol: '$', locales: ['en-AU'] },
  { code: 'USD', label: 'US Dollar', symbol: '$', locales: ['en-US'] },
  { code: 'GBP', label: 'British Pound', symbol: '£', locales: ['en-GB'] },
  { code: 'EUR', label: 'Euro', symbol: '€', locales: ['en-IE', 'de-DE', 'fr-FR'] },
  { code: 'NZD', label: 'New Zealand Dollar', symbol: '$', locales: ['en-NZ'] },
  { code: 'CAD', label: 'Canadian Dollar', symbol: '$', locales: ['en-CA'] },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹', locales: ['en-IN'] },
  { code: 'SGD', label: 'Singapore Dollar', symbol: '$', locales: ['en-SG'] },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥', locales: ['ja-JP'] },
  { code: 'HKD', label: 'Hong Kong Dollar', symbol: '$', locales: ['zh-HK', 'en-HK'] },
  { code: 'MYR', label: 'Malaysian Ringgit', symbol: 'RM', locales: ['ms-MY', 'en-MY'] },
  { code: 'THB', label: 'Thai Baht', symbol: '฿', locales: ['th-TH'] },
  { code: 'PHP', label: 'Philippine Peso', symbol: '₱', locales: ['en-PH'] },
  { code: 'ZAR', label: 'South African Rand', symbol: 'R', locales: ['en-ZA'] },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'CHF', locales: ['de-CH', 'fr-CH'] },
  { code: 'SEK', label: 'Swedish Krona', symbol: 'kr', locales: ['sv-SE'] },
  { code: 'NOK', label: 'Norwegian Krone', symbol: 'kr', locales: ['nb-NO'] },
  { code: 'DKK', label: 'Danish Krone', symbol: 'kr', locales: ['da-DK'] },
  { code: 'MXN', label: 'Mexican Peso', symbol: '$', locales: ['es-MX'] },
  { code: 'BRL', label: 'Brazilian Real', symbol: 'R$', locales: ['pt-BR'] },
  { code: 'KRW', label: 'South Korean Won', symbol: '₩', locales: ['ko-KR'] },
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ', locales: ['ar-AE', 'en-AE'] },
  { code: 'CNY', label: 'Chinese Yuan', symbol: '¥', locales: ['zh-CN'] },
];

const CURRENCY_BY_CODE = new Map(CURRENCY_OPTIONS.map((entry) => [entry.code, entry]));
const ALLOWED_CODES = new Set(CURRENCY_OPTIONS.map((entry) => entry.code));

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeCurrency(value) {
  const code = String(value ?? '')
    .trim()
    .toUpperCase();
  return ALLOWED_CODES.has(code) ? code : DEFAULT_CURRENCY;
}

/**
 * @param {unknown} code
 * @returns {string}
 */
export function currencyLabel(code) {
  const normalized = normalizeCurrency(code);
  const entry = CURRENCY_BY_CODE.get(normalized);
  return entry ? `${entry.code} · ${entry.label}` : normalized;
}

/**
 * @param {unknown} code
 */
export function currencyShortLabel(code) {
  return normalizeCurrency(code);
}

/**
 * @param {number|string|null|undefined} amount
 * @param {unknown} currency
 * @returns {string}
 */
export function formatMoney(amount, currency = DEFAULT_CURRENCY) {
  const value = Number(amount);
  const code = normalizeCurrency(currency);
  const entry = CURRENCY_BY_CODE.get(code);
  const locale = entry?.locales?.[0] || 'en';
  if (!Number.isFinite(value)) {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(0);
    } catch {
      return `${code} 0.00`;
    }
  }
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

/**
 * Best-effort currency guess from a postal / ZIP code.
 * Ambiguous formats use the optional locale hint (e.g. navigator.language).
 *
 * @param {string|null|undefined} postalCode
 * @param {string|null|undefined} [localeHint]
 * @returns {string|null} ISO currency code, or null if unknown
 */
export function inferCurrencyFromPostalCode(postalCode, localeHint) {
  const raw = String(postalCode ?? '')
    .trim()
    .toUpperCase();
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, '');
  const locale = String(localeHint ?? '').trim();

  // Canada: A1A 1A1
  if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact)) return 'CAD';

  // UK outward+inward
  if (/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact)) return 'GBP';

  // Japan 123-4567 or 7 digits
  if (/^\d{3}-?\d{4}$/.test(compact)) return 'JPY';

  // Australia / New Zealand — both 4 digits; prefer locale, else AUD
  if (/^\d{4}$/.test(compact)) {
    if (/^en-NZ$/i.test(locale) || /[-_]NZ$/i.test(locale)) return 'NZD';
    return 'AUD';
  }

  // US ZIP or ZIP+4 (also overlaps some EU 5-digit codes)
  if (/^\d{5}(-\d{4})?$/.test(compact)) {
    if (/[-_](DE|FR|IT|ES|NL|AT|BE|PT|FI|IE|LU|GR)$/i.test(locale) || /^de|fr|it|es|nl|pt|fi/i.test(locale)) {
      return 'EUR';
    }
    if (/[-_]US$/i.test(locale) || /^en-US$/i.test(locale)) return 'USD';
    if (/[-_]MX$/i.test(locale) || /^es-MX$/i.test(locale)) return 'MXN';
    return 'USD';
  }

  // India / Singapore — 6 digits
  if (/^\d{6}$/.test(compact)) {
    if (/[-_]SG$/i.test(locale) || /^en-SG$/i.test(locale)) return 'SGD';
    return 'INR';
  }

  return null;
}

/**
 * @param {string|null|undefined} [localeHint]
 * @returns {string|null}
 */
export function inferCurrencyFromLocale(localeHint) {
  const locale = String(localeHint ?? '').trim();
  if (!locale) return null;
  const map = [
    [/[-_]AU$/i, 'AUD'],
    [/^en-AU$/i, 'AUD'],
    [/[-_]NZ$/i, 'NZD'],
    [/[-_]GB$|[-_]UK$/i, 'GBP'],
    [/^en-GB$/i, 'GBP'],
    [/[-_]US$/i, 'USD'],
    [/^en-US$/i, 'USD'],
    [/[-_]CA$/i, 'CAD'],
    [/[-_]IN$/i, 'INR'],
    [/[-_]SG$/i, 'SGD'],
    [/[-_]JP$/i, 'JPY'],
    [/[-_]HK$/i, 'HKD'],
    [/[-_]MY$/i, 'MYR'],
    [/[-_]TH$/i, 'THB'],
    [/[-_]PH$/i, 'PHP'],
    [/[-_]ZA$/i, 'ZAR'],
    [/[-_]CH$/i, 'CHF'],
    [/[-_]SE$/i, 'SEK'],
    [/[-_]NO$/i, 'NOK'],
    [/[-_]DK$/i, 'DKK'],
    [/[-_]MX$/i, 'MXN'],
    [/[-_]BR$/i, 'BRL'],
    [/[-_]KR$/i, 'KRW'],
    [/[-_]AE$/i, 'AED'],
    [/[-_]CN$/i, 'CNY'],
    [/[-_](DE|FR|IT|ES|NL|AT|BE|PT|FI|IE|LU|GR|EU)$/i, 'EUR'],
  ];
  for (const [pattern, code] of map) {
    if (pattern.test(locale)) return code;
  }
  return null;
}
