/** Privacy-safe counters — no item names, emails, or receipt contents. */

export const USAGE_INSIGHT_EVENTS = [
  'itemAdded',
  'itemAiClassified',
  'itemUserCorrected',
  'receiptScanConfirmed',
  'aiRecipeGenerated',
  'scoutChatMessage',
  'predictedLowRestock',
  'barcodeUnknown',
];

/** @typedef {typeof USAGE_INSIGHT_EVENTS[number]} UsageInsightEvent */

/**
 * @returns {Record<UsageInsightEvent, number> & { lastEventAt: string|null }}
 */
export function createEmptyUsageInsights() {
  return {
    itemAdded: 0,
    itemAiClassified: 0,
    itemUserCorrected: 0,
    receiptScanConfirmed: 0,
    aiRecipeGenerated: 0,
    scoutChatMessage: 0,
    predictedLowRestock: 0,
    barcodeUnknown: 0,
    lastEventAt: null,
  };
}

/**
 * @param {Record<string, unknown>|null|undefined} raw
 */
export function normalizeUsageInsights(raw) {
  const base = createEmptyUsageInsights();
  if (!raw || typeof raw !== 'object') return base;

  for (const key of USAGE_INSIGHT_EVENTS) {
    const value = Number(raw[key]);
    if (Number.isFinite(value) && value >= 0) {
      base[key] = Math.min(Math.round(value), 999999);
    }
  }

  base.lastEventAt =
    typeof raw.lastEventAt === 'string' && raw.lastEventAt ? raw.lastEventAt : null;
  return base;
}

/**
 * @param {Record<string, unknown>|null|undefined} insights
 * @param {UsageInsightEvent} event
 * @param {number} [amount]
 */
export function recordUsageInsightEvent(insights, event, amount = 1) {
  if (!USAGE_INSIGHT_EVENTS.includes(event)) return normalizeUsageInsights(insights);

  const next = normalizeUsageInsights(insights);
  next[event] = Math.min(999999, next[event] + Math.max(1, Math.round(amount)));
  next.lastEventAt = new Date().toISOString();
  return next;
}
