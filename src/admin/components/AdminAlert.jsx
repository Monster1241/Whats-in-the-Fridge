const STYLES = {
  error:
    'border-rose-200/80 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200',
  success:
    'border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100',
  warning:
    'border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100',
  info: 'border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100',
};

export function AdminAlert({ variant = 'error', children, className = '' }) {
  if (!children) return null;
  return (
    <div
      role="status"
      className={`mb-4 rounded-xl border px-3.5 py-2.5 text-sm font-medium leading-relaxed ${STYLES[variant] ?? STYLES.error} ${className}`}
    >
      {children}
    </div>
  );
}
