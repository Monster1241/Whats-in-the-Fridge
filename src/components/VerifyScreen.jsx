import { useRef, useState } from 'react';
import { Mail, Refrigerator } from 'lucide-react';

export function VerifyScreen({ email, error, setError, onVerify, onLogout }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const inputsRef = useRef([]);

  const code = digits.join('');

  const handleDigitChange = (index, value) => {
    const next = value.replace(/\D/g, '').slice(-1);
    const updated = [...digits];
    updated[index] = next;
    setDigits(updated);
    if (next && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const updated = pasted.split('');
    while (updated.length < 6) updated.push('');
    setDigits(updated);
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Enter the full 6-digit code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onVerify(code);
    } catch (err) {
      setError(err.message || 'Invalid code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-8">
      <header className="mb-8 text-center">
        <Refrigerator className="mx-auto mb-3 h-12 w-12 text-emerald-600" aria-hidden />
        <h1 className="text-heading text-2xl font-extrabold">Verify your account</h1>
        <p className="text-muted mt-2 text-sm">
          We sent a 6-digit code to <span className="font-semibold text-slate-800 dark:text-slate-200">{email}</span>
        </p>
        <p className="text-muted mt-2 text-xs">
          Check your inbox and spam folder. The code expires after you verify.
        </p>
      </header>

      <form className="surface-card space-y-5 p-5" onSubmit={submit}>
        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        )}

        <div>
          <label className="text-muted mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase">
            <Mail className="h-4 w-4" />
            Verification code
          </label>
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputsRef.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="input-field h-14 w-11 text-center text-lg font-bold tracking-widest"
                aria-label={`Digit ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? 'Verifying…' : 'Verify & continue'}
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="text-muted w-full text-sm font-semibold underline"
        >
          Log out
        </button>
      </form>
    </div>
  );
}
