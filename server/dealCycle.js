import { getCurrentWednesdayStart, getNextWednesdayExpiry } from './groceryCycle.js';
import { DEAL_STORES } from './weeklyDeals.js';

/** Anchor Wednesday for stable bi-weekly cycle numbering (2024-01-03 UTC). */
const BIWEEKLY_REFERENCE = getCurrentWednesdayStart(new Date('2024-01-03T00:00:00.000Z'));
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Alternating store groups refreshed each bi-weekly cycle. */
export const DEAL_STORE_ROTATIONS = /** @type {const} */ ([
  ['coles', 'woolworths', 'aldi'],
  ['harrisfarm', 'costco', 'woolworths'],
]);

/**
 * @param {Date} [from]
 * @returns {number}
 */
export function getBiweeklyCycleIndex(from = new Date()) {
  const wednesday = getCurrentWednesdayStart(from);
  const weeksSince = Math.floor(
    (wednesday.getTime() - BIWEEKLY_REFERENCE.getTime()) / MS_PER_WEEK,
  );
  return Math.floor(weeksSince / 2);
}

/**
 * Start of the active two-week retail window (always a Wednesday 00:00 UTC).
 * @param {Date} [from]
 */
export function getCurrentBiweeklyCycleStart(from = new Date()) {
  const index = getBiweeklyCycleIndex(from);
  const start = new Date(BIWEEKLY_REFERENCE);
  start.setUTCDate(start.getUTCDate() + index * 14);
  return start;
}

/**
 * @param {Date} [from]
 * @returns {{ validFrom: Date, validTo: Date, expiresAt: Date, cycleIndex: number }}
 */
export function getBiweeklyCycleBounds(from = new Date()) {
  const validFrom = getCurrentBiweeklyCycleStart(from);
  const validTo = getNextWednesdayExpiry(validFrom);
  validTo.setUTCDate(validTo.getUTCDate() + 7);
  return {
    validFrom,
    validTo,
    expiresAt: validTo,
    cycleIndex: getBiweeklyCycleIndex(from),
  };
}

/**
 * True on the Wednesday that begins a new bi-weekly deal cycle.
 * @param {Date} [from]
 */
export function shouldRefreshDealsThisWeek(from = new Date()) {
  const wednesday = getCurrentWednesdayStart(from);
  const cycleStart = getCurrentBiweeklyCycleStart(from);
  return wednesday.getTime() === cycleStart.getTime();
}

/**
 * @param {number} cycleIndex
 * @returns {typeof DEAL_STORES[number][]}
 */
export function getActiveDealStores(cycleIndex) {
  const idx = Math.abs(Number(cycleIndex) || 0) % DEAL_STORE_ROTATIONS.length;
  return [...DEAL_STORE_ROTATIONS[idx]];
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
 */
export function getDealCycleMeta(from = new Date()) {
  const bounds = getBiweeklyCycleBounds(from);
  const activeStores = getActiveDealStores(bounds.cycleIndex);
  const nextCycleStart = new Date(bounds.validTo);
  nextCycleStart.setUTCDate(nextCycleStart.getUTCDate() + 1);
  nextCycleStart.setUTCHours(0, 0, 0, 0);

  return {
    cycleIndex: bounds.cycleIndex,
    validFrom: bounds.validFrom.toISOString(),
    validTo: bounds.validTo.toISOString(),
    expiresAt: bounds.expiresAt.toISOString(),
    cycleStart: serializeCycleStart(bounds.validFrom),
    activeStores,
    refreshWeek: shouldRefreshDealsThisWeek(from),
    nextRefreshAt: getCurrentBiweeklyCycleStart(nextCycleStart).toISOString(),
  };
}
