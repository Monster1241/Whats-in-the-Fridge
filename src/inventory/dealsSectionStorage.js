export const DEALS_SECTION_STORAGE_KEY = 'witf.hotDealsSection';

const VALID_SECTIONS = new Set(['deals', 'catalogues']);

/**
 * @returns {'deals'|'catalogues'}
 */
export function readStoredDealsSection() {
  try {
    const stored = localStorage.getItem(DEALS_SECTION_STORAGE_KEY);
    return VALID_SECTIONS.has(stored) ? stored : 'deals';
  } catch {
    return 'deals';
  }
}

/**
 * @param {'deals'|'catalogues'} section
 */
export function writeStoredDealsSection(section) {
  if (!VALID_SECTIONS.has(section)) return;
  try {
    localStorage.setItem(DEALS_SECTION_STORAGE_KEY, section);
  } catch {
    // ignore quota / private mode
  }
}
