import { describe, expect, it } from 'vitest';
import {
  formatInventoryQuantityLabel,
  normalizeAmbientQuantityFields,
  parsePackSizeFromName,
} from './quantityDisplay.js';

describe('parsePackSizeFromName', () => {
  it('reads the last mass/volume in the name', () => {
    expect(parsePackSizeFromName('Tomato paste (400g)')).toEqual({ amount: 400, unit: 'g' });
    expect(parsePackSizeFromName('Coconut milk 400ml')).toEqual({ amount: 400, unit: 'ml' });
  });
});

describe('formatInventoryQuantityLabel', () => {
  it('shows ambient pantry totals in g/ml, not can counts', () => {
    expect(
      formatInventoryQuantityLabel({
        name: 'Tomato paste (400g)',
        itemType: 'Food',
        category: 'Ambient',
        quantity: 2,
        unit: 'cans',
      }),
    ).toBe('800g total');
  });

  it('uses stored grams when unit is already mass', () => {
    expect(
      formatInventoryQuantityLabel({
        name: 'Flour',
        itemType: 'Food',
        category: 'Ambient',
        quantity: 800,
        unit: 'g',
      }),
    ).toBe('800g total');
  });

  it('does not force totals for fresh items', () => {
    expect(
      formatInventoryQuantityLabel({
        name: 'Milk',
        itemType: 'Food',
        category: 'Fresh',
        quantity: 2,
        unit: 'L',
      }),
    ).toBe('2 L');
  });
});

describe('normalizeAmbientQuantityFields', () => {
  it('converts pack counts to total base units', () => {
    expect(
      normalizeAmbientQuantityFields({
        name: 'Tomato paste (400g)',
        itemType: 'Food',
        category: 'Ambient',
        quantity: 2,
        unit: '',
      }),
    ).toEqual({ quantity: 800, unit: 'g' });
  });

  it('converts kg to grams', () => {
    expect(
      normalizeAmbientQuantityFields({
        name: 'Rice',
        itemType: 'Food',
        category: 'Ambient',
        quantity: 1.5,
        unit: 'kg',
      }),
    ).toEqual({ quantity: 1500, unit: 'g' });
  });
});
