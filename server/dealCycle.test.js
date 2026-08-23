import { describe, expect, it } from 'vitest';
import {
  getActiveDealStores,
  getBiweeklyCycleBounds,
  getBiweeklyCycleIndex,
  getCurrentBiweeklyCycleStart,
  shouldRefreshDealsThisWeek,
} from './dealCycle.js';
import { buildDealsForCycle } from './weeklyDeals.js';

describe('dealCycle', () => {
  it('alternates active stores every bi-weekly cycle', () => {
    const evenStores = getActiveDealStores(0);
    const oddStores = getActiveDealStores(1);
    expect(evenStores).toEqual(['coles', 'woolworths', 'aldi']);
    expect(oddStores).toEqual(['harrisfarm', 'costco', 'woolworths']);
    expect(evenStores).not.toEqual(oddStores);
  });

  it('marks refresh weeks on bi-weekly Wednesday boundaries', () => {
    const refreshWednesday = getCurrentBiweeklyCycleStart(new Date('2024-01-17T12:00:00.000Z'));
    expect(shouldRefreshDealsThisWeek(refreshWednesday)).toBe(true);

    const midCycleWednesday = new Date(refreshWednesday);
    midCycleWednesday.setUTCDate(midCycleWednesday.getUTCDate() + 7);
    expect(shouldRefreshDealsThisWeek(midCycleWednesday)).toBe(false);
  });

  it('builds deals only for the active store rotation', () => {
    const cycle = getBiweeklyCycleBounds(new Date('2024-01-03T12:00:00.000Z'));
    const evenDocs = buildDealsForCycle(cycle.expiresAt, {
      cycleIndex: cycle.cycleIndex,
      cycleStart: cycle.validFrom.toISOString(),
    });
    expect(evenDocs.every((deal) => ['coles', 'woolworths', 'aldi'].includes(deal.store))).toBe(
      true,
    );

    const oddCycle = getBiweeklyCycleBounds(new Date('2024-01-17T12:00:00.000Z'));
    const oddDocs = buildDealsForCycle(oddCycle.expiresAt, {
      cycleIndex: oddCycle.cycleIndex,
      cycleStart: oddCycle.validFrom.toISOString(),
    });
    expect(
      oddDocs.every((deal) => ['harrisfarm', 'costco', 'woolworths'].includes(deal.store)),
    ).toBe(true);
  });

  it('increments cycle index every two weeks', () => {
    expect(getBiweeklyCycleIndex(new Date('2024-01-03T12:00:00.000Z'))).toBe(0);
    expect(getBiweeklyCycleIndex(new Date('2024-01-10T12:00:00.000Z'))).toBe(0);
    expect(getBiweeklyCycleIndex(new Date('2024-01-17T12:00:00.000Z'))).toBe(1);
  });
});
