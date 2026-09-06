/** Rolling lookback windows used by household expenses. Today is included. */

export const TIMEFRAME_OPTIONS = [
  {
    id: 'weekly',
    label: 'Weekly',
    days: 7,
    hint: 'Last 7 days',
  },
  {
    id: 'fortnightly',
    label: 'Fortnightly',
    days: 14,
    hint: 'Last 14 days',
  },
  {
    id: 'monthly',
    label: 'Monthly',
    days: 30,
    hint: 'Last 30 days',
  },
];

const OPTION_BY_ID = new Map(TIMEFRAME_OPTIONS.map((option) => [option.id, option]));

/**
 * @param {string} timeframe
 * @returns {typeof TIMEFRAME_OPTIONS[number]}
 */
export function getTimeframeOption(timeframe) {
  return OPTION_BY_ID.get(String(timeframe ?? '').trim()) || TIMEFRAME_OPTIONS[0];
}

/**
 * @param {string} timeframe
 */
export function timeframeDayCount(timeframe) {
  return getTimeframeOption(timeframe).days;
}

/**
 * Inclusive start of the rolling window (local midnight).
 * Matches server/expenses.js timeframeStartDate.
 * @param {string} timeframe
 * @param {Date} [now]
 */
export function timeframeStartDate(timeframe, now = new Date()) {
  const days = timeframeDayCount(timeframe);
  const start = new Date(now.getTime());
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

/**
 * @param {Date} date
 * @param {string} [locale]
 * @param {{ includeYear?: boolean }} [options]
 */
export function formatCompactDate(date, locale, options = {}) {
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(options.includeYear ? { year: 'numeric' } : {}),
  });
}

/**
 * @param {string} timeframe
 * @param {Date} [now]
 * @param {string} [locale]
 */
export function formatTimeframeRange(timeframe, now = new Date(), locale) {
  const start = timeframeStartDate(timeframe, now);
  const end = new Date(now.getTime());
  end.setHours(0, 0, 0, 0);
  const includeYear = start.getFullYear() !== end.getFullYear();
  return `${formatCompactDate(start, locale, { includeYear })} – ${formatCompactDate(end, locale, { includeYear })}`;
}

/**
 * @param {string} timeframe
 * @param {Date} [now]
 * @param {string} [locale]
 */
export function describeTimeframe(timeframe, now = new Date(), locale) {
  const option = getTimeframeOption(timeframe);
  return {
    ...option,
    rangeLabel: formatTimeframeRange(timeframe, now, locale),
    start: timeframeStartDate(timeframe, now),
  };
}
