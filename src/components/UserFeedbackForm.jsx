import { useState } from 'react';
import { submitUserFeedback } from '../api.js';

const CATEGORIES = [
  { id: 'idea', label: 'Feature idea' },
  { id: 'bug', label: 'Bug report' },
  { id: 'deal', label: 'Deals & catalogues' },
  { id: 'other', label: 'Other' },
];

export function UserFeedbackForm({ onSuccess, onCancel }) {
  const [category, setCategory] = useState('idea');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setError('Please write a message.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitUserFeedback({ category, message: trimmed });
      setDone(true);
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Could not send feedback.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          Thanks — your feedback was sent to the team.
        </p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-3 text-xs font-bold text-emerald-700 underline dark:text-emerald-400"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setCategory(opt.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              category === opt.id
                ? 'bg-sky-600 text-white'
                : 'bg-lm-inset text-slate-700 ring-1 ring-black/[0.08] dark:bg-dm-inset dark:text-slate-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="text-muted text-xs font-semibold uppercase">Message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="Tell us what would help, or what went wrong…"
          className="mt-1 w-full rounded-xl border border-black/[0.08] bg-lm-raised px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-dm-card"
        />
      </label>
      {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="flex-1 rounded-xl bg-sky-600 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send feedback'}
        </button>
        {onCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl px-4 py-3 text-sm font-bold ring-1 ring-slate-200 dark:ring-slate-600"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
