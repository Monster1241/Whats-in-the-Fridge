import {
  inferCurrencyFromPostalCode,
} from '../utils/currency.js';

export const POSTCODE_STORAGE_KEY = 'witf.cataloguePostcode';
export const DEFAULT_POSTCODE = '2000';
/** Same-tab sync between Settings and Deals. */
export const POSTCODE_CHANGE_EVENT = 'fridge:postcode-changed';

const MAX_POSTAL_LEN = 12;

/**
 * Normalize a postal / ZIP code for storage (letters, digits, space, hyphen).
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizePostalCode(value) {
  const cleaned = String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_POSTAL_LEN);
  return cleaned.length >= 3 ? cleaned : null;
}

/**
 * @returns {string}
 */
export function readStoredPostcode() {
  try {
    const stored = localStorage.getItem(POSTCODE_STORAGE_KEY);
    const normalized = normalizePostalCode(stored);
    return normalized || DEFAULT_POSTCODE;
  } catch {
    return DEFAULT_POSTCODE;
  }
}

/**
 * @param {string} postcode
 * @returns {string|null} normalized postal code or null if invalid
 */
export function writeStoredPostcode(postcode) {
  const normalized = normalizePostalCode(postcode);
  if (!normalized) return null;
  try {
    localStorage.setItem(POSTCODE_STORAGE_KEY, normalized);
  } catch {
    // ignore quota / private mode
  }
  if (typeof window !== 'undefined') {
    const locale =
      typeof navigator !== 'undefined' ? navigator.language || navigator.languages?.[0] : '';
    const currency = inferCurrencyFromPostalCode(normalized, locale);
    window.dispatchEvent(
      new CustomEvent(POSTCODE_CHANGE_EVENT, {
        detail: { postcode: normalized, currency: currency || undefined },
      }),
    );
  }
  return normalized;
}

/**
 * Australian catalogue flyers key off 4-digit AU postcodes.
 * @param {string} value
 */
export function isValidAustralianPostcode(value) {
  return /^\d{4}$/.test(String(value ?? '').replace(/\s/g, ''));
}

/**
 * Postcode to send to catalogue / deals APIs (AU only; otherwise fallback).
 * @param {string} [postcode]
 */
export function postcodeForCatalogue(postcode = readStoredPostcode()) {
  const compact = String(postcode ?? '').replace(/\s/g, '');
  return isValidAustralianPostcode(compact) ? compact.slice(0, 4) : DEFAULT_POSTCODE;
}
