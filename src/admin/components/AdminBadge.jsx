const TONES = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200',
  teal: 'bg-teal-100 text-teal-900 dark:bg-teal-950/70 dark:text-teal-200',
  emerald: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200',
  amber: 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200',
  rose: 'bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-rose-200',
  sky: 'bg-sky-100 text-sky-900 dark:bg-sky-950/70 dark:text-sky-200',
  solidRose: 'bg-rose-600 text-white',
};

export function AdminBadge({ tone = 'slate', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONES[tone] ?? TONES.slate} ${className}`}
    >
      {children}
    </span>
  );
}
