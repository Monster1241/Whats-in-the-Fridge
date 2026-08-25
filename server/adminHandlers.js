import { ObjectId } from 'mongodb';
import { requireAdmin } from './adminAuth.js';
import { getAdminUserStats } from './adminUserStats.js';
import { ensureDb } from './ensureDb.js';
import { toFriendlyError } from './errors.js';
import {
  listAdminStoreDeals,
  listUnverifiedStoreDeals,
  markDealManuallyVerified,
  markStoreDealsManuallyVerified,
  unmarkDealManuallyVerified,
  unmarkStoreDealsManuallyVerified,
} from './dealManualVerification.js';
import {
  getSupportInboxCounts,
  listUserFeedback,
  listUserReports,
  updateInboxItem,
  USER_FEEDBACK_COLLECTION,
  USER_REPORTS_COLLECTION,
} from './supportInbox.js';
import { findUserById } from './db.js';
import { getBearerUser } from './auth.js';
import { isAdminEmail } from './adminAuth.js';
import { normalizeDealStore, WEEKLY_DEALS_COLLECTION } from './weeklyDeals.js';
import {
  createAdminDeal,
  deleteAdminDeal,
  updateAdminDeal,
} from './adminDealCrud.js';
import {
  appendSupportMessage,
  getSupportThreadById,
  listSupportThreads,
  markSupportThreadRead,
  updateSupportThread,
} from './supportChat.js';
import { notifyUserOfSupportReply } from './supportPush.js';
import {
  adminLookupHousehold,
  adminLookupUserByEmail,
  adminRejoinUserToHousehold,
  writeAdminRecoveryAudit,
} from './adminHouseholdRecovery.js';
import {
  confirmAdminRecoveryCode,
  sendAdminRecoveryCode,
} from './adminRecoveryChallenge.js';

export async function handleAdminMe(req, res) {
  try {
    const session = getBearerUser(req);
    if (!session) {
      res.status(401).json({ error: 'Not authenticated.', isAdmin: false });
      return;
    }

    await ensureDb();
    const user = await findUserById(session.userId);
    if (!user) {
      res.status(401).json({ error: 'Session expired.', isAdmin: false });
      return;
    }

    res.status(200).json({
      isAdmin: isAdminEmail(user.email),
      email: user.email,
      userId: user.id,
    });
  } catch (err) {
    console.error('GET /api/admin/me', err);
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message, isAdmin: false });
  }
}

