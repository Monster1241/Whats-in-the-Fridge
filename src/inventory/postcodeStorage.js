export const POSTCODE_STORAGE_KEY = 'witf.cataloguePostcode';
export const DEFAULT_POSTCODE = '2000';
/** Same-tab sync between Settings and Deals. */
export const POSTCODE_CHANGE_EVENT = 'fridge:postcode-changed';

/**
 * @returns {string}
 */
export function readStoredPostcode() {
  try {
    const stored = localStorage.getItem(POSTCODE_STORAGE_KEY);
    const digits = String(stored ?? '').replace(/\D/g, '').slice(0, 4);
    return digits.length === 4 ? digits : DEFAULT_POSTCODE;
  } catch {
    return DEFAULT_POSTCODE;
  }
}

/**
 * @param {string} postcode
 * @returns {string|null} normalized 4-digit postcode or null if invalid
 */
export function writeStoredPostcode(postcode) {
  const digits = String(postcode ?? '').replace(/\D/g, '').slice(0, 4);
  if (digits.length !== 4) return null;
  try {
    localStorage.setItem(POSTCODE_STORAGE_KEY, digits);
  } catch {
    // ignore quota / private mode
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(POSTCODE_CHANGE_EVENT, { detail: { postcode: digits } }),
    );
  }
  return digits;
}

/**
 * @param {string} value
 */
export function isValidAustralianPostcode(value) {
  return /^\d{4}$/.test(String(value ?? '').replace(/\D/g, '').slice(0, 4));
}
