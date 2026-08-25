import { describe, expect, it } from 'vitest';
import {
  buildCombinedExpiryAlertMessage,
  buildExpiryAlertMessage,
  buildShoppingPingNotification,
  buildSupportReplyNotification,
} from './pushCopy.js';

describe('buildExpiryAlertMessage', () => {
  it('omits item names and uses count-only copy', () => {
    const one = buildExpiryAlertMessage(1);
    expect(one.body).not.toMatch(/milk|bread|tomato/i);
    expect(one.body).toBe('You have 1 item expiring soon in your fridge!');

    const many = buildExpiryAlertMessage(3);
    expect(many.title).toBe('3 items expiring soon');
    expect(many.body).toBe('You have 3 items expiring soon in your fridge!');
    expect(many.body).not.toMatch(/milk|bread/i);
  });

  it('returns null for empty counts', () => {
    expect(buildExpiryAlertMessage(0)).toBeNull();
  });
});

describe('buildCombinedExpiryAlertMessage', () => {
  it('covers expired-only alerts', () => {
    const msg = buildCombinedExpiryAlertMessage(0, 2);
    expect(msg?.title).toBe('2 items expired');
  });
});

describe('buildShoppingPingNotification', () => {
  it('uses a count instead of item names', () => {
    const msg = buildShoppingPingNotification('partner@example.com', 2);
    expect(msg.body).toContain('Partner');
    expect(msg.body).toContain('2 items');
    expect(msg.body).not.toMatch(/milk|eggs/i);
  });
});

describe('buildSupportReplyNotification', () => {
  it('uses a short preview of the admin message', () => {
    const msg = buildSupportReplyNotification('  Thanks — we restored your household.  ');
    expect(msg.title).toBe('Support replied');
    expect(msg.body).toBe('Thanks — we restored your household.');
  });

  it('falls back when body is empty', () => {
    const msg = buildSupportReplyNotification('');
    expect(msg.body).toMatch(/Support chat/i);
  });
});
