import { ObjectId } from 'mongodb';
import {
  dedupeFcmTokens,
  removeInvalidFcmTokens,
} from './db.js';
import { sendPushToTokens } from './fcm.js';
import { buildCombinedExpiryAlertMessage } from './pushCopy.js';

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
 * Past the expiry calendar day (local). Shopping-list items are ignored.
 * @param {{ status?: string, expiryDate?: string|null }} item
 */
export function isExpiredInventoryItem(item) {
  if (!item?.expiryDate || item.status === 'out') return false;
  return daysUntilExpiry(item.expiryDate) < 0;
}

/**
 * In-stock food with an expiry date within the alert window (not yet expired).
 * @param {Array<{ status?: string, itemType?: string, expiryDate?: string|null, name?: string, id?: string }>} items
 */
export function findExpiringSoonItems(items, maxDays = EXPIRY_ALERT_DAYS) {
  return (items ?? [])
    .filter((item) => {
      if (!item?.expiryDate || item.status === 'out') return false;
      if (item.itemType && item.itemType !== 'Food') return false;
      if (isExpiredInventoryItem(item)) return false;
      const days = daysUntilExpiry(item.expiryDate);
      return days >= 0 && days <= maxDays;
    })
    .sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));
}

/**
 * In-stock food past its expiry date.
 * @param {Array<{ status?: string, itemType?: string, expiryDate?: string|null, name?: string, id?: string }>} items
 */
export function findExpiredItems(items) {
  return (items ?? [])
    .filter((item) => {
      if (!item?.expiryDate || item.status === 'out') return false;
      if (item.itemType && item.itemType !== 'Food') return false;
      return isExpiredInventoryItem(item);
    })
    .sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));
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
 * Daily cron: notify households about food expiring soon or already expired.
 * Each item+expiry pair is alerted at most once per alert type (tracked on the household doc).
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
  let expiringSoonAlerts = 0;
  let expiredAlerts = 0;
  const invalidTokens = [];

  for (const household of householdDocs) {
    householdsChecked += 1;
    const householdId = household._id.toString();
    const items = inventoryByHousehold.get(householdId) ?? [];
    const expiring = findExpiringSoonItems(items);
    const expired = findExpiredItems(items);
    if (expiring.length === 0 && expired.length === 0) continue;

    const soonSentMap =
      household.expiryAlertsSent && typeof household.expiryAlertsSent === 'object'
        ? { ...household.expiryAlertsSent }
        : {};
    const expiredSentMap =
      household.expiredAlertsSent && typeof household.expiredAlertsSent === 'object'
        ? { ...household.expiredAlertsSent }
        : {};

    const pendingSoon = expiring.filter((item) => !soonSentMap[expiryAlertKey(item)]);
    const pendingExpired = expired.filter((item) => !expiredSentMap[expiryAlertKey(item)]);
    if (pendingSoon.length === 0 && pendingExpired.length === 0) continue;

    const tokens = await getHouseholdMemberTokens(db, householdId);
    if (tokens.length === 0) continue;

    const message = buildCombinedExpiryAlertMessage(pendingSoon.length, pendingExpired.length);
    if (!message) continue;

    const alertKind =
      pendingSoon.length > 0 && pendingExpired.length > 0
        ? 'mixed'
        : pendingExpired.length > 0
          ? 'expired'
          : 'expiring_soon';

    const { successCount, invalidTokens: stale } = await sendPushToTokens(tokens, {
      title: message.title,
      body: message.body,
      data: {
        type: 'expiry_alert',
        alertKind,
        url: '/',
      },
    });

    if (successCount === 0) continue;

    const now = new Date().toISOString();
    for (const item of pendingSoon) {
      soonSentMap[expiryAlertKey(item)] = now;
    }
    for (const item of pendingExpired) {
      expiredSentMap[expiryAlertKey(item)] = now;
    }

    await households.updateOne(
      { _id: household._id },
      {
        $set: {
          expiryAlertsSent: soonSentMap,
          expiredAlertsSent: expiredSentMap,
          updated_at: new Date(),
        },
      },
    );

    householdsNotified += 1;
    pushesSent += successCount;
    expiringSoonAlerts += pendingSoon.length;
    expiredAlerts += pendingExpired.length;
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
    expiringSoonAlerts,
    expiredAlerts,
    invalidTokensRemoved: invalidTokens.length,
  };
}
