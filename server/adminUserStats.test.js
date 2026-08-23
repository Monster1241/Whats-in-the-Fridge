import { describe, expect, it } from 'vitest';
import { LIVE_USER_WINDOW_MS, ACTIVE_TODAY_WINDOW_MS } from './adminUserStats.js';

describe('adminUserStats', () => {
  it('defines live and daily activity windows', () => {
    expect(LIVE_USER_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(ACTIVE_TODAY_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });
});
