import { X } from 'lucide-react';

const COLOR_LEGEND = [
  { swatch: 'bg-emerald-600', label: 'Emerald', desc: 'In stock · plentiful · primary actions' },
  { swatch: 'bg-amber-500', label: 'Amber', desc: 'Expiring soon (within 3 days)' },
  { swatch: 'bg-orange-500', label: 'Orange', desc: 'Almost finished or marked as running low' },
  { swatch: 'bg-rose-600', label: 'Rose', desc: 'Out of stock — sends item to the shopping list' },
  { swatch: 'bg-sky-600', label: 'Sky', desc: 'Shopping tab · list · add-to-pantry flow' },
  { swatch: 'bg-violet-600', label: 'Violet', desc: 'Saved recipes & recipe-from-shopping links' },
];

/**
 * Shown with first-time / “show tips again” onboarding — not permanently in Settings.
 * @param {{ onDismiss?: () => void, className?: string }} props
 */
export function ColorLegendCard({ onDismiss, className = 'mb-4' }) {
  return (
    <section className={`surface-card p-4 ${className}`}>
      <div className="mb-1 flex items-start justify-between gap-3">
        <h2 className="text-heading text-sm font-bold uppercase tracking-wide">Color guide</h2>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Dismiss color guide"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="text-muted mb-3 text-sm">What each color means across the app.</p>
      <ul className="space-y-2.5">
        {COLOR_LEGEND.map((item) => (
          <li key={item.label} className="flex items-start gap-3">
            <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full ${item.swatch}`} aria-hidden />
            <div>
              <p className="text-heading text-sm font-semibold">{item.label}</p>
              <p className="text-muted text-xs">{item.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
