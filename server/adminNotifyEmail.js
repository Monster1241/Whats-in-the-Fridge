import { Resend } from 'resend';
import { getAdminEmails } from './adminAuth.js';
import { redactEmail } from './privacy.js';

function getFromAddress() {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "What's in the Fridge <onboarding@resend.dev>"
  );
}

/**
 * Who receives ops alerts. Prefer ADMIN_NOTIFY_EMAILS, else ADMIN_EMAILS.
 */
export function getAdminNotifyEmails() {
  const dedicated = String(process.env.ADMIN_NOTIFY_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (dedicated.length) return dedicated;
  return getAdminEmails();
}

export function getAdminAppBaseUrl() {
  const explicit =
    process.env.APP_ORIGIN?.trim() ||
    process.env.CORS_ORIGIN?.split(',')[0]?.trim() ||
    '';
  if (explicit) return explicit.replace(/\/$/, '');
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/^https?:\/\//, '')}`;
  }
  return 'http://localhost:5173';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{
 *   kind: 'support_chat' | 'report' | 'feedback',
 *   title: string,
 *   preview?: string,
 *   userEmail?: string|null,
 *   metaLines?: string[],
 *   adminPath?: string,
 * }} input
 */
export async function sendAdminNotificationEmail(input) {
  const recipients = getAdminNotifyEmails();
  if (!recipients.length) {
    console.warn('[ADMIN NOTIFY] No ADMIN_EMAILS / ADMIN_NOTIFY_EMAILS configured — skipped.');
    return { sent: false, mode: 'skipped', reason: 'no_recipients' };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const kindLabel =
    input.kind === 'support_chat'
      ? 'Support chat'
      : input.kind === 'report'
        ? 'User report'
        : 'User feedback';
  const subject = `[Fridge Admin] ${kindLabel}: ${String(input.title ?? 'New item').slice(0, 80)}`;
  const base = getAdminAppBaseUrl();
  const path = input.adminPath || '/admin';
  const href = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const preview = String(input.preview ?? '').trim().slice(0, 500);
  const meta = (input.metaLines ?? []).filter(Boolean).map((line) => escapeHtml(line));

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a;">
      <p style="font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #0d9488; margin: 0 0 8px;">
        Fridge Admin
      </p>
      <h1 style="font-size: 20px; margin: 0 0 12px;">${escapeHtml(kindLabel)}</h1>
      <p style="color: #475569; line-height: 1.5; margin: 0 0 16px;">
        ${escapeHtml(input.title)}
      </p>
      ${
        input.userEmail
          ? `<p style="font-size: 13px; color: #64748b; margin: 0 0 12px;"><strong>From:</strong> ${escapeHtml(input.userEmail)}</p>`
          : ''
      }
      ${
        meta.length
          ? `<ul style="font-size: 13px; color: #64748b; padding-left: 18px; margin: 0 0 16px;">${meta
              .map((line) => `<li>${line}</li>`)
              .join('')}</ul>`
          : ''
      }
      ${
        preview
          ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; white-space: pre-wrap; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">${escapeHtml(preview)}</div>`
          : ''
      }
      <a href="${escapeHtml(href)}" style="display: inline-block; background: #0d9488; color: #fff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 18px; border-radius: 10px;">
        Open in admin
      </a>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">
        ${escapeHtml(href)}
      </p>
    </div>
  `;

  if (!apiKey) {
    console.log(
      `[ADMIN NOTIFY] (no RESEND_API_KEY) ${kindLabel} → ${recipients.map(redactEmail).join(', ')}: ${subject}`,
    );
    return { sent: false, mode: 'console' };
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: recipients,
    subject,
    html,
  });

  if (error) {
    console.error('[ADMIN NOTIFY] Resend failed:', error.message);
    const err = new Error(error.message || 'Could not send admin notification email.');
    err.status = 502;
    throw err;
  }

  console.log(
    `[ADMIN NOTIFY] Sent ${kindLabel} to ${recipients.map(redactEmail).join(', ')} (id: ${data?.id ?? 'ok'})`,
  );
  return { sent: true, mode: 'resend', id: data?.id };
}

/**
 * Fire-and-forget so user requests never fail because of notify email issues.
 * @param {Parameters<typeof sendAdminNotificationEmail>[0]} input
 */
export function notifyAdminsBestEffort(input) {
  void sendAdminNotificationEmail(input).catch((err) => {
    console.error('[ADMIN NOTIFY] background send failed:', err?.message || err);
  });
}
