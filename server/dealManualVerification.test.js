import { describe, expect, it } from 'vitest';
import { isManuallyPriceVerified } from './dealManualVerification.js';

describe('dealManualVerification', () => {
  const base = {
    name: 'Bananas',
    store: 'coles',
    dealPrice: 2.5,
    storeCycleStart: 'coles:weekly:2024-01-03T00:00:00.000Z',
    storeExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  };

  it('accepts matching manual verification for the current store cycle', () => {
    expect(
      isManuallyPriceVerified({
        ...base,
        priceVerifiedAt: new Date().toISOString(),
        priceVerifiedForCycle: base.storeCycleStart,
      }),
    ).toBe(true);
  });

  it('rejects verification from a previous store cycle', () => {
    expect(
      isManuallyPriceVerified({
        ...base,
        priceVerifiedAt: new Date().toISOString(),
        priceVerifiedForCycle: 'coles:weekly:2023-12-27T00:00:00.000Z',
      }),
    ).toBe(false);
  });
});
