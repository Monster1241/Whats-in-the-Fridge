import { Resend } from 'resend';

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
    console.log(`[EMAIL VERIFY] ${to} → code: ${code}`);
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
    console.log(`[EMAIL VERIFY] ${to} → code: ${code} (fallback — check Resend dashboard)`);
    const err = new Error(error.message || 'Could not send verification email.');
    err.status = 502;
    throw err;
  }

  console.log(`[EMAIL VERIFY] Sent to ${to} (id: ${data?.id})`);
  return { sent: true, mode: 'resend', id: data?.id };
}
