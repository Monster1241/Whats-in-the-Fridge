import { useState } from 'react';
import { ChefHat, Home, LogIn, Refrigerator, UserPlus, Users } from 'lucide-react';

export function AuthScreen({
  needsHousehold,
  error,
  setError,
  onSignup,
  onLogin,
  onCreateHousehold,
  onJoinHousehold,
}) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [householdMode, setHouseholdMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState('');

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
              We&apos;ll generate a unique invite code. Share it so your partner can join the same
              inventory.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const data = await onCreateHousehold();
                  setLocalMessage(`Your household code: ${data.household?.inviteCode || data.householdCode}`);
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
                  await onJoinHousehold(inviteCode.trim());
                  setLocalMessage('Joined household successfully.');
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
    </div>
  );
}
