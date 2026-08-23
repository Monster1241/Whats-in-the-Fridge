import { describe, expect, it } from 'vitest';
import { REPORT_TYPES, FEEDBACK_CATEGORIES, INBOX_STATUSES } from './supportInbox.js';

describe('supportInbox constants', () => {
  it('defines report and feedback enums', () => {
    expect(REPORT_TYPES).toContain('deal_wrong_price');
    expect(FEEDBACK_CATEGORIES).toContain('idea');
    expect(INBOX_STATUSES).toEqual(['open', 'in_progress', 'resolved']);
  });
});
