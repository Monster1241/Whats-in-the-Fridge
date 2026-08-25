import { describe, expect, it } from 'vitest';
import { buildWeeklyDealDoc } from './weeklyDeals.js';
import { mapAdminDealRow } from './adminDealCrud.js';

describe('adminDealCrud', () => {
  it('maps admin deal rows with extended fields', () => {
    const doc = buildWeeklyDealDoc({
      name: 'Test Chips',
      store: 'coles',
      dealPrice: 2.5,
      originalPrice: 5,
      dealType: 'Half Price',
      savingsText: 'Half Price!',
      category: 'Pantry',
    });

    const row = mapAdminDealRow({ _id: { toString: () => 'abc123' }, ...doc });
    expect(row.id).toBe('abc123');
    expect(row.name).toBe('Test Chips');
    expect(row.dealType).toBe('Half Price');
    expect(row.category).toBe('Pantry');
    expect(row.priceVerified).toBe(false);
  });
});
