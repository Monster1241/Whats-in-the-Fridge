import { dedupeFcmTokens, removeInvalidFcmTokens } from './db.js';
import { sendPushToTokens } from './fcm.js';
import { buildFeedbackNudgeNotification } from './pushCopy.js';
import { USER_FEEDBACK_COLLECTION } from './supportInbox.js';

export const FEEDBACK_NUDGE_DAYS = 7;

/**
 * @param {{ created_at?: Date, feedbackNudgeSentAt?: Date, fcmTokens?: unknown[], isVerified?: boolean }} user
 * @param {Date} [now]
 */
export function isEligibleForFeedbackNudge(user, now = new Date()) {
  if (!user) return false;
  if (user.feedbackNudgeSentAt) return false;
  if (user.isVerified === false) return false;
  const tokens = dedupeFcmTokens(user.fcmTokens);
  if (tokens.length === 0) return false;
  const created = user.created_at instanceof Date ? user.created_at : new Date(user.created_at ?? 0);
  if (Number.isNaN(created.getTime())) return false;
  const ageMs = now.getTime() - created.getTime();
  return ageMs >= FEEDBACK_NUDGE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * One-time push after ~1 week of account age. Never repeats.
 * @param {import('mongodb').Db} db
 * @param {Date} [now]
 */
export async function runFeedbackNudges(db, now = new Date()) {
  const cutoff = new Date(now.getTime() - FEEDBACK_NUDGE_DAYS * 24 * 60 * 60 * 1000);
  const users = db.collection('users');
  const candidates = await users
    .find({
      created_at: { $lte: cutoff },
      feedbackNudgeSentAt: { $exists: false },
      isVerified: { $ne: false },
      fcmTokens: { $exists: true, $not: { $size: 0 } },
    })
    .project({ fcmTokens: 1, created_at: 1, isVerified: 1 })
    .limit(200)
    .toArray();

  let checked = 0;
  let sent = 0;
  let skipped = 0;

  for (const user of candidates) {
    checked += 1;
    if (!isEligibleForFeedbackNudge(user, now)) {
      skipped += 1;
      continue;
    }

    const alreadyGaveFeedback = await db.collection(USER_FEEDBACK_COLLECTION).findOne(
      { userId: user._id.toString() },
      { projection: { _id: 1 } },
    );
    if (alreadyGaveFeedback) {
      await users.updateOne(
        { _id: user._id },
        { $set: { feedbackNudgeSentAt: now, feedbackNudgeSkipped: 'already_submitted' } },
      );
      skipped += 1;
      continue;
    }

    const claimed = await users.findOneAndUpdate(
      { _id: user._id, feedbackNudgeSentAt: { $exists: false } },
      { $set: { feedbackNudgeSentAt: now } },
      { returnDocument: 'after' },
    );
    if (!claimed) {
      skipped += 1;
      continue;
    }

    const tokens = dedupeFcmTokens(user.fcmTokens);
    const { title, body } = buildFeedbackNudgeNotification();
    try {
      const { successCount, invalidTokens } = await sendPushToTokens(tokens, {
        title,
        body,
        data: {
          type: 'feedback_nudge',
          url: '/#feedback',
        },
      });
      if (invalidTokens.length > 0) {
        await removeInvalidFcmTokens(invalidTokens).catch(() => {});
      }
      if (successCount > 0) sent += 1;
    } catch (err) {
      console.error('feedback nudge push failed', user._id.toString(), err?.message || err);
    }
  }

  return { checked, sent, skipped };
}
