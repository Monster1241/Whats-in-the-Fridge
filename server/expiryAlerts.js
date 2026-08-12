import { ObjectId } from 'mongodb';
import {
  dedupeFcmTokens,
  removeInvalidFcmTokens,
} from './db.js';
import { sendPushToTokens } from './fcm.js';

/** Match client EXPIRING_SOON_DAYS (food). */
export const EXPIRY_ALERT_DAYS = 3;

function daysUntilExpiry(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${iso}T12:00:00`);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function expiryAlertKey(item) {
  const id = String(item?.id ?? '').trim() || String(item?.name ?? '').trim().toLowerCase();
  const expiry = String(item?.expiryDate ?? '').trim();
  return `${id}|${expiry}`;
}

/**
 * In-stock food with an expiry date within the alert window.
 * @param {Array<{ status?: string, itemType?: string, expiryDate?: string|null, name?: string, id?: string }>} items
 */
export function findExpiringSoonItems(items, maxDays = EXPIRY_ALERT_DAYS) {
  return (items ?? [])
    .filter((item) => {
      if (!item?.expiryDate || item.status === 'out') return false;
      if (item.itemType && item.itemType !== 'Food') return false;
      const days = daysUntilExpiry(item.expiryDate);
      return days >= 0 && days <= maxDays;
    })
    .sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));
}

function formatExpiryLabel(iso) {
  const days = daysUntilExpiry(iso);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

export function buildExpiryAlertMessage(items) {
  if (!items.length) return null;

  const parts = items.slice(0, 4).map((item) => {
    const name = String(item.name || 'Item').trim();
    return `${name} (${formatExpiryLabel(item.expiryDate)})`;
  });

  const extra = items.length > 4 ? ` +${items.length - 4} more` : '';
  const body = parts.join(', ') + extra;

  return {
    title: items.length === 1 ? '⏰ Food expiring soon' : `⏰ ${items.length} items expiring soon`,
    body,
  };
}

/**
 * @param {import('mongodb').Db} db
 */
async function getHouseholdMemberTokens(db, householdId) {
  const users = db.collection('users');
  const docs = await users
    .find({
      household_id: new ObjectId(householdId),
      fcmTokens: { $exists: true, $not: { $size: 0 } },
    })
    .project({ fcmTokens: 1 })
    .toArray();

  const collected = [];
  for (const doc of docs) {
    for (const token of doc.fcmTokens ?? []) {
      collected.push(token);
    }
  }
  return dedupeFcmTokens(collected);
}

/**
 * Load all inventory once and group by household (avoids N+1 per household).
 * @param {import('mongodb').Db} db
 * @returns {Promise<Map<string, Array<Record<string, unknown>>>>}
 */
async function loadInventoryByHousehold(db) {
  const docs = await db.collection('inventory').find({}).toArray();
  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const byHousehold = new Map();
  for (const doc of docs) {
    const householdId = String(doc.household_id ?? '');
    if (!householdId) continue;
    const { _id, household_id, updated_at, ...rest } = doc;
    const item = {
      ...rest,
      id: rest.id || _id.toString(),
    };
    const list = byHousehold.get(householdId);
    if (list) list.push(item);
    else byHousehold.set(householdId, [item]);
  }
  return byHousehold;
}

/**
 * Daily cron: notify households about food expiring within EXPIRY_ALERT_DAYS.
 * Each item+expiry pair is alerted at most once (tracked on the household doc).
 *
 * @param {import('mongodb').Db} db
 */
export async function runExpiryAlerts(db) {
  const households = db.collection('households');
  const [householdDocs, inventoryByHousehold] = await Promise.all([
    households.find({}).toArray(),
    loadInventoryByHousehold(db),
  ]);

  let householdsChecked = 0;
  let householdsNotified = 0;
  let pushesSent = 0;
  const invalidTokens = [];

  for (const household of householdDocs) {
    householdsChecked += 1;
    const householdId = household._id.toString();
    const items = inventoryByHousehold.get(householdId) ?? [];
    const expiring = findExpiringSoonItems(items);
    if (expiring.length === 0) continue;

    const sentMap =
      household.expiryAlertsSent && typeof household.expiryAlertsSent === 'object'
        ? { ...household.expiryAlertsSent }
        : {};

    const pending = expiring.filter((item) => !sentMap[expiryAlertKey(item)]);
    if (pending.length === 0) continue;

    const tokens = await getHouseholdMemberTokens(db, householdId);
    if (tokens.length === 0) continue;

    const message = buildExpiryAlertMessage(pending);
    if (!message) continue;

    const { successCount, invalidTokens: stale } = await sendPushToTokens(tokens, {
      title: message.title,
      body: message.body,
      data: {
        type: 'expiry_alert',
        url: '/',
      },
    });

    if (successCount === 0) continue;

    const now = new Date().toISOString();
    for (const item of pending) {
      sentMap[expiryAlertKey(item)] = now;
    }

    await households.updateOne(
      { _id: household._id },
      { $set: { expiryAlertsSent: sentMap, updated_at: new Date() } },
    );

    householdsNotified += 1;
    pushesSent += successCount;
    invalidTokens.push(...stale);
  }

  if (invalidTokens.length > 0) {
    await removeInvalidFcmTokens(invalidTokens);
  }

  return {
    ok: true,
    householdsChecked,
    householdsNotified,
    pushesSent,
    invalidTokensRemoved: invalidTokens.length,
  };
}
