export const SYDNEY_TZ = 'Australia/Sydney';

/** Minutes after the scheduled Sydney minute that we still accept a Vercel trigger. */
const CRON_WINDOW_MINUTES = 10;

/**
 * @typedef {{ weekday: string, hour: number, minute: number, dateKey: string, formatted: string }} SydneyClock
 */

/**
 * @param {Date} [now]
 * @returns {SydneyClock}
 */
export function getSydneyClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: SYDNEY_TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const pick = (type) => parts.find((part) => part.type === type)?.value ?? '';
  const weekday = pick('weekday');
  const year = pick('year');
  const month = pick('month');
  const day = pick('day');
  let hour = Number(pick('hour'));
  const minute = Number(pick('minute'));
  if (hour === 24) hour = 0;

  return {
    weekday,
    hour,
    minute,
    dateKey: `${year}-${month}-${day}`,
    formatted: `${year}-${month}-${day} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} (${SYDNEY_TZ})`,
  };
}

/**
 * @param {SydneyClock} clock
 */
export function isSydneySneakPeekDue(clock) {
  return (
    clock.weekday === 'Mon' &&
    clock.hour === 18 &&
    clock.minute >= 0 &&
    clock.minute <= CRON_WINDOW_MINUTES
  );
}

/**
 * @param {SydneyClock} clock
 */
export function isSydneyOfficialResetDue(clock) {
  return (
    clock.weekday === 'Wed' &&
    clock.hour === 0 &&
    clock.minute >= 0 &&
    clock.minute <= CRON_WINDOW_MINUTES
  );
}

/**
 * @param {'sneakPeek'|'officialReset'} mode
 * @param {Date} [now]
 */
export function isSydneyGroceryCronDue(mode, now = new Date()) {
  const clock = getSydneyClock(now);
  if (mode === 'sneakPeek') return isSydneySneakPeekDue(clock);
  if (mode === 'officialReset') return isSydneyOfficialResetDue(clock);
  return false;
}

/**
 * @param {'sneakPeek'|'officialReset'} mode
 * @param {Date} [now]
 */
export function getSydneyCronSkipReason(mode, now = new Date()) {
  const clock = getSydneyClock(now);
  if (mode === 'sneakPeek') {
    return `Sydney sneak peek runs Mon 18:00–18:${String(CRON_WINDOW_MINUTES).padStart(2, '0')}; now ${clock.formatted}.`;
  }
  return `Sydney official reset runs Wed 00:00–00:${String(CRON_WINDOW_MINUTES).padStart(2, '0')}; now ${clock.formatted}.`;
}
