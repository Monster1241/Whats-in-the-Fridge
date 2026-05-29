import { useState } from 'react';
import { ChefHat, Copy, Home, LogIn, Refrigerator, Share2, UserPlus, Users } from 'lucide-react';

export function AuthScreen({
  needsHousehold,
  error,
  setError,
  onSignup,
  onLogin,
  onCreateHousehold,
  onJoinHousehold,
  onFinishHouseholdSetup,
}) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [householdMode, setHouseholdMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState('');
  const [createdSession, setCreatedSession] = useState(null);
  const [copied, setCopied] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    setLocalMessage('');
    try {
      await fn();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const createdCode =
    createdSession?.household?.inviteCode ||
    createdSession?.householdCode ||
    createdSession?.inviteCode ||
    '';

  const inviteMessage = createdCode
    ? `Join our household on What's in the Fridge! Use invite code: ${createdCode}`
    : '';

  const copyCode = async () => {
    if (!createdCode) return;
    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const shareCode = async () => {
    if (!createdCode) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join our fridge",
          text: inviteMessage,
        });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    copyCode();
  };

  const continueToApp = () => {
    if (!createdSession) return;
    onFinishHouseholdSetup(createdSession);
    setCreatedSession(null);
  };

  if (needsHousehold && createdSession) {
    return (
      <div className="app-shell mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-8">
        <header className="mb-6 text-center">
          <Refrigerator className="mx-auto mb-3 h-10 w-10 text-emerald-600" aria-hidden />
          <h1 className="text-heading text-2xl font-extrabold">Your household is ready</h1>
          <p className="text-muted mt-2 text-sm">
            Share this code with your partner so they can join the same fridge.
          </p>
        </header>

        <div className="surface-card mb-5 p-5 text-center">
          <p className="text-muted mb-2 text-xs font-semibold uppercase tracking-wide">
            Household invite code
          </p>
          <p className="text-heading font-mono text-4xl font-bold tracking-widest">{createdCode}</p>
          <button
            type="button"
            onClick={copyCode}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copied!' : 'Copy code'}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={shareCode}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-bold text-white active:scale-[0.98]"
          >
            <Share2 className="h-5 w-5" />
            Share code
          </button>
          <button
            type="button"
            onClick={continueToApp}
            className="rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white active:scale-[0.98]"
          >
            Continue to app
          </button>
        </div>

        <p className="text-muted mt-4 text-center text-xs leading-relaxed">
          You can find this code anytime in Settings → Household sharing.
        </p>
      </div>
    );
  }

  if (needsHousehold) {
    return (
      <div className="app-shell mx-auto flex min-h-full max-w-lg flex-col px-5 py-8">
        <header className="mb-6 text-center">
          <Refrigerator className="mx-auto mb-3 h-10 w-10 text-emerald-600" aria-hidden />
          <h1 className="text-heading text-2xl font-extrabold">Set up your household</h1>
          <p className="text-muted mt-2 text-sm">
            Create a new shared fridge or join your partner with their invite code.
          </p>
        </header>

        {error && (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        )}

        {!householdMode ? (
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => setHouseholdMode('create')}
              className="surface-card flex w-full items-center gap-3 p-4 text-left active:scale-[0.98]"
            >
              <Home className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="text-heading font-semibold">Create a new household</p>
                <p className="text-muted text-xs">Get a code like XYZ-123 to share with your partner</p>
              </div>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setHouseholdMode('join')}
              className="surface-card flex w-full items-center gap-3 p-4 text-left active:scale-[0.98]"
            >
              <Users className="h-6 w-6 text-violet-600" />
              <div>
                <p className="text-heading font-semibold">Join existing household</p>
                <p className="text-muted text-xs">Enter your partner&apos;s 6-character code</p>
              </div>
            </button>
          </div>
        ) : householdMode === 'create' ? (
          <div className="surface-card space-y-4 p-5">
            <p className="text-muted text-sm">
              We&apos;ll generate a unique invite code. You can copy or share it on the next screen.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const data = await onCreateHousehold();
                  setCreatedSession(data);
                  setHouseholdMode(null);
                })
              }
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white active:scale-[0.98]"
            >
              {busy ? 'Creating…' : 'Create household'}
            </button>
            <button
              type="button"
              onClick={() => setHouseholdMode(null)}
              className="text-muted w-full text-sm font-semibold"
            >
              Back
            </button>
          </div>
        ) : (
          <div className="surface-card space-y-4 p-5">
            <label className="text-muted block text-xs font-semibold uppercase">Partner invite code</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="XYZ-123"
              className="input-field font-mono tracking-widest"
            />
            <button
              type="button"
              disabled={busy || !inviteCode.trim()}
              onClick={() =>
                run(async () => {
                  const data = await onJoinHousehold(inviteCode.trim());
                  onFinishHouseholdSetup(data);
                })
              }
              className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white active:scale-[0.98]"
            >
              {busy ? 'Joining…' : 'Join household'}
            </button>
            <button
              type="button"
              onClick={() => setHouseholdMode(null)}
              className="text-muted w-full text-sm font-semibold"
            >
              Back
            </button>
          </div>
        )}

        {localMessage && (
          <p className="text-muted mt-4 text-center text-sm">{localMessage}</p>
        )}
      </div>
    );
  }

  return (
    <div className="app-shell mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-8">
      <header className="mb-8 text-center">
        <Refrigerator className="mx-auto mb-3 h-12 w-12 text-emerald-600" aria-hidden />
        <h1 className="text-heading text-3xl font-extrabold tracking-tight">What&apos;s in the Fridge?</h1>
        <p className="text-muted mt-2 text-sm">Track food, plan meals, and share with your household.</p>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold ${
            mode === 'login'
              ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-400'
          }`}
        >
          <LogIn className="h-4 w-4" />
          Log in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('signup');
            setError(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold ${
            mode === 'signup'
              ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-400'
          }`}
        >
          <UserPlus className="h-4 w-4" />
          Sign up
        </button>
      </div>

      <form
        className="surface-card space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            if (mode === 'signup') {
              await onSignup(email, password);
            } else {
              await onLogin(email, password);
            }
          });
        }}
      >
        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="auth-email" className="text-muted mb-1 block text-xs font-semibold uppercase">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="auth-password" className="text-muted mb-1 block text-xs font-semibold uppercase">
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            placeholder="At least 8 characters"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white active:scale-[0.98]"
        >
          <ChefHat className="h-4 w-4" />
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
        </button>
      </form>

      <div
        className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50/60 px-3.5 py-3 text-center dark:border-slate-700/60 dark:bg-slate-900/40"
        role="note"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">
          Beta privacy note
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500/90 dark:text-slate-500">
          Your email is only used for account sign-in and verification codes. Fridge inventory and
          settings stay isolated to your household — other households cannot see your data.
        </p>
      </div>
    </div>
  );
}
