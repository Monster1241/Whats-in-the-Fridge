import { describe, expect, it } from 'vitest';
import {
  getActiveStoreDealWindow,
  getStoresDueForDealRefresh,
  isStoreWindowRefreshDue,
  STORE_DEAL_WINDOWS,
} from './dealStoreSchedule.js';
import { getSydneyClock } from './sydneyCronGuard.js';

describe('dealStoreSchedule', () => {
  it('returns an active weekly window for each store mid-week', () => {
    const now = new Date('2024-01-04T12:00:00.000Z');
    for (const store of Object.keys(STORE_DEAL_WINDOWS)) {
      const active = getActiveStoreDealWindow(store, now);
      expect(active).not.toBeNull();
      expect(active.windowId).toBeTruthy();
      expect(active.validFrom.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(active.expiresAt.getTime()).toBeGreaterThan(now.getTime());
    }
  });

  it('flags Coles/Woolworths sneak peek on Mon 18:00 Sydney', () => {
    const clock = { weekday: 'Mon', hour: 18, minute: 2, dateKey: '2024-01-08' };
    const sneak = STORE_DEAL_WINDOWS.coles.find((window) => window.id === 'sneakPeek');
    expect(isStoreWindowRefreshDue('coles', sneak, clock)).toBe(true);
  });

  it('flags ALDI special buys on Sat 00:00 Sydney', () => {
    const clock = { weekday: 'Sat', hour: 0, minute: 5, dateKey: '2024-01-13' };
    const special = STORE_DEAL_WINDOWS.aldi.find((window) => window.id === 'specialBuys');
    expect(isStoreWindowRefreshDue('aldi', special, clock)).toBe(true);
  });

  it('returns only due stores for the current Sydney minute', () => {
    const now = new Date('2024-01-08T07:02:00.000Z');
    const due = getStoresDueForDealRefresh(now);
    const stores = due.map((entry) => entry.store);
    expect(stores).toContain('coles');
    expect(stores).toContain('woolworths');
    expect(getSydneyClock(now).weekday).toBe('Mon');
  });
});
