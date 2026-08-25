import { describe, expect, it } from 'vitest';
import { STATUS } from './constants.js';
import { calculateItemStatus } from './consumption.js';
import { isExpired, isExpiringSoon } from './expiryDisplay.js';

function isoDaysFromToday(offset) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

describe('expired inventory display', () => {
  it('treats past expiry dates as expired, not expiring soon', () => {
    const item = {
      name: 'Milk',
      status: STATUS.FRESH,
      expiryDate: isoDaysFromToday(-2),
    };
    expect(isExpired(item)).toBe(true);
    expect(isExpiringSoon(item)).toBe(false);
    expect(calculateItemStatus(item)).toBe(STATUS.EXPIRED);
  });

  it('keeps today and near-future dates as expiring soon', () => {
    const today = {
      name: 'Yoghurt',
      status: STATUS.FRESH,
      expiryDate: isoDaysFromToday(0),
    };
    const soon = {
      name: 'Bread',
      status: STATUS.FRESH,
      expiryDate: isoDaysFromToday(2),
    };
    expect(isExpired(today)).toBe(false);
    expect(isExpiringSoon(today)).toBe(true);
    expect(calculateItemStatus(today)).toBe(STATUS.EXPIRING);
    expect(isExpiringSoon(soon)).toBe(true);
    expect(calculateItemStatus(soon)).toBe(STATUS.EXPIRING);
  });
});
