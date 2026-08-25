import { Resend } from 'resend';
import { logDevOnlySensitive, redactEmail } from './privacy.js';

function getFromAddress() {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "What's in the Fridge <onboarding@resend.dev>"
  );
}

/**
 * Sends the 6-digit signup verification code.
 * Without RESEND_API_KEY, logs to console (local dev fallback).
 */
export async function sendVerificationEmail(to, code) {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    logDevOnlySensitive('[EMAIL VERIFY]', to, `code ${code}`);
    console.log('[EMAIL VERIFY] Set RESEND_API_KEY in .env / Vercel to send real emails.');
    return { sent: false, mode: 'console' };
  }

  const resend = new Resend(apiKey);
  const from = getFromAddress();

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: 'Your verification code — What\'s in the Fridge',
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 20px; color: #059669;">Verify your account</h1>
        <p style="color: #475569; line-height: 1.5;">
          Enter this code in the app to finish signing up:
        </p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0f172a; margin: 24px 0;">
          ${code}
        </p>
        <p style="color: #94a3b8; font-size: 13px;">
          This code expires when you verify. If you didn't sign up, you can ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error('[EMAIL VERIFY] Resend failed:', error.message);
    logDevOnlySensitive('[EMAIL VERIFY] fallback', to, `code ${code}`);
    const err = new Error(error.message || 'Could not send verification email.');
    err.status = 502;
    throw err;
  }

  console.log(`[EMAIL VERIFY] Sent to ${redactEmail(to)} (id: ${data?.id ?? 'ok'})`);
  return { sent: true, mode: 'resend', id: data?.id };
}

/**
 * Sends a 6-digit code so support can confirm identity before household rejoin.
 */
export async function sendRecoveryVerificationEmail(to, code) {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      const err = new Error(
        'Email sending is not configured (RESEND_API_KEY missing). Add it in Vercel env vars and redeploy.',
      );
      err.status = 503;
      err.code = 'EMAIL_NOT_CONFIGURED';
      throw err;
    }
    logDevOnlySensitive('[EMAIL RECOVERY]', to, `code ${code}`);
    console.log('[EMAIL RECOVERY] Set RESEND_API_KEY in .env to send real emails. Using console fallback.');
    return { sent: false, mode: 'console' };
  }

  const resend = new Resend(apiKey);
  const from = getFromAddress();

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: 'Household recovery code — What\'s in the Fridge',
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 20px; color: #0d9488;">Confirm household recovery</h1>
        <p style="color: #475569; line-height: 1.5;">
          Support requested this code to verify it is really you before reconnecting your household.
          Share it only with Fridge support (via the in-app chat or the person helping you).
        </p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0f172a; margin: 24px 0;">
          ${code}
        </p>
        <p style="color: #94a3b8; font-size: 13px;">
          This code expires in about 10 minutes. If you did not ask for help recovering a household, you can ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error('[EMAIL RECOVERY] Resend failed:', error.message);
    logDevOnlySensitive('[EMAIL RECOVERY] fallback', to, `code ${code}`);
    const err = new Error(error.message || 'Could not send recovery email.');
    err.status = 502;
    err.code = 'EMAIL_SEND_FAILED';
    throw err;
  }

  console.log(`[EMAIL RECOVERY] Sent to ${redactEmail(to)} (id: ${data?.id ?? 'ok'})`);
  return { sent: true, mode: 'resend', id: data?.id, from };
}
