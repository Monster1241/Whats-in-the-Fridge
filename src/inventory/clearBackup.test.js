import { describe, expect, it } from 'vitest';
import {
  daysUntilInventoryClearBackupExpires,
  formatClearBackupSubtitle,
  isInventoryClearBackupActive,
  toInventoryClearBackupSummary,
} from './clearBackup.js';

const NOW = new Date('2026-08-25T12:00:00.000Z').getTime();

describe('inventory clear backup helpers', () => {
  it('detects active backup before expiry', () => {
    const backup = {
      clearedAt: '2026-08-20T12:00:00.000Z',
      expiresAt: '2026-08-27T12:00:00.000Z',
      itemCount: 3,
    };
    expect(isInventoryClearBackupActive(backup, NOW)).toBe(true);
    expect(toInventoryClearBackupSummary(backup, NOW)).toEqual({
      clearedAt: backup.clearedAt,
      expiresAt: backup.expiresAt,
      itemCount: 3,
    });
  });

  it('treats expired backup as inactive', () => {
    const backup = {
      clearedAt: '2026-08-10T12:00:00.000Z',
      expiresAt: '2026-08-17T12:00:00.000Z',
      itemCount: 5,
    };
    expect(isInventoryClearBackupActive(backup, NOW)).toBe(false);
    expect(toInventoryClearBackupSummary(backup, NOW)).toBeNull();
  });

  it('formats days remaining for settings subtitle', () => {
    const backup = {
      expiresAt: '2026-08-27T12:00:00.000Z',
      itemCount: 1,
    };
    expect(daysUntilInventoryClearBackupExpires(backup, NOW)).toBe(2);
    expect(formatClearBackupSubtitle(backup, NOW)).toBe('Restore 1 item · 2 days left');
  });
});
