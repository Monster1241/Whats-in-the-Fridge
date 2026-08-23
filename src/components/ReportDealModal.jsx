import { useState } from 'react';
import { X } from 'lucide-react';
import { submitUserReport } from '../api.js';
import { readStoredPostcode } from '../inventory/postcodeStorage.js';

const REPORT_TYPES = [
  { id: 'deal_wrong_price', label: 'Wrong price' },
  { id: 'deal_not_available', label: 'Not on special anymore' },
  { id: 'other', label: 'Something else' },
];

/**
 * @param {{ deal: object, onClose: () => void }} props
 */
export function ReportDealModal({ deal, onClose }) {
  const [type, setType] = useState('deal_wrong_price');
  const [message, setMessage] = useState('');
  const [reportedPrice, setReportedPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const trimmed = message.trim();
    if (!trimmed && type === 'other') {
      setError('Please describe the issue.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitUserReport({
        type,
        message: trimmed || REPORT_TYPES.find((t) => t.id === type)?.label || 'Deal report',
        dealId: deal.id,
        dealName: deal.name,
        store: deal.store,
        reportedPrice: reportedPrice ? Number(reportedPrice) : null,
        postcode: readStoredPostcode(),
      });
      setDone(true);
    } catch (err) {
      setError(err.message || 'Could not send report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-black/[0.08] bg-lm-raised p-4 shadow-2xl dark:border-slate-700 dark:bg-dm-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-heading text-sm font-bold">Report this deal</h3>
            <p className="text-muted mt-0.5 line-clamp-2 text-xs">{deal.name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Thanks — we&apos;ll review this report.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {REPORT_TYPES.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setType(opt.id)}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    type === opt.id ? 'bg-rose-600 text-white' : 'bg-lm-inset ring-1 ring-black/[0.08] dark:bg-dm-inset'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {type === 'deal_wrong_price' && (
              <label className="mb-3 block">
                <span className="text-muted text-xs font-semibold">Price you saw (optional)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={reportedPrice}
                  onChange={(e) => setReportedPrice(e.target.value)}
                  placeholder="e.g. 4.50"
                  className="mt-1 w-full rounded-xl border border-black/[0.08] px-3 py-2 text-sm dark:border-slate-600 dark:bg-dm-inset"
                />
              </label>
            )}
            <label className="mb-3 block">
              <span className="text-muted text-xs font-semibold">Details (optional)</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Store location, catalogue page, etc."
                className="mt-1 w-full rounded-xl border border-black/[0.08] px-3 py-2 text-sm dark:border-slate-600 dark:bg-dm-inset"
              />
            </label>
            {error && (
              <p className="mb-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="w-full rounded-xl bg-rose-600 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Submit report'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
