import { Bell, X } from 'lucide-react';

export function PushNotificationBanner({ title, body, onDismiss }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div className="pointer-events-auto flex w-full max-w-[var(--app-column-max)] gap-3 rounded-2xl border border-emerald-200/80 bg-lm-raised/95 p-3 shadow-lm-card backdrop-blur-md dark:border-emerald-800/60 dark:bg-dm-raised/95">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <Bell className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-heading truncate text-sm font-bold">{title}</p>
          <p className="text-muted mt-0.5 line-clamp-2 text-xs leading-relaxed">{body}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