export async function handleAdminDashboard(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const counts = await getSupportInboxCounts();
    const users = await getAdminUserStats();
    res.status(200).json({ ok: true, counts: { ...counts, ...users } });
  } catch (err) {
    console.error('GET /api/admin/dashboard', err);
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleListAdminDeals(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const store = String(req.query?.store ?? '').trim() || null;
    const verifiedRaw = String(req.query?.verified ?? 'false').trim().toLowerCase();
    const verified = verifiedRaw === 'true' || verifiedRaw === '1';
    const collection = globalThis._mongo.db.collection(WEEKLY_DEALS_COLLECTION);
    const deals = await listAdminStoreDeals(collection, {
      store: store ?? undefined,
      verified,
    });

    res.status(200).json({ ok: true, count: deals.length, verified, deals });
  } catch (err) {
    console.error('GET /api/admin/deals', err);
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleListUnverifiedDeals(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const store = String(req.query?.store ?? '').trim() || null;
    const collection = globalThis._mongo.db.collection(WEEKLY_DEALS_COLLECTION);
    const deals = await listUnverifiedStoreDeals(collection, { store: store ?? undefined });

    res.status(200).json({ ok: true, count: deals.length, verified: false, deals });
  } catch (err) {
    console.error('GET /api/admin/deals/unverified', err);
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleVerifyWeeklyDeals(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const collection = globalThis._mongo.db.collection(WEEKLY_DEALS_COLLECTION);
    const store = normalizeDealStore(req.body?.store);
    const dealId = String(req.body?.dealId ?? '').trim();
    const verifiedBy =
      admin.user?.email || String(req.body?.verifiedBy ?? 'admin').trim();
    const verificationSource = String(req.body?.verificationSource ?? '').trim() || undefined;
    const dealPrice =
      req.body?.dealPrice != null ? Number(req.body.dealPrice) : undefined;
    const originalPrice =
      req.body?.originalPrice !== undefined
        ? req.body.originalPrice == null
          ? null
          : Number(req.body.originalPrice)
        : undefined;

    if (dealId) {
      if (!ObjectId.isValid(dealId)) {
        res.status(400).json({ error: 'Invalid dealId.' });
        return;
      }
      const verified = await markDealManuallyVerified(collection, new ObjectId(dealId), {
        verifiedBy,
        verificationSource,
        dealPrice,
        originalPrice,
      });
      res.status(200).json({ ok: true, verified: [verified] });
      return;
    }

    if (!store) {
      res.status(400).json({
        error: 'Provide dealId for one deal, or store to verify all active deals for that retailer.',
      });
      return;
    }

    const result = await markStoreDealsManuallyVerified(collection, {
      store,
      verifiedBy,
      verificationSource,
    });
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('POST /api/admin/deals/verify', err);
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleUnverifyWeeklyDeals(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const collection = globalThis._mongo.db.collection(WEEKLY_DEALS_COLLECTION);
    const store = normalizeDealStore(req.body?.store);
    const dealId = String(req.body?.dealId ?? '').trim();

    if (dealId) {
      if (!ObjectId.isValid(dealId)) {
        res.status(400).json({ error: 'Invalid dealId.' });
        return;
      }
      const unverified = await unmarkDealManuallyVerified(collection, new ObjectId(dealId));
      res.status(200).json({ ok: true, unverified: [unverified] });
      return;
    }

    if (!store) {
      res.status(400).json({
        error: 'Provide dealId for one deal, or store to unverify all verified deals for that retailer.',
      });
      return;
    }

    const result = await unmarkStoreDealsManuallyVerified(collection, { store });
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('POST /api/admin/deals/unverify', err);
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleCreateAdminDeal(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    await ensureDb();
    const collection = globalThis._mongo.db.collection(WEEKLY_DEALS_COLLECTION);
    const deal = await createAdminDeal(collection, req.body ?? {});
    res.status(201).json({ ok: true, deal });
  } catch (err) {
    console.error('POST /api/admin/deals', err);
    const friendly = toFriendlyError(err);
    res.status(err.status || friendly.status || 500).json({ error: err.message || friendly.message });
  }
}

export async function handleUpdateAdminDeal(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    await ensureDb();
    const dealId = String(req.params?.id ?? '').trim();
    const collection = globalThis._mongo.db.collection(WEEKLY_DEALS_COLLECTION);
    const deal = await updateAdminDeal(collection, dealId, req.body ?? {});
    res.status(200).json({ ok: true, deal });
  } catch (err) {
    console.error('PATCH /api/admin/deals/:id', err);
    const friendly = toFriendlyError(err);
    res.status(err.status || friendly.status || 500).json({ error: err.message || friendly.message });
  }
}

export async function handleDeleteAdminDeal(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    await ensureDb();
    const dealId = String(req.params?.id ?? '').trim();
    const collection = globalThis._mongo.db.collection(WEEKLY_DEALS_COLLECTION);
    const deal = await deleteAdminDeal(collection, dealId);
    res.status(200).json({ ok: true, deal });
  } catch (err) {
    console.error('DELETE /api/admin/deals/:id', err);
    const friendly = toFriendlyError(err);
    res.status(err.status || friendly.status || 500).json({ error: err.message || friendly.message });
  }
}

export async function handleAdminListReports(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const status = String(req.query?.status ?? '').trim() || undefined;
    const reports = await listUserReports({ status });
    res.status(200).json({ ok: true, count: reports.length, reports });
  } catch (err) {
    console.error('GET /api/admin/reports', err);
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleAdminUpdateReport(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const id = String(req.params?.id ?? '').trim();
    const updated = await updateInboxItem(USER_REPORTS_COLLECTION, id, {
      status: req.body?.status,
      adminNotes: req.body?.adminNotes,
      adminUserId: admin.user?.id ?? null,
    });
    res.status(200).json({ ok: true, report: updated });
  } catch (err) {
    console.error('PATCH /api/admin/reports/:id', err);
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleAdminListFeedback(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const status = String(req.query?.status ?? '').trim() || undefined;
    const feedback = await listUserFeedback({ status });
    res.status(200).json({ ok: true, count: feedback.length, feedback });
  } catch (err) {
    console.error('GET /api/admin/feedback', err);
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleAdminUpdateFeedback(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const id = String(req.params?.id ?? '').trim();
    const updated = await updateInboxItem(USER_FEEDBACK_COLLECTION, id, {
      status: req.body?.status,
      adminNotes: req.body?.adminNotes,
      adminUserId: admin.user?.id ?? null,
    });
    res.status(200).json({ ok: true, feedback: updated });
  } catch (err) {
    console.error('PATCH /api/admin/feedback/:id', err);
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleAdminListSupportChats(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const status = String(req.query?.status ?? '').trim() || undefined;
    const threads = await listSupportThreads({ status });
    res.status(200).json({ ok: true, count: threads.length, threads });
  } catch (err) {
    console.error('GET /api/admin/support-chats', err);
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleAdminGetSupportChat(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const id = String(req.params?.id ?? '').trim();
    const thread = await getSupportThreadById(id);
    const marked = await markSupportThreadRead(id, 'admin');
    res.status(200).json({ ok: true, thread: marked });
  } catch (err) {
    console.error('GET /api/admin/support-chats/:id', err);
    const friendly = toFriendlyError(err);
    res.status(err.status || friendly.status || 500).json({ error: err.message || friendly.message });
  }
}

export async function handleAdminReplySupportChat(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const id = String(req.params?.id ?? '').trim();
    const body = String(req.body?.message ?? req.body?.body ?? '').trim();
    if (!body) {
      res.status(400).json({ error: 'Message is required.' });
      return;
    }

    await getSupportThreadById(id);
    const thread = await appendSupportMessage(id, {
      role: 'admin',
      body,
      status: 'in_progress',
      bumpUnreadFor: 'user',
    });

    // Fire-and-forget push so a slow FCM call does not delay the admin UI.
    void notifyUserOfSupportReply({
      userId: thread.userId,
      threadId: thread.id,
      messageBody: body,
    });

    res.status(201).json({ ok: true, thread });
  } catch (err) {
    console.error('POST /api/admin/support-chats/:id/messages', err);
    const friendly = toFriendlyError(err);
    res.status(err.status || friendly.status || 500).json({ error: err.message || friendly.message });
  }
}

export async function handleAdminUpdateSupportChat(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const id = String(req.params?.id ?? '').trim();
    const thread = await updateSupportThread(id, {
      status: req.body?.status,
      category: req.body?.category,
      severity: req.body?.severity,
    });
    res.status(200).json({ ok: true, thread });
  } catch (err) {
    console.error('PATCH /api/admin/support-chats/:id', err);
    const friendly = toFriendlyError(err);
    res.status(err.status || friendly.status || 500).json({ error: err.message || friendly.message });
  }
}

export async function handleAdminLookupUser(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const email = String(req.query?.email ?? '').trim();
    if (!email) {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }

    const result = await adminLookupUserByEmail(email);
    await writeAdminRecoveryAudit({
      action: 'user_lookup',
      adminUserId: admin.user?.id ?? null,
      adminEmail: admin.user?.email ?? null,
      email: result.user.email,
      userId: result.user.id,
    }).catch(() => {});

    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('GET /api/admin/recovery/users', err);
    const friendly = toFriendlyError(err);
    res.status(err.status || friendly.status || 500).json({ error: err.message || friendly.message });
  }
}

export async function handleAdminLookupHousehold(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const q = String(req.query?.q ?? req.query?.query ?? '').trim();
    if (!q) {
      res.status(400).json({ error: 'Household id or invite code is required.' });
      return;
    }

    const household = await adminLookupHousehold(q);
    await writeAdminRecoveryAudit({
      action: 'household_lookup',
      adminUserId: admin.user?.id ?? null,
      adminEmail: admin.user?.email ?? null,
      query: q.slice(0, 80),
      householdId: household.id,
      inviteCodeRevealed: Boolean(household.inviteCode),
    }).catch(() => {});

    res.status(200).json({ ok: true, household });
  } catch (err) {
    console.error('GET /api/admin/recovery/households', err);
    const friendly = toFriendlyError(err);
    res.status(err.status || friendly.status || 500).json({ error: err.message || friendly.message });
  }
}

export async function handleAdminRejoinHousehold(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const userId = String(req.body?.userId ?? '').trim();
    const householdId = String(req.body?.householdId ?? '').trim();
    const force = Boolean(req.body?.force);

    if (!userId || !householdId) {
      res.status(400).json({ error: 'userId and householdId are required.' });
      return;
    }

    const result = await adminRejoinUserToHousehold({
      userId,
      householdId,
      force,
      adminUserId: admin.user?.id ?? null,
      adminEmail: admin.user?.email ?? null,
    });

    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('POST /api/admin/recovery/rejoin', err);
    const friendly = toFriendlyError(err);
    res.status(err.status || friendly.status || 500).json({
      error: err.message || friendly.message,
      code: err.code || undefined,
    });
  }
}

export async function handleAdminRecoverySendCode(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const userId = String(req.body?.userId ?? '').trim();
    const householdId = String(req.body?.householdId ?? '').trim();
    if (!userId || !householdId) {
      res.status(400).json({ error: 'userId and householdId are required.' });
      return;
    }

    const result = await sendAdminRecoveryCode({
      userId,
      householdId,
      adminUserId: admin.user?.id ?? null,
      adminEmail: admin.user?.email ?? null,
    });

    await writeAdminRecoveryAudit({
      action: 'recovery_code_sent',
      adminUserId: admin.user?.id ?? null,
      adminEmail: admin.user?.email ?? null,
      userId: result.userId,
      userEmail: result.userEmail,
      householdId: result.householdId,
      challengeId: result.challengeId,
    }).catch(() => {});

    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('POST /api/admin/recovery/send-code', err);
    const friendly = toFriendlyError(err);
    res.status(err.status || friendly.status || 500).json({
      error: err.message || friendly.message,
      code: err.code || undefined,
    });
  }
}

export async function handleAdminRecoveryConfirmCode(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const userId = String(req.body?.userId ?? '').trim();
    const householdId = String(req.body?.householdId ?? '').trim();
    const code = String(req.body?.code ?? '').trim();
    if (!userId || !householdId || !code) {
      res.status(400).json({ error: 'userId, householdId, and code are required.' });
      return;
    }

    const result = await confirmAdminRecoveryCode({ userId, householdId, code });

    await writeAdminRecoveryAudit({
      action: 'recovery_code_confirmed',
      adminUserId: admin.user?.id ?? null,
      adminEmail: admin.user?.email ?? null,
      userId: result.userId,
      householdId: result.householdId,
      challengeId: result.challengeId,
    }).catch(() => {});

    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('POST /api/admin/recovery/confirm-code', err);
    const friendly = toFriendlyError(err);
    res.status(err.status || friendly.status || 500).json({
      error: err.message || friendly.message,
      code: err.code || undefined,
    });
  }
}
