import { ensureDb } from './ensureDb.js';
import { findUserById } from './db.js';
import { getBearerUser } from './auth.js';
import { toFriendlyError } from './errors.js';
import { createUserFeedback, createUserReport } from './supportInbox.js';
import {
  appendSupportMessage,
  getOrCreateSupportThread,
  getSupportThreadForUser,
  getSupportThreadForUserById,
  listSupportThreadsForUser,
  markSupportThreadRead,
} from './supportChat.js';

async function requireVerifiedUser(req, res) {
  const session = getBearerUser(req);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated.' });
    return null;
  }

  await ensureDb();
  const user = await findUserById(session.userId);
  if (!user) {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
    return null;
  }

  if (!user.isVerified) {
    res.status(403).json({ error: 'Verify your email before contacting support.' });
    return null;
  }

  return { session, user };
}

export async function handleSubmitReport(req, res) {
  try {
    const auth = await requireVerifiedUser(req, res);
    if (!auth) return;

    const report = await createUserReport({
      userId: auth.user.id,
      userEmail: auth.user.email,
      householdId: auth.user.household_id,
      type: req.body?.type,
      message: req.body?.message,
      dealId: req.body?.dealId,
      dealName: req.body?.dealName,
      store: req.body?.store,
      reportedPrice: req.body?.reportedPrice,
      postcode: req.body?.postcode,
    });

    res.status(201).json({ ok: true, report: { id: report.id, status: report.status } });
  } catch (err) {
    console.error('POST /api/support/report', err);
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleSubmitFeedback(req, res) {
  try {
    const auth = await requireVerifiedUser(req, res);
    if (!auth) return;

    const feedback = await createUserFeedback({
      userId: auth.user.id,
      userEmail: auth.user.email,
      category: req.body?.category,
      message: req.body?.message,
      appVersion: req.body?.appVersion ?? null,
    });

    res.status(201).json({ ok: true, feedback: { id: feedback.id, status: feedback.status } });
  } catch (err) {
    console.error('POST /api/support/feedback', err);
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}

export async function handleGetSupportChat(req, res) {
  try {
    const auth = await requireVerifiedUser(req, res);
    if (!auth) return;

    const threads = await listSupportThreadsForUser(auth.user.id);
    const requestedId = String(req.query?.threadId ?? '').trim();

    let thread = null;
    if (requestedId) {
      thread = await getSupportThreadForUserById(auth.user.id, requestedId);
    } else {
      thread = await getSupportThreadForUser(auth.user.id);
      if (!thread && threads.length) {
        thread = await getSupportThreadForUserById(auth.user.id, threads[0].id);
      }
    }

    if (thread && thread.status !== 'closed') {
      thread = await markSupportThreadRead(thread.id, 'user');
    }

    res.status(200).json({ ok: true, thread, threads });
  } catch (err) {
    console.error('GET /api/support/chat', err);
    const friendly = toFriendlyError(err);
    res.status(err.status || friendly.status || 500).json({ error: err.message || friendly.message });
  }
}

export async function handlePostSupportChatMessage(req, res) {
  try {
    const auth = await requireVerifiedUser(req, res);
    if (!auth) return;

    const body = String(req.body?.message ?? req.body?.body ?? '').trim();
    if (!body) {
      res.status(400).json({ error: 'Message is required.' });
      return;
    }

    const thread = await getOrCreateSupportThread({
      userId: auth.user.id,
      userEmail: auth.user.email,
      householdId: auth.user.household_id,
    });

    const next = await appendSupportMessage(thread.id, {
      role: 'user',
      body,
      status: 'waiting_admin',
      bumpUnreadFor: 'admin',
    });

    res.status(201).json({ ok: true, thread: next });
  } catch (err) {
    console.error('POST /api/support/chat/messages', err);
    const friendly = toFriendlyError(err);
    res.status(friendly.status || 500).json({ error: friendly.message });
  }
}
