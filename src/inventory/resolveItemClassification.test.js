import { describe, expect, it, vi } from 'vitest';
import { resolveItemClassification } from './resolveItemClassification.js';
import { ITEM_TYPE, FOOD_CATEGORY } from './constants.js';

describe('resolveItemClassification', () => {
  it('uses household memory before AI', async () => {
    const classifyFn = vi.fn();
    const result = await resolveItemClassification({
      name: 'Kewpie Mayo',
      preferredItemType: ITEM_TYPE.FOOD,
      itemKnowledge: [
        {
          name: 'Kewpie Mayo',
          itemType: ITEM_TYPE.FOOD,
          category: FOOD_CATEGORY.AMBIENT,
          subCategory: 'Condiments',
          source: 'ai',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      classifyFn,
    });

    expect(result.source).toBe('memory');
    expect(result.category).toBe(FOOD_CATEGORY.AMBIENT);
    expect(classifyFn).not.toHaveBeenCalled();
  });

  it('falls back to AI when nothing else matches', async () => {
    const classifyFn = vi.fn().mockResolvedValue({
      itemType: ITEM_TYPE.FOOD,
      category: FOOD_CATEGORY.AMBIENT,
      subCategory: 'Pantry Staples',
      consumptionDurationDays: 30,
      itemKnowledge: [{ name: 'Organic Tamari', itemType: ITEM_TYPE.FOOD }],
    });

    const result = await resolveItemClassification({
      name: 'Organic Tamari',
      preferredItemType: ITEM_TYPE.FOOD,
      itemKnowledge: [],
      classifyFn,
      remember: true,
    });

    expect(result.source).toBe('ai');
    expect(result.subCategory).toBe('Pantry Staples');
    expect(classifyFn).toHaveBeenCalledWith('Organic Tamari', {
      itemType: ITEM_TYPE.FOOD,
      remember: true,
    });
  });
});
