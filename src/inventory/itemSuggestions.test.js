import { describe, expect, it } from 'vitest';
import { DEFAULT_ENABLED_MODULES } from './modules.js';
import {
  filterItemSuggestions,
  hasExactSuggestionMatch,
  shouldRequestAiSuggestion,
} from './itemSuggestions.js';

describe('itemSuggestions with learned knowledge', () => {
  const knowledge = [
    {
      name: 'Kewpie Mayo',
      itemType: 'Food',
      category: 'Ambient',
      subCategory: 'Condiments',
      source: 'ai',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('includes learned household items in suggestions', () => {
    const results = filterItemSuggestions('kewpie', DEFAULT_ENABLED_MODULES, 8, knowledge);
    expect(results.some((entry) => entry.name === 'Kewpie Mayo')).toBe(true);
    expect(results[0]?.source).toBe('learned');
  });

  it('prefers learned items over catalog duplicates when both match', () => {
    const results = filterItemSuggestions('milk', DEFAULT_ENABLED_MODULES, 8, [
      {
        name: 'Oat Milk Barista',
        itemType: 'Food',
        category: 'Ambient',
        subCategory: 'Dairy Alternatives',
        source: 'user',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    expect(results.some((entry) => entry.name === 'Oat Milk Barista')).toBe(true);
  });

  it('requests AI when query is long enough and matches are sparse', () => {
    const results = filterItemSuggestions('tamari', DEFAULT_ENABLED_MODULES, 8, []);
    expect(shouldRequestAiSuggestion('tamari sauce', results)).toBe(true);
    expect(hasExactSuggestionMatch('tamari sauce', results)).toBe(false);
  });

  it('skips AI when there is an exact suggestion match', () => {
    const results = filterItemSuggestions('milk', DEFAULT_ENABLED_MODULES, 8, knowledge);
    expect(hasExactSuggestionMatch('Milk', results)).toBe(true);
    expect(shouldRequestAiSuggestion('Milk', results)).toBe(false);
  });
});
