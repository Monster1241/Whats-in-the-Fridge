import { classifyItem } from './classifyItem.js';
import { applyItemKnowledgeToIntake } from './itemKnowledge.js';
import { toIsoDateOnly } from './expiryGuess.js';
import { ITEM_TYPE } from './constants.js';

/**
 * Resolve item type/category for add flows using household memory, keyword rules, then AI.
 * @param {{
 *   name: string,
 *   preferredItemType?: string,
 *   itemKnowledge?: import('./itemKnowledge.js').ItemKnowledgeEntry[],
 *   classifyFn?: (name: string, options: { itemType?: string, remember?: boolean }) => Promise<Record<string, unknown>>,
 *   remember?: boolean,
 * }} options
 */
export async function resolveItemClassification({
  name,
  preferredItemType = ITEM_TYPE.FOOD,
  itemKnowledge = [],
  classifyFn,
  remember = true,
}) {
  const trimmed = String(name ?? '').trim();
  const base = {
    itemType: preferredItemType,
    category: null,
    subCategory: null,
    consumptionDurationDays: null,
    expiryDate: null,
    itemKnowledge: null,
    usageInsights: null,
    source: 'default',
  };

  if (!trimmed) return base;

  const remembered = applyItemKnowledgeToIntake(itemKnowledge, {
    name: trimmed,
    itemType: preferredItemType,
  });
  if (remembered) {
    return {
      ...base,
      itemType: remembered.itemType,
      category: remembered.category,
      subCategory: remembered.subCategory,
      consumptionDurationDays: remembered.consumptionDurationDays ?? null,
      source: 'memory',
    };
  }

  const rules = classifyItem(trimmed);
  if (rules) {
    return {
      ...base,
      itemType: rules.itemType ?? preferredItemType,
      category: rules.category,
      subCategory: rules.subCategory,
      source: 'rules',
    };
  }

  if (!classifyFn) return base;

  try {
    const ai = await classifyFn(trimmed, { itemType: preferredItemType, remember });
    let expiryDate = null;
    if (ai.expiryDays && (ai.itemType ?? preferredItemType) === ITEM_TYPE.FOOD) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + Number(ai.expiryDays));
      expiryDate = toIsoDateOnly(expiry);
    }
    return {
      itemType: ai.itemType ?? preferredItemType,
      category: ai.category ?? base.category,
      subCategory: ai.subCategory ?? base.subCategory,
      consumptionDurationDays: ai.consumptionDurationDays ?? null,
      expiryDate,
      itemKnowledge: Array.isArray(ai.itemKnowledge) ? ai.itemKnowledge : null,
      usageInsights: ai.usageInsights ?? null,
      source: ai.source === 'rules' ? 'rules' : 'ai',
    };
  } catch {
    return base;
  }
}
