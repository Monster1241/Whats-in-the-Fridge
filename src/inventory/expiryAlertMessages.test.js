import { describe, expect, it } from 'vitest';
import {
  buildCombinedExpiryAlertMessage,
  buildExpiredAlertMessage,
  buildExpiringSoonAlertMessage,
} from './expiryAlertMessages.js';

describe('expiryAlertMessages', () => {
  it('builds expiring soon copy without item names', () => {
    const one = buildExpiringSoonAlertMessage(1);
    expect(one?.body).toBe('You have 1 item expiring soon in your fridge!');
    expect(one?.body).not.toMatch(/milk|bread/i);

    const many = buildExpiringSoonAlertMessage(3);
    expect(many?.title).toBe('3 items expiring soon');
  });

  it('builds expired copy without item names', () => {
    const one = buildExpiredAlertMessage(1);
    expect(one?.title).toBe('Food expired');
    expect(one?.body).toBe('You have 1 expired item in your fridge!');

    const many = buildExpiredAlertMessage(2);
    expect(many?.title).toBe('2 items expired');
  });

  it('combines expiring soon and expired counts', () => {
    expect(buildCombinedExpiryAlertMessage(0, 0)).toBeNull();
    expect(buildCombinedExpiryAlertMessage(2, 0)?.title).toBe('2 items expiring soon');
    expect(buildCombinedExpiryAlertMessage(0, 1)?.title).toBe('Food expired');
    expect(buildCombinedExpiryAlertMessage(1, 1)?.body).toMatch(/expiring soon and 1 expired/);
  });
});
