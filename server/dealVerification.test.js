import { describe, expect, it } from 'vitest';
import {
  validateDealConsistency,
  validateDealStructure,
  verifyDealForDisplay,
} from './dealVerification.js';

const baseDeal = {
  name: 'Bananas',
  store: 'coles',
  dealPrice: 2.5,
  originalPrice: 5,
  dealType: 'Half Price',
  savingsText: 'Half Price!',
  category: 'Fresh',
  storeExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  dataSource: 'seed',
};

describe('dealVerification', () => {
  it('rejects inconsistent half-price deals', () => {
    const result = validateDealConsistency({
      ...baseDeal,
      dealPrice: 4,
      originalPrice: 5,
    });
    expect(result.ok).toBe(false);
  });

  it('accepts structurally valid deals', () => {
    expect(validateDealStructure(baseDeal).ok).toBe(true);
  });

  it('shows prices for seed data without admin verification', async () => {
    const result = await verifyDealForDisplay(baseDeal);
    expect(result.priceConfirmed).toBe(false);
    expect(result.showPrice).toBe(true);
    expect(result.status).toBe('unverified');
  });

  it('marks admin-verified deals as confirmed with manual method', async () => {
    const result = await verifyDealForDisplay({
      ...baseDeal,
      priceVerifiedAt: new Date().toISOString(),
      priceVerifiedForCycle: 'coles:weekly:2024-01-03T00:00:00.000Z',
      storeCycleStart: 'coles:weekly:2024-01-03T00:00:00.000Z',
    });
    expect(result.priceConfirmed).toBe(true);
    expect(result.showPrice).toBe(true);
    expect(result.verificationMethod).toBe('manual');
  });

  it('rejects expired offers', () => {
    const result = validateDealStructure({
      ...baseDeal,
      storeExpiresAt: new Date(Date.now() - 86_400_000).toISOString(),
    });
    expect(result.ok).toBe(false);
  });
});
