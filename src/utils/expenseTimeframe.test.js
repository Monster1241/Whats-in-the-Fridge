import { describe, expect, it } from 'vitest';
import {
  describeTimeframe,
  formatTimeframeRange,
  getTimeframeOption,
  TIMEFRAME_OPTIONS,
  timeframeDayCount,
  timeframeStartDate,
} from './expenseTimeframe.js';

const NOW = new Date(2026, 8, 6, 16, 30, 0);

describe('expense timeframes', () => {
  it('uses rolling 7 / 14 / 30 day windows', () => {
    expect(TIMEFRAME_OPTIONS.map((option) => option.days)).toEqual([7, 14, 30]);
    expect(timeframeDayCount('weekly')).toBe(7);
    expect(timeframeDayCount('fortnightly')).toBe(14);
    expect(timeframeDayCount('monthly')).toBe(30);
    expect(getTimeframeOption('nope').id).toBe('weekly');
  });

  it('starts the window so today is included', () => {
    expect(timeframeStartDate('weekly', NOW)).toEqual(new Date(2026, 7, 31));
    expect(timeframeStartDate('fortnightly', NOW)).toEqual(new Date(2026, 7, 24));
    expect(timeframeStartDate('monthly', NOW)).toEqual(new Date(2026, 7, 8));
  });

  it('formats the visible date range', () => {
    expect(formatTimeframeRange('weekly', NOW, 'en-AU')).toMatch(/31 Aug – 6 Sep/);
    expect(formatTimeframeRange('fortnightly', NOW, 'en-AU')).toMatch(/24 Aug – 6 Sep/);
    expect(formatTimeframeRange('monthly', NOW, 'en-AU')).toMatch(/8 Aug – 6 Sep/);
  });

  it('includes both years when a window crosses New Year', () => {
    const newYear = new Date(2027, 0, 4, 9, 0, 0);
    expect(formatTimeframeRange('weekly', newYear, 'en-AU')).toMatch(/2026/);
    expect(formatTimeframeRange('weekly', newYear, 'en-AU')).toMatch(/2027/);
  });

  it('describes the selected period for the UI', () => {
    const weekly = describeTimeframe('weekly', NOW, 'en-AU');
    expect(weekly.label).toBe('Weekly');
    expect(weekly.hint).toBe('Last 7 days');
    expect(weekly.rangeLabel).toMatch(/31 Aug – 6 Sep/);
  });
});
