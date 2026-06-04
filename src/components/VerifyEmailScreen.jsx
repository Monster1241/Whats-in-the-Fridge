import { useState } from 'react';
import { Mail, Refrigerator } from 'lucide-react';

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
    <div className="app-shell mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-8">
      <header className="mb-6 text-center">
        <Refrigerator className="mx-auto mb-3 h-10 w-10 text-emerald-600" aria-hidden />
        <h1 className="text-heading text-2xl font-extrabold">Verify your email</h1>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          We sent a confirmation link to{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-200">{email}</span>.
          Open it on this device, then tap the button below.
        </p>
      </header>

      <div className="surface-card space-y-4 p-5">
        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            {message}
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => run(onCheckVerified)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
        >
          <Mail className="h-4 w-4" />
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
          className="text-muted w-full text-sm font-semibold underline-offset-2 hover:text-emerald-700 hover:underline dark:hover:text-emerald-400"
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
    </div>
  );
}
