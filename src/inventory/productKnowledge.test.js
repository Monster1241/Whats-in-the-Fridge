import { describe, expect, it } from 'vitest';
import { classifyItem } from './classifyItem.js';
import { FOOD_CATEGORY, HOUSEHOLD_CATEGORY, ITEM_TYPE } from './constants.js';
import { filterItemSuggestions } from './itemSuggestions.js';
import { DEFAULT_ENABLED_MODULES } from './modules.js';
import { resolveSubCategory } from './subcategories.js';

const ALL_MODULES = DEFAULT_ENABLED_MODULES;

describe('step 2 — product catalogue expansion', () => {
  it('suggests beef cuts from shorthand', () => {
    const hits = filterItemSuggestions('brisket', ALL_MODULES, 5);
    expect(hits.some((h) => /brisket/i.test(h.name))).toBe(true);
  });

  it('suggests berries and classifies as fresh', () => {
    const hits = filterItemSuggestions('blueberry', ALL_MODULES, 8);
    expect(hits.some((h) => /blueberr/i.test(h.name))).toBe(true);

    const classified = classifyItem('Strawberry');
    expect(classified?.itemType).toBe(ITEM_TYPE.FOOD);
    expect(classified?.category).toBe(FOOD_CATEGORY.FRESH);
  });

  it('classifies toilet cleaner as cleaning, not food', () => {
    const classified = classifyItem('Toilet Bowl Cleaner');
    expect(classified?.itemType).toBe(ITEM_TYPE.HOUSEHOLD);
    expect(classified?.category).toBe(HOUSEHOLD_CATEGORY.CLEANING);
  });

  it('classifies celery as fresh produce', () => {
    const classified = classifyItem('Celery');
    expect(classified?.category).toBe(FOOD_CATEGORY.FRESH);
  });
});

describe('step 3 — sanitary product knowledge', () => {
  it('suggests pads and liners from shorthand', () => {
    const pads = filterItemSuggestions('pads', ALL_MODULES, 8);
    expect(pads.some((h) => /sanitary pad/i.test(h.name))).toBe(true);

    const liners = filterItemSuggestions('liners', ALL_MODULES, 8);
    expect(liners.some((h) => /panty liner/i.test(h.name))).toBe(true);
  });

  it('classifies tampons and menstrual cup as bathroom household', () => {
    expect(classifyItem('Tampons')?.category).toBe(HOUSEHOLD_CATEGORY.BATHROOM);
    expect(classifyItem('Menstrual Cup')?.itemType).toBe(ITEM_TYPE.HOUSEHOLD);
  });

  it('assigns feminine hygiene subcategory', () => {
    expect(
      resolveSubCategory('Sanitary Pads', ITEM_TYPE.HOUSEHOLD, HOUSEHOLD_CATEGORY.BATHROOM),
    ).toBe('Feminine Hygiene');
    expect(
      resolveSubCategory('Panty Liners', ITEM_TYPE.HOUSEHOLD, HOUSEHOLD_CATEGORY.BATHROOM),
    ).toBe('Feminine Hygiene');
  });

  it('does not classify pad thai as bathroom', () => {
    const classified = classifyItem('Pad Thai');
    expect(classified?.category).not.toBe(HOUSEHOLD_CATEGORY.BATHROOM);
  });
});
