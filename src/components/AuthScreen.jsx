import { useState } from 'react';
import {
  ArrowLeft,
  ChefHat,
  Copy,
  Home,
  Loader2,
  LogIn,
  Share2,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { sendPasswordResetEmail } from '../api.js';
import { AuthShell } from './AuthShell.jsx';
import { LegalFooterLinks } from './LegalFooterLinks.jsx';

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
  const [recoverStep, setRecoverStep] = useState(null);
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
          title: 'Join our fridge',
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

  const resetRecovery = () => {
    setRecoverStep(null);
    setError(null);
    setLocalMessage('');
  };

  const startRecovery = () => {
    setError(null);
    setLocalMessage('');
    setRecoverStep('email');
  };

  if (needsHousehold && createdSession) {
    return (
      <AuthShell
        compact
        step="household"
        title="Your household is ready"
        subtitle="Share this code with your partner so they can join the same fridge."
      >
        <div className="auth-card text-center">
          <p className="text-muted mb-2 text-xs font-semibold uppercase tracking-wide">
            Household invite code
          </p>
          <p className="auth-invite-code">{createdCode}</p>
          <button
            type="button"
            onClick={copyCode}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-lm-raised/80 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-white active:scale-[0.98] dark:border-slate-600 dark:bg-dm-card/90 dark:text-slate-200"
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copied!' : 'Copy code'}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={shareCode}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-900/25 transition active:scale-[0.98] hover:brightness-105"
          >
            <Share2 className="h-5 w-5" />
            Share code
          </button>
          <button type="button" onClick={continueToApp} className="btn-auth">
            <Sparkles className="h-4 w-4" />
            Continue to app
          </button>
        </div>

        <p className="text-muted mt-4 text-center text-xs leading-relaxed">
          You can find this code anytime in Settings → Household sharing.
        </p>
      </AuthShell>
    );
  }

  if (needsHousehold) {
    return (
      <AuthShell
        compact
        step="household"
        title="Set up your household"
        subtitle="Create a new shared fridge or join your partner with their invite code."
      >
        {error && (
          <p className="mb-4 animate-fade-in rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        )}

        {!householdMode ? (
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => setHouseholdMode('create')}
              className="auth-choice-card animate-auth-rise"
              style={{ animationDelay: '80ms' }}
            >
              <span className="auth-choice-card__icon bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Home className="h-6 w-6" />
              </span>
              <div>
                <p className="text-heading font-semibold">Create a new household</p>
                <p className="text-muted text-xs">Get a code like XYZ-123 to share with your partner</p>
              </div>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setHouseholdMode('join')}
              className="auth-choice-card animate-auth-rise"
              style={{ animationDelay: '150ms' }}
            >
              <span className="auth-choice-card__icon bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                <Users className="h-6 w-6" />
              </span>
              <div>
                <p className="text-heading font-semibold">Join existing household</p>
                <p className="text-muted text-xs">Enter your partner&apos;s 6-character code</p>
              </div>
            </button>
          </div>
        ) : householdMode === 'create' ? (
          <div className="auth-card auth-form-panel space-y-4">
            <p className="text-muted text-sm leading-relaxed">
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
              className="btn-auth"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Home className="h-4 w-4" />}
              {busy ? 'Creating…' : 'Create household'}
            </button>
            <button
              type="button"
              onClick={() => setHouseholdMode(null)}
              className="text-muted flex w-full items-center justify-center gap-1.5 text-sm font-semibold"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>
        ) : (
          <div className="auth-card auth-form-panel space-y-4">
            <label className="auth-field text-muted block text-xs font-semibold uppercase">
              Partner invite code
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="XYZ-123"
              className="auth-field input-field text-center font-mono text-lg tracking-[0.2em]"
              style={{ animationDelay: '60ms' }}
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
              className="btn-auth !bg-violet-600 !shadow-violet-900/25 hover:!bg-violet-500"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              {busy ? 'Joining…' : 'Join household'}
            </button>
            <button
              type="button"
              onClick={() => setHouseholdMode(null)}
              className="text-muted flex w-full items-center justify-center gap-1.5 text-sm font-semibold"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>
        )}

        {localMessage && (
          <p className="text-muted mt-4 text-center text-sm">{localMessage}</p>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      step="auth"
      title="What's in the Fridge?"
      subtitle="Track food, plan meals, and share with your household."
    >
      {!recoverStep ? (
        <>
          <div className="auth-segment" role="tablist" aria-label="Sign in or sign up">
            <span
              className={`auth-segment__indicator${mode === 'signup' ? ' auth-segment__indicator--signup' : ''}`}
              aria-hidden
            />
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`auth-segment__btn${mode === 'login' ? ' auth-segment__btn--active' : ''}`}
            >
              <LogIn className="h-4 w-4" />
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`auth-segment__btn${mode === 'signup' ? ' auth-segment__btn--active' : ''}`}
            >
              <UserPlus className="h-4 w-4" />
              Sign up
            </button>
          </div>

          <form
            key={mode}
            className="auth-card auth-form-panel space-y-4"
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
              <p className="animate-fade-in rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                {error}
              </p>
            )}

            <div className="auth-field" style={{ animationDelay: '40ms' }}>
              <label htmlFor="auth-email" className="text-muted mb-1.5 block text-xs font-semibold uppercase">
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

            <div className="auth-field" style={{ animationDelay: '90ms' }}>
              <label htmlFor="auth-password" className="text-muted mb-1.5 block text-xs font-semibold uppercase">
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

            <button type="submit" disabled={busy} className="auth-field btn-auth" style={{ animationDelay: '140ms' }}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChefHat className="h-4 w-4" />
              )}
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
            </button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={startRecovery}
                className="text-muted w-full text-center text-sm font-semibold underline-offset-2 transition hover:text-emerald-700 hover:underline dark:hover:text-emerald-400"
              >
                Forgot password?
              </button>
            )}
          </form>

          <div
            className="mt-4 rounded-xl border border-slate-200/70 bg-white/50 px-3.5 py-3 text-center backdrop-blur-sm dark:border-slate-700/60 dark:bg-dm-inset"
            role="note"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Privacy &amp; terms
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500/90 dark:text-slate-500">
              Sign-in is handled by Firebase Authentication. Household inventory data stays private to
              your household.
            </p>
            <LegalFooterLinks className="mt-3" />
          </div>
        </>
      ) : (
        <div key={recoverStep} className="auth-card auth-form-panel space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-heading text-lg font-bold">Reset password</h2>
              <p className="text-muted mt-1 text-sm">
                {recoverStep === 'email' && 'Enter the email on your account.'}
                {recoverStep === 'done' && 'Check your inbox for the reset link from Firebase.'}
              </p>
            </div>
            <button
              type="button"
              onClick={resetRecovery}
              className="text-muted shrink-0 text-xs font-semibold underline-offset-2 hover:underline"
            >
              Back
            </button>
          </div>

          {error && (
            <p className="animate-fade-in rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
              {error}
            </p>
          )}

          {recoverStep === 'email' && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await sendPasswordResetEmail(email);
                  setRecoverStep('done');
                  setLocalMessage(
                    'If an account exists for this email, Firebase sent a password reset link.',
                  );
                });
              }}
            >
              <div>
                <label htmlFor="recover-email" className="text-muted mb-1 block text-xs font-semibold uppercase">
                  Email
                </label>
                <input
                  id="recover-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="you@example.com"
                />
              </div>
              <button type="submit" disabled={busy} className="btn-auth">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? 'Sending…' : 'Send reset email'}
              </button>
            </form>
          )}

          {recoverStep === 'done' && (
            <div className="space-y-4 text-center">
              <p className="text-muted text-sm leading-relaxed">
                {localMessage || 'Check your email for the reset link.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  resetRecovery();
                  setMode('login');
                  setPassword('');
                }}
                className="btn-auth"
              >
                Back to log in
              </button>
            </div>
          )}
        </div>
      )}
    </AuthShell>
  );
}
