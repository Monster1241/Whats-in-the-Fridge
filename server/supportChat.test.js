import { describe, expect, it } from 'vitest';
import { mapSupportThread } from './supportChat.js';

describe('mapSupportThread', () => {
  it('maps thread fields and messages for API responses', () => {
    const mapped = mapSupportThread({
      _id: { toString: () => 'thread1' },
      userId: 'user1',
      userEmail: 'a@example.com',
      householdId: 'hh1',
      status: 'waiting_admin',
      category: 'account',
      severity: 'high',
      unreadForAdmin: 2,
      unreadForUser: 0,
      lastMessageAt: new Date('2026-08-25T02:00:00.000Z'),
      createdAt: new Date('2026-08-25T01:00:00.000Z'),
      updatedAt: new Date('2026-08-25T02:00:00.000Z'),
      messages: [
        {
          id: 'm1',
          role: 'user',
          body: 'I lost my items',
          createdAt: new Date('2026-08-25T02:00:00.000Z'),
        },
      ],
    });

    expect(mapped.id).toBe('thread1');
    expect(mapped.status).toBe('waiting_admin');
    expect(mapped.unreadForAdmin).toBe(2);
    expect(mapped.messages).toHaveLength(1);
    expect(mapped.messages[0].body).toBe('I lost my items');
  });

  it('can omit messages for conversation history lists', () => {
    const mapped = mapSupportThread(
      {
        _id: { toString: () => 'thread1' },
        userId: 'user1',
        status: 'closed',
        lastMessageAt: new Date('2026-08-25T02:00:00.000Z'),
        messages: [{ id: 'm1', role: 'user', body: 'Help please', createdAt: new Date() }],
      },
      { includeMessages: false },
    );

    expect(mapped.messages).toBeUndefined();
    expect(mapped.messageCount).toBe(1);
    expect(mapped.preview).toBe('Help please');
    expect(mapped.status).toBe('closed');
  });
});
