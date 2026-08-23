import { describe, expect, it } from 'vitest';
import { getNextWednesdayExpiry } from './groceryCycle.js';
import {
  getActiveDealStoresForRegion,
  getWeeklyCycleBounds,
  getWeeklyCycleIndex,
  getCurrentWeeklyCycleStart,
} from './dealCycle.js';
import { buildDealsForCycle } from './weeklyDeals.js';

describe('dealCycle', () => {
  it('alternates active stores every weekly cycle', () => {
    const evenStores = getActiveDealStoresForRegion(0, 'NSW_Metro');
    const oddStores = getActiveDealStoresForRegion(1, 'NSW_Metro');
    expect(evenStores).toEqual(['coles', 'woolworths', 'aldi']);
    expect(oddStores).toEqual(['harrisfarm', 'costco', 'woolworths']);
  });

  it('uses one-week bounds between Wednesdays', () => {
    const from = new Date('2024-01-03T12:00:00.000Z');
    const cycle = getWeeklyCycleBounds(from);
    expect(cycle.validFrom.getTime()).toBe(getCurrentWeeklyCycleStart(from).getTime());
    expect(cycle.expiresAt.getTime()).toBe(getNextWednesdayExpiry(cycle.validFrom).getTime());
  });

  it('builds deals only for the active store rotation', () => {
    const cycle = getWeeklyCycleBounds(new Date('2024-01-03T12:00:00.000Z'));
    const weekOneDocs = buildDealsForCycle(cycle.expiresAt, {
      cycleIndex: cycle.cycleIndex,
      cycleStart: cycle.validFrom.toISOString(),
    });
    expect(weekOneDocs.every((deal) => ['coles', 'woolworths', 'aldi'].includes(deal.store))).toBe(
      true,
    );
    expect(weekOneDocs.every((deal) => Array.isArray(deal.regions) && deal.regions.length > 0)).toBe(
      true,
    );

    const weekTwoCycle = getWeeklyCycleBounds(new Date('2024-01-10T12:00:00.000Z'));
    const weekTwoDocs = buildDealsForCycle(weekTwoCycle.expiresAt, {
      cycleIndex: weekTwoCycle.cycleIndex,
      cycleStart: weekTwoCycle.validFrom.toISOString(),
    });
    expect(
      weekTwoDocs.every((deal) => ['harrisfarm', 'costco', 'woolworths'].includes(deal.store)),
    ).toBe(true);
  });

  it('increments cycle index every week', () => {
    expect(getWeeklyCycleIndex(new Date('2024-01-03T12:00:00.000Z'))).toBe(0);
    expect(getWeeklyCycleIndex(new Date('2024-01-10T12:00:00.000Z'))).toBe(1);
    expect(getWeeklyCycleIndex(new Date('2024-01-17T12:00:00.000Z'))).toBe(2);
  });

  it('limits active stores by catalogue region', () => {
    expect(getActiveDealStoresForRegion(1, 'VIC')).toEqual(['costco', 'woolworths']);
    expect(getActiveDealStoresForRegion(1, 'NSW_Metro')).toEqual([
      'harrisfarm',
      'costco',
      'woolworths',
    ]);
  });
});
