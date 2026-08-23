import { getCurrentWednesdayStart, getNextWednesdayExpiry } from './groceryCycle.js';
import { resolveCatalogueLocale } from './catalogueRegions.js';
import { getStoreCatalogueRegions } from './storeCatalogues.js';

/** Anchor Wednesday for stable weekly cycle numbering (2024-01-03 UTC). */
const WEEKLY_REFERENCE = getCurrentWednesdayStart(new Date('2024-01-03T00:00:00.000Z'));
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Alternating store groups refreshed each weekly cycle. */
export const DEAL_STORE_ROTATIONS = /** @type {const} */ ([
  ['coles', 'woolworths', 'aldi'],
  ['harrisfarm', 'costco', 'woolworths'],
]);

/**
 * @param {Date} [from]
 * @returns {number}
 */
export function getWeeklyCycleIndex(from = new Date()) {
  const wednesday = getCurrentWednesdayStart(from);
  return Math.floor((wednesday.getTime() - WEEKLY_REFERENCE.getTime()) / MS_PER_WEEK);
}

/**
 * Start of the active weekly retail window (Wednesday 00:00 UTC).
 * @param {Date} [from]
 */
export function getCurrentWeeklyCycleStart(from = new Date()) {
  return getCurrentWednesdayStart(from);
}

/**
 * @param {Date} [from]
 * @returns {{ validFrom: Date, validTo: Date, expiresAt: Date, cycleIndex: number }}
 */
export function getWeeklyCycleBounds(from = new Date()) {
  const validFrom = getCurrentWeeklyCycleStart(from);
  const validTo = getNextWednesdayExpiry(validFrom);
  return {
    validFrom,
    validTo,
    expiresAt: validTo,
    cycleIndex: getWeeklyCycleIndex(from),
  };
}

/** @deprecated Use getWeeklyCycleIndex */
export const getBiweeklyCycleIndex = getWeeklyCycleIndex;

/** @deprecated Use getCurrentWeeklyCycleStart */
export const getCurrentBiweeklyCycleStart = getCurrentWeeklyCycleStart;

/** @deprecated Use getWeeklyCycleBounds */
export const getBiweeklyCycleBounds = getWeeklyCycleBounds;

/**
 * Deals refresh every Wednesday with the official grocery reset.
 * @param {Date} [from]
 */
export function shouldRefreshDealsThisWeek(from = new Date()) {
  const clock = getCurrentWednesdayStart(from);
  const cycleStart = getCurrentWeeklyCycleStart(from);
  return clock.getTime() === cycleStart.getTime();
}

/**
 * @param {number} cycleIndex
 * @returns {string[]}
 */
export function getActiveDealStores(cycleIndex) {
  const idx = Math.abs(Number(cycleIndex) || 0) % DEAL_STORE_ROTATIONS.length;
  return [...DEAL_STORE_ROTATIONS[idx]];
}

/**
 * Active rotation stores that operate in the user's catalogue region.
 * @param {number} cycleIndex
 * @param {import('./catalogueRegions.js').CatalogueRegion} region
 */
export function getActiveDealStoresForRegion(cycleIndex, region) {
  return getActiveDealStores(cycleIndex).filter((store) =>
    getStoreCatalogueRegions(store).includes(region),
  );
}

/**
 * @param {Date} cycleStart
 */
export function serializeCycleStart(cycleStart) {
  const d =
    cycleStart instanceof Date ? cycleStart : new Date(cycleStart);
  return getCurrentWednesdayStart(d).toISOString();
}

/**
 * @param {Date} [from]
 * @param {string|null|undefined} [postcode]
 */
export function getDealCycleMeta(from = new Date(), postcode) {
  const bounds = getWeeklyCycleBounds(from);
  const locale = resolveCatalogueLocale(postcode);
  const activeStores = getActiveDealStores(bounds.cycleIndex);
  const activeStoresForRegion = getActiveDealStoresForRegion(bounds.cycleIndex, locale.region);
  const nextRefreshAt = new Date(bounds.validFrom);
  nextRefreshAt.setUTCDate(nextRefreshAt.getUTCDate() + 7);

  return {
    cycleIndex: bounds.cycleIndex,
    validFrom: bounds.validFrom.toISOString(),
    validTo: bounds.validTo.toISOString(),
    expiresAt: bounds.expiresAt.toISOString(),
    cycleStart: serializeCycleStart(bounds.validFrom),
    activeStores,
    activeStoresForRegion,
    refreshWeek: shouldRefreshDealsThisWeek(from),
    nextRefreshAt: nextRefreshAt.toISOString(),
    postcode: locale.postcode,
    region: locale.region,
    regionLabel: locale.regionLabel,
    isFallbackPostcode: locale.isFallback,
  };
}
