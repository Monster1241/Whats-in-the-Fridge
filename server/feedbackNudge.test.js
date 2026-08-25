import { describe, expect, it } from 'vitest';
import { FEEDBACK_NUDGE_DAYS, isEligibleForFeedbackNudge } from './feedbackNudge.js';

describe('isEligibleForFeedbackNudge', () => {
  const now = new Date('2026-08-25T12:00:00.000Z');

  it('allows a verified user with tokens after 7 days', () => {
    const created = new Date(now.getTime() - FEEDBACK_NUDGE_DAYS * 24 * 60 * 60 * 1000);
    expect(
      isEligibleForFeedbackNudge(
        {
          created_at: created,
          isVerified: true,
          fcmTokens: ['token-a'],
        },
        now,
      ),
    ).toBe(true);
  });

  it('skips users who already got the nudge', () => {
    expect(
      isEligibleForFeedbackNudge(
        {
          created_at: new Date('2026-01-01T00:00:00.000Z'),
          isVerified: true,
          fcmTokens: ['token-a'],
          feedbackNudgeSentAt: now,
        },
        now,
      ),
    ).toBe(false);
  });

  it('skips accounts younger than a week', () => {
    expect(
      isEligibleForFeedbackNudge(
        {
          created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          isVerified: true,
          fcmTokens: ['token-a'],
        },
        now,
      ),
    ).toBe(false);
  });
});
