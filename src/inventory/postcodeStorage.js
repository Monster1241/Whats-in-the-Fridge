export const POSTCODE_STORAGE_KEY = 'witf.cataloguePostcode';
export const DEFAULT_POSTCODE = '2000';

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
  return digits;
}

/**
 * @param {string} value
 */
export function isValidAustralianPostcode(value) {
  return /^\d{4}$/.test(String(value ?? '').replace(/\D/g, '').slice(0, 4));
}
