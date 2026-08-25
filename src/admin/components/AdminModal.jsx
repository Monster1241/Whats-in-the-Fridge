import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function AdminModal({
  open,
  title,
  description,
  onClose,
  children,
  busy = false,
  labelledBy = 'admin-modal-title',
  wide = false,
}) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={() => !busy && onClose?.()}
    >
      <div
        className={`admin-modal-panel max-h-[90vh] w-full overflow-y-auto p-5 shadow-2xl ${
          wide ? 'max-w-2xl' : 'max-w-lg'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || onClose) && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title ? (
                <h2 id={labelledBy} className="text-heading text-lg font-bold tracking-tight">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="text-muted mt-1 text-sm leading-relaxed">{description}</p>
              ) : null}
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-zinc-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
