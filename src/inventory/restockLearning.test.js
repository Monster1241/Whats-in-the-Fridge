import { describe, expect, it } from 'vitest';
import {
  applyConsumptionLearningFields,
  applyRestockLearningToItem,
  processItemDepletion,
  processItemRestock,
} from './restockLearning.js';

const milk = { name: 'Milk', itemType: 'Food', category: 'Fresh' };

describe('processItemRestock', () => {
  it('increments restock count and applies a consumption duration', () => {
    const first = processItemRestock([], milk);
    expect(first.restockHistory).toHaveLength(1);
    expect(first.restockHistory[0].count).toBe(1);
    expect(first.consumptionDuration).toBeGreaterThan(0);
    expect(first.consumptionLearned).toBe(false);

    const second = processItemRestock(first.restockHistory, milk);
    expect(second.restockHistory[0].count).toBe(2);
  });
});

describe('processItemDepletion', () => {
  it('records a consumption interval when stocked long enough', () => {
    const stockedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const result = processItemDepletion([], { ...milk, stockedAt, status: 'fresh' });
    expect(result.restockHistory[0].intervalsDays).toEqual([8]);
    expect(result.restockHistory[0].learnedDurationDays).toBe(8);
  });

  it('skips intervals shorter than one day', () => {
    const stockedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const result = processItemDepletion([], { ...milk, stockedAt, status: 'fresh' });
    expect(result.restockHistory).toEqual([]);
  });
});

describe('applyConsumptionLearningFields / applyRestockLearningToItem', () => {
  it('stamps stockedAt and duration onto the item', () => {
    const now = '2026-08-12T00:00:00.000Z';
    const stamped = applyConsumptionLearningFields(
      { id: '1', name: 'Milk' },
      { consumptionDuration: 7, consumptionLearned: false, now },
    );
    expect(stamped.consumptionDuration).toBe(7);
    expect(stamped.stockedAt).toBe(now);

    const applied = applyRestockLearningToItem([], { id: '1', name: 'Milk', itemType: 'Food', category: 'Fresh' }, now);
    expect(applied.item.consumptionDuration).toBeGreaterThan(0);
    expect(applied.restockHistory).toHaveLength(1);
  });
});
