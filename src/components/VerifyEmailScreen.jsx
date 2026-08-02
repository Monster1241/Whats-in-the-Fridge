import { useState } from 'react';
import { Loader2, Mail, MailCheck } from 'lucide-react';
import { AuthShell } from './AuthShell.jsx';

export function VerifyEmailScreen({
  email,
  error,
  setError,
  onCheckVerified,
  onResend,
  onLogout,
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      await fn();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      step="verify"
      title="Verify your email"
      subtitle={
        <>
          We sent a confirmation link to{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-200">{email}</span>. Open it
          on this device, then tap the button below.
        </>
      }
    >
      <div className="auth-card auth-form-panel space-y-4">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <MailCheck className="h-7 w-7" aria-hidden />
          </div>
        </div>

        {error && (
          <p className="animate-fade-in rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        )}
        {message && (
          <p className="animate-fade-in rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            {message}
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => run(onCheckVerified)}
          className="btn-auth"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {busy ? 'Checking…' : "I've verified my email"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await onResend();
              setMessage('Verification email sent again. Check your inbox.');
            })
          }
          className="text-muted w-full text-sm font-semibold underline-offset-2 transition hover:text-emerald-700 hover:underline dark:hover:text-emerald-400"
        >
          Resend verification email
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => run(onLogout)}
          className="text-muted w-full text-xs font-semibold"
        >
          Sign out
        </button>
      </div>
    </AuthShell>
  );
}
