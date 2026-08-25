import { describe, expect, it } from 'vitest';
import {
  SUPPORT_LIVE_IDLE_MS,
  isSupportLivePollingActive,
  msUntilSupportLiveIdle,
} from './supportChatLive.js';

describe('supportChatLive idle window', () => {
  const openedAt = Date.parse('2026-08-25T02:00:00.000Z');

  it('stays live when user messaged recently', () => {
    const thread = {
      messages: [
        { role: 'user', createdAt: '2026-08-25T02:05:00.000Z' },
      ],
    };
    const now = Date.parse('2026-08-25T02:10:00.000Z');
    expect(isSupportLivePollingActive(thread, openedAt, now)).toBe(true);
  });

  it('stops live 10 minutes after last user message', () => {
    const thread = {
      messages: [
        { role: 'user', createdAt: '2026-08-25T02:00:00.000Z' },
      ],
    };
    const now = openedAt + SUPPORT_LIVE_IDLE_MS + 1000;
    expect(isSupportLivePollingActive(thread, openedAt, now)).toBe(false);
    expect(msUntilSupportLiveIdle(thread, openedAt, now)).toBe(0);
  });

  it('uses openedAt when user has not sent yet', () => {
    const thread = {
      messages: [{ role: 'admin', createdAt: '2026-08-25T02:00:00.000Z' }],
    };
    expect(isSupportLivePollingActive(thread, openedAt, openedAt + 60_000)).toBe(true);
    expect(
      isSupportLivePollingActive(thread, openedAt, openedAt + SUPPORT_LIVE_IDLE_MS + 1),
    ).toBe(false);
  });
});
