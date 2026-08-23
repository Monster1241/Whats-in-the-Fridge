import { describe, expect, it } from 'vitest';
import { getNextWednesdayExpiry } from './groceryCycle.js';
import {
  ALL_DEAL_STORES,
  getActiveDealStores,
  getActiveDealStoresForRegion,
  getWeeklyCycleBounds,
  getWeeklyCycleIndex,
  getCurrentWeeklyCycleStart,
} from './dealCycle.js';
import { buildDealsForCycle } from './weeklyDeals.js';

describe('dealCycle', () => {
  it('includes all stores every week (no rotation)', () => {
    expect(getActiveDealStores(0)).toEqual([...ALL_DEAL_STORES]);
    expect(getActiveDealStores(1)).toEqual([...ALL_DEAL_STORES]);
    expect(getActiveDealStores(99)).toEqual([...ALL_DEAL_STORES]);
  });

  it('uses one-week bounds between Wednesdays', () => {
    const from = new Date('2024-01-03T12:00:00.000Z');
    const cycle = getWeeklyCycleBounds(from);
    expect(cycle.validFrom.getTime()).toBe(getCurrentWeeklyCycleStart(from).getTime());
    expect(cycle.expiresAt.getTime()).toBe(getNextWednesdayExpiry(cycle.validFrom).getTime());
  });

  it('builds deals for every store in the seed catalogue', () => {
    const cycle = getWeeklyCycleBounds(new Date('2024-01-03T12:00:00.000Z'));
    const docs = buildDealsForCycle(cycle.expiresAt, {
      cycleIndex: cycle.cycleIndex,
      cycleStart: cycle.validFrom.toISOString(),
    });
    const stores = new Set(docs.map((deal) => deal.store));
    expect(stores.has('coles')).toBe(true);
    expect(stores.has('woolworths')).toBe(true);
    expect(stores.has('aldi')).toBe(true);
    expect(stores.has('harrisfarm')).toBe(true);
    expect(stores.has('costco')).toBe(true);
    expect(docs.every((deal) => Array.isArray(deal.regions) && deal.regions.length > 0)).toBe(
      true,
    );
  });

  it('increments cycle index every week', () => {
    expect(getWeeklyCycleIndex(new Date('2024-01-03T12:00:00.000Z'))).toBe(0);
    expect(getWeeklyCycleIndex(new Date('2024-01-10T12:00:00.000Z'))).toBe(1);
    expect(getWeeklyCycleIndex(new Date('2024-01-17T12:00:00.000Z'))).toBe(2);
  });

  it('limits visible stores by catalogue region', () => {
    expect(getActiveDealStoresForRegion(0, 'VIC')).toEqual([
      'coles',
      'woolworths',
      'aldi',
      'costco',
    ]);
    expect(getActiveDealStoresForRegion(0, 'NSW_Metro')).toEqual([...ALL_DEAL_STORES]);
  });
});
