import { isItemTypeEnabled } from './modules.js';
import { PRODUCT_CATALOG } from './productCatalog.js';
import { resolveSubCategory } from './subcategories.js';
import { normalizeName } from './itemUtils.js';

/** @typedef {{ name: string, itemType: 'Food'|'Household'|'Baby', category: string, subCategory?: string, aliases?: string[], source?: 'catalog'|'learned'|'ai' }} ItemSuggestion */

export const ITEM_SUGGESTIONS = PRODUCT_CATALOG;

export function enrichSuggestion(entry) {
  return {
    ...entry,
    subCategory:
      entry.subCategory ?? resolveSubCategory(entry.name, entry.itemType, entry.category),
  };
}

export function normalizeSearchText(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/yoghurt/g, 'yogurt')
    .replace(/[^a-z0-9]+/g, ' ');
}

function textMatchesNeedle(text, needle) {
  const normalized = normalizeSearchText(text);
  if (!normalized || !needle) return false;
  if (normalized.includes(needle)) return true;
  return normalized.split(/\s+/).some(
    (word) => word.startsWith(needle) || needle.startsWith(word),
  );
}

function suggestionMatchesQuery(entry, needle) {
  const haystacks = [entry.name, ...(entry.aliases ?? [])];
  if (haystacks.some((text) => textMatchesNeedle(text, needle))) return true;

  const words = needle.split(/\s+/).filter((w) => w.length > 0);
  if (words.length > 1) {
    return haystacks.some((text) => {
      const normalized = normalizeSearchText(text);
      return words.every((word) => normalized.includes(word));
    });
  }

  return false;
}

function suggestionRank(entry, needle) {
  const sourceRank = entry.source === 'learned' ? 0 : entry.source === 'ai' ? 1 : 2;
  const name = normalizeSearchText(entry.name);
  const aliasHit = (entry.aliases ?? []).some((alias) =>
    normalizeSearchText(alias).startsWith(needle),
  );
  const nameStarts = name.startsWith(needle) ? 0 : 1;
  const nameWord = name.split(/\s+/).some((w) => w.startsWith(needle)) ? 0 : 1;
  const aliasStarts = aliasHit ? 0 : 1;
  return [sourceRank, nameStarts, nameWord, aliasStarts, name.length];
}

function suggestionKey(entry) {
  return `${normalizeName(entry.name)}|${entry.itemType}`;
}

/**
 * @param {import('./itemKnowledge.js').ItemKnowledgeEntry[]|null|undefined} itemKnowledge
 */
export function knowledgeToSuggestions(itemKnowledge, enabledModules) {
  if (!Array.isArray(itemKnowledge) || itemKnowledge.length === 0) return [];

  return itemKnowledge
    .filter((entry) => isItemTypeEnabled(enabledModules, entry.itemType))
    .map((entry) =>
      enrichSuggestion({
        name: entry.name,
        itemType: entry.itemType,
        category: entry.category,
        subCategory: entry.subCategory,
        source: 'learned',
      }),
    );
}

/**
 * @param {import('./itemKnowledge.js').ItemKnowledgeEntry[]|null|undefined} [itemKnowledge]
 */
export function filterItemSuggestions(query, enabledModules, limit = 8, itemKnowledge) {
  const needle = normalizeSearchText(query);
  if (!needle || needle.length < 1) return [];

  const learned = knowledgeToSuggestions(itemKnowledge, enabledModules);
  const pool = [
    ...learned,
    ...ITEM_SUGGESTIONS.map((entry) => ({ ...entry, source: 'catalog' })),
  ];

  const seen = new Set();
  const ranked = pool
    .filter((entry) => {
      if (!isItemTypeEnabled(enabledModules, entry.itemType)) return false;
      if (!suggestionMatchesQuery(entry, needle)) return false;
      const key = suggestionKey(entry);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const aRank = suggestionRank(a, needle);
      const bRank = suggestionRank(b, needle);
      for (let i = 0; i < aRank.length; i += 1) {
        if (aRank[i] !== bRank[i]) return aRank[i] - bRank[i];
      }
      return a.name.localeCompare(b.name);
    });

  return ranked.slice(0, limit).map(enrichSuggestion);
}

export function hasExactSuggestionMatch(query, suggestions) {
  const needle = normalizeSearchText(query);
  if (!needle) return false;
  return suggestions.some((entry) => normalizeSearchText(entry.name) === needle);
}

export function shouldRequestAiSuggestion(query, suggestions) {
  const needle = normalizeSearchText(query);
  if (needle.length < 3) return false;
  if (hasExactSuggestionMatch(query, suggestions)) return false;
  return suggestions.length < 3;
}
