import { CATALOGUE_TEMPLATES } from './storeCatalogues.js';
import { isManuallyPriceVerified, verifyDealLive } from './dealManualVerification.js';

export { isManuallyPriceVerified, verifyDealLive };

/** @typedef {'seed'|'live'} DealDataSource */
/** @typedef {'confirmed'|'unverified'|'rejected'} DealVerificationStatus */

/**
 * @param {string} store
 */
export function getCatalogueVerifyUrl(store) {
  return CATALOGUE_TEMPLATES[store]?.externalLink ?? null;
}

const VALID_DEAL_STORES = new Set(['coles', 'woolworths', 'aldi', 'harrisfarm', 'costco']);

function normalizeStoreKey(value) {
  const key = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
  const aliases = { harrisfarm: 'harrisfarm', 'harris-farm': 'harrisfarm' };
  const normalized = aliases[key] ?? key;
  return VALID_DEAL_STORES.has(normalized) ? normalized : null;
}

/**
 * @param {Record<string, unknown>} deal
 */
export function validateDealStructure(deal) {
  const name = String(deal.name ?? '').trim();
  if (!name) return { ok: false, reason: 'Missing product name.' };

  const store = normalizeStoreKey(deal.store);
  if (!store) return { ok: false, reason: 'Invalid store.' };

  const dealPrice = Number(deal.dealPrice);
  if (!Number.isFinite(dealPrice) || dealPrice <= 0) {
    return { ok: false, reason: 'Invalid deal price.' };
  }

  const originalPrice = deal.originalPrice == null ? null : Number(deal.originalPrice);
  if (originalPrice != null && (!Number.isFinite(originalPrice) || originalPrice <= 0)) {
    return { ok: false, reason: 'Invalid original price.' };
  }

  if (originalPrice != null && dealPrice >= originalPrice) {
    return { ok: false, reason: 'Deal price must be lower than original price.' };
  }

  const expiresAt = deal.storeExpiresAt ?? deal.expiresAt;
  if (expiresAt) {
    const expiry = new Date(expiresAt);
    if (Number.isNaN(expiry.getTime())) {
      return { ok: false, reason: 'Invalid expiry date.' };
    }
    if (expiry.getTime() < Date.now()) {
      return { ok: false, reason: 'Offer has expired.' };
    }
  }

  return { ok: true };
}

/**
 * Second-pass consistency check (no live retailer feed yet).
 * @param {Record<string, unknown>} deal
 */
export function validateDealConsistency(deal) {
  const structure = validateDealStructure(deal);
  if (!structure.ok) return structure;

  const dealType = String(deal.dealType ?? '').trim();
  const savingsText = String(deal.savingsText ?? '').toLowerCase();
  const originalPrice = deal.originalPrice == null ? null : Number(deal.originalPrice);
  const dealPrice = Number(deal.dealPrice);

  if (dealType === 'Half Price' && originalPrice != null) {
    const ratio = dealPrice / originalPrice;
    if (ratio < 0.45 || ratio > 0.55) {
      return { ok: false, reason: 'Half Price offer failed consistency check.' };
    }
  }

  if (/half\s*price/i.test(savingsText) && originalPrice != null) {
    const ratio = dealPrice / originalPrice;
    if (ratio < 0.45 || ratio > 0.55) {
      return { ok: false, reason: 'Savings text does not match prices.' };
    }
  }

  return { ok: true };
}

/**
 * @param {Record<string, unknown>} deal
 */
export async function verifyDealForDisplay(deal) {
  const consistency = validateDealConsistency(deal);
  if (!consistency.ok) {
    return {
      status: /** @type {DealVerificationStatus} */ ('rejected'),
      priceConfirmed: false,
      showPrice: false,
      reason: consistency.reason,
      checkedAt: new Date().toISOString(),
    };
  }

  const live = await verifyDealLive(deal);
  const priceConfirmed = live.confirmed === true;

  return {
    status: priceConfirmed
      ? /** @type {DealVerificationStatus} */ ('confirmed')
      : /** @type {DealVerificationStatus} */ ('unverified'),
    priceConfirmed,
    showPrice: priceConfirmed,
    verificationMethod: live.method ?? null,
    reason: live.note,
    checkedAt: live.checkedAt,
  };
}

/**
 * @param {string} store
 */
export function getCatalogueVerifyUrlForStore(store) {
  const key = String(store ?? '').trim().toLowerCase();
  return getCatalogueVerifyUrl(key);
}
