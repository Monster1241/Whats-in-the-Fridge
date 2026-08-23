import { getSydneyClock } from './sydneyCronGuard.js';
import { getCurrentWednesdayStart, getNextWednesdayExpiry } from './groceryCycle.js';

/** Minutes after the scheduled Sydney time we still accept a refresh trigger. */
export const STORE_REFRESH_WINDOW_MINUTES = 10;

/**
 * @typedef {'coles'|'woolworths'|'aldi'|'harrisfarm'|'costco'} DealStore
 * @typedef {{
 *   id: string,
 *   weekday: string,
 *   hour: number,
 *   minute: number,
 *   durationDays: number,
 * }} StoreDealWindow
 * @typedef {{
 *   windowId: string,
 *   validFrom: Date,
 *   validTo: Date,
 *   expiresAt: Date,
 * }} ActiveStoreDealWindow
 */

/** Sydney-time deal refresh windows per retailer (approximate AU retail cadence). */
export const STORE_DEAL_WINDOWS = /** @type {Record<DealStore, StoreDealWindow[]>} */ ({
  coles: [
    { id: 'weekly', weekday: 'Wed', hour: 0, minute: 0, durationDays: 7 },
    { id: 'sneakPeek', weekday: 'Mon', hour: 18, minute: 0, durationDays: 2 },
  ],
  woolworths: [
    { id: 'weekly', weekday: 'Wed', hour: 0, minute: 0, durationDays: 7 },
    { id: 'sneakPeek', weekday: 'Mon', hour: 18, minute: 0, durationDays: 2 },
  ],
  aldi: [
    { id: 'weekly', weekday: 'Wed', hour: 0, minute: 0, durationDays: 7 },
    { id: 'specialBuys', weekday: 'Sat', hour: 0, minute: 0, durationDays: 4 },
  ],
  harrisfarm: [{ id: 'weekly', weekday: 'Wed', hour: 0, minute: 0, durationDays: 7 }],
  costco: [{ id: 'weekly', weekday: 'Wed', hour: 0, minute: 0, durationDays: 7 }],
});

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * @param {Date} now
 */
function getSydneyInstantParts(now) {
  const clock = getSydneyClock(now);
  return {
    ...clock,
    weekdayIndex: WEEKDAY_INDEX[clock.weekday] ?? 0,
  };
}

/**
 * Approximate UTC instant for a Sydney local date/time (DST-aware via formatter round-trip).
 * @param {string} dateKey YYYY-MM-DD
 * @param {number} hour
 * @param {number} minute
 */
function sydneyLocalToUtc(dateKey, hour, minute) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const formatted = getSydneyClock(guess);
  const targetMinutes = hour * 60 + minute;
  const actualMinutes = formatted.hour * 60 + formatted.minute;
  const dayShift =
    formatted.dateKey < dateKey ? -1 : formatted.dateKey > dateKey ? 1 : 0;
  const adjusted = new Date(guess.getTime() + dayShift * 86_400_000);
  adjusted.setUTCMinutes(adjusted.getUTCMinutes() + (targetMinutes - actualMinutes));
  return adjusted;
}

/**
 * @param {StoreDealWindow} window
 * @param {Date} now
 * @returns {Date|null}
 */
function findLatestWindowStart(window, now) {
  const sydney = getSydneyInstantParts(now);
  const targetDow = WEEKDAY_INDEX[window.weekday] ?? 0;
  let daysBack = (sydney.weekdayIndex - targetDow + 7) % 7;
  let candidateKey = sydney.dateKey;

  if (daysBack === 0) {
    const nowMinutes = sydney.hour * 60 + sydney.minute;
    const startMinutes = window.hour * 60 + window.minute;
    if (nowMinutes < startMinutes) daysBack = 7;
  }

  if (daysBack > 0) {
    const base = sydneyLocalToUtc(candidateKey, 12, 0);
    base.setUTCDate(base.getUTCDate() - daysBack);
    candidateKey = getSydneyClock(base).dateKey;
  }

  return sydneyLocalToUtc(candidateKey, window.hour, window.minute);
}

/**
 * @param {DealStore} store
 * @param {Date} [now]
 * @returns {ActiveStoreDealWindow|null}
 */
export function getActiveStoreDealWindow(store, now = new Date()) {
  const windows = STORE_DEAL_WINDOWS[store];
  if (!windows?.length) return null;

  let best = null;

  for (const window of windows) {
    const validFrom = findLatestWindowStart(window, now);
    if (!validFrom) continue;
    const validTo = new Date(validFrom);
    validTo.setUTCDate(validTo.getUTCDate() + window.durationDays);
    validTo.setUTCMilliseconds(validTo.getUTCMilliseconds() - 1);

    if (now.getTime() < validFrom.getTime() || now.getTime() > validTo.getTime()) continue;

    if (!best || validFrom.getTime() > best.validFrom.getTime()) {
      best = {
        windowId: window.id,
        validFrom,
        validTo,
        expiresAt: validTo,
      };
    }
  }

  if (best) return best;

  const validFrom = getCurrentWednesdayStart(now);
  const validTo = getNextWednesdayExpiry(validFrom);
  return {
    windowId: 'weekly-fallback',
    validFrom,
    validTo,
    expiresAt: validTo,
  };
}

/**
 * @param {DealStore} store
 * @param {StoreDealWindow} window
 * @param {ReturnType<typeof getSydneyClock>} clock
 */
export function isStoreWindowRefreshDue(store, window, clock) {
  void store;
  return (
    clock.weekday === window.weekday &&
    clock.hour === window.hour &&
    clock.minute >= window.minute &&
    clock.minute <= window.minute + STORE_REFRESH_WINDOW_MINUTES
  );
}

/**
 * @param {Date} [now]
 * @returns {Array<{ store: DealStore, windowId: string }>}
 */
export function getStoresDueForDealRefresh(now = new Date()) {
  const clock = getSydneyClock(now);
  /** @type {Array<{ store: DealStore, windowId: string }>} */
  const due = [];

  for (const store of Object.keys(STORE_DEAL_WINDOWS)) {
    for (const window of STORE_DEAL_WINDOWS[store]) {
      if (isStoreWindowRefreshDue(store, window, clock)) {
        due.push({ store, windowId: window.id });
      }
    }
  }

  return due;
}

/**
 * @param {DealStore} store
 * @param {Date} [now]
 */
export function serializeStoreCycleStart(store, now = new Date()) {
  const active = getActiveStoreDealWindow(store, now);
  if (!active) return null;
  return `${store}:${active.windowId}:${active.validFrom.toISOString()}`;
}
