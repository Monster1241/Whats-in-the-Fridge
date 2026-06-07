/** Australian catalogue zone codes for postcode-based flyer localization. */

export const DEFAULT_FALLBACK_POSTCODE = '2000';
export const DEFAULT_FALLBACK_REGION = 'NSW_Metro';

export const REGION_LABELS = {
  ACT: 'ACT',
  NSW_Metro: 'Sydney Metro',
  NSW_Sth: 'Southern NSW',
  NSW_Nth: 'Northern NSW',
  VIC: 'Victoria',
  QLD: 'Queensland',
  SA: 'South Australia',
  WA: 'Western Australia',
  TAS: 'Tasmania',
  NT: 'Northern Territory',
};

/**
 * @typedef {keyof typeof REGION_LABELS} CatalogueRegion
 */

/** @type {Array<{ region: CatalogueRegion, test: (postcode: number) => boolean }>} */
const POSTCODE_REGION_RULES = [
  { region: 'ACT', test: (pc) => (pc >= 2600 && pc <= 2618) || (pc >= 2900 && pc <= 2920) },
  { region: 'NT', test: (pc) => pc >= 800 && pc <= 999 },
  { region: 'NSW_Nth', test: (pc) => pc >= 2280 && pc <= 2430 },
  { region: 'NSW_Metro', test: (pc) => pc >= 2000 && pc <= 2249 },
  { region: 'NSW_Sth', test: (pc) => pc >= 2250 && pc <= 2899 },
  { region: 'VIC', test: (pc) => pc >= 3000 && pc <= 3999 },
  { region: 'QLD', test: (pc) => pc >= 4000 && pc <= 4999 },
  { region: 'SA', test: (pc) => pc >= 5000 && pc <= 5999 },
  { region: 'WA', test: (pc) => pc >= 6000 && pc <= 6997 },
  { region: 'TAS', test: (pc) => pc >= 7000 && pc <= 7999 },
];

/**
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function normalizePostcode(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 4);
  if (digits.length !== 4) return null;
  return digits;
}

/**
 * @param {string|null|undefined} postcode
 * @returns {CatalogueRegion}
 */
export function postcodeToRegion(postcode) {
  const normalized = normalizePostcode(postcode) ?? DEFAULT_FALLBACK_POSTCODE;
  const pc = Number(normalized);
  if (!Number.isFinite(pc)) return DEFAULT_FALLBACK_REGION;

  for (const rule of POSTCODE_REGION_RULES) {
    if (rule.test(pc)) return rule.region;
  }

  return DEFAULT_FALLBACK_REGION;
}

/**
 * @param {string|null|undefined} postcode
 */
export function resolveCatalogueLocale(postcode) {
  const normalized = normalizePostcode(postcode) ?? DEFAULT_FALLBACK_POSTCODE;
  const region = postcodeToRegion(normalized);
  return {
    postcode: normalized,
    region,
    regionLabel: REGION_LABELS[region] ?? region,
    isFallback: !normalizePostcode(postcode),
  };
}

/**
 * @param {string[]} values
 * @returns {CatalogueRegion[]}
 */
export function normalizeCatalogueRegions(values) {
  if (!Array.isArray(values)) return [];
  const allowed = new Set(Object.keys(REGION_LABELS));
  return [
    ...new Set(
      values
        .map((value) =>
          String(value ?? '')
            .trim()
            .replace(/\s+/g, '_'),
        )
        .filter((value) => allowed.has(value)),
    ),
  ];
}

/**
 * @param {string} url
 * @param {string} postcode
 */
export function appendPostcodeToCatalogueUrl(url, postcode) {
  const base = String(url ?? '').trim();
  if (!base) return base;
  const normalized = normalizePostcode(postcode) ?? DEFAULT_FALLBACK_POSTCODE;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}postcode=${normalized}`;
}
