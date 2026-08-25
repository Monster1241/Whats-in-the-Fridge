import { describe, expect, it } from 'vitest';
import { supportThreadFingerprint } from './usePolling.js';

describe('supportThreadFingerprint', () => {
  it('changes when messages update', () => {
    const a = supportThreadFingerprint({
      id: '1',
      lastMessageAt: '2026-01-01T00:00:00.000Z',
      messages: [{ id: 'm1' }],
      status: 'waiting_admin',
    });
    const b = supportThreadFingerprint({
      id: '1',
      lastMessageAt: '2026-01-01T00:01:00.000Z',
      messages: [{ id: 'm1' }, { id: 'm2' }],
      status: 'waiting_admin',
    });
    expect(a).not.toBe(b);
  });
});
