import { describe, expect, it } from 'vitest';
import { ObjectId } from 'mongodb';
import {
  computeHouseholdPurgeAt,
  HOUSEHOLD_SOFT_DELETE_DAYS,
  mapAdminHousehold,
} from './adminHouseholdRecovery.js';

describe('adminHouseholdRecovery', () => {
  it('computes purge date HOUSEHOLD_SOFT_DELETE_DAYS ahead', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const purge = computeHouseholdPurgeAt(now);
    expect(purge.getTime() - now.getTime()).toBe(
      HOUSEHOLD_SOFT_DELETE_DAYS * 24 * 60 * 60 * 1000,
    );
  });

  it('maps soft-deleted household without requiring live members', async () => {
    const id = new ObjectId();
    const ownerId = new ObjectId();
    const former = new ObjectId();
    const leftAt = new Date('2026-02-01T12:00:00.000Z');

    // Avoid DB calls for inventory/members by stubbing via softDeleted path:
    // mapAdminHousehold still counts inventory — stub global mongo lightly.
    const original = globalThis._mongo;
    globalThis._mongo = {
      db: {
        collection(name) {
          if (name === 'inventory') {
            return { countDocuments: async () => 7 };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      },
    };

    try {
      const mapped = await mapAdminHousehold({
        _id: id,
        invite_code: 'AB12CD',
        owner_id: ownerId,
        created_at: new Date('2025-01-01T00:00:00.000Z'),
        updated_at: leftAt,
        deletedAt: leftAt,
        purgeAt: computeHouseholdPurgeAt(leftAt),
        lastLeftByEmail: 'left@example.com',
        lastLeftByUserId: former.toString(),
        formerMemberIds: [former],
        membershipHistory: [
          {
            userId: former.toString(),
            email: 'left@example.com',
            leftAt,
            wasOwner: true,
            event: 'left',
          },
        ],
      });

      expect(mapped.id).toBe(id.toString());
      expect(mapped.softDeleted).toBe(true);
      expect(mapped.inviteCode).toBe('AB12CD');
      expect(mapped.inventoryCount).toBe(7);
      expect(mapped.memberCount).toBe(0);
      expect(mapped.formerMemberIds).toEqual([former.toString()]);
      expect(mapped.membershipHistory[0].email).toBe('left@example.com');
    } finally {
      globalThis._mongo = original;
    }
  });
});
