export function AdminStatCard({
  label,
  value,
  hint,
  icon: Icon,
  to,
  navigateAdmin,
  accent = 'teal',
}) {
  const accents = {
    teal: 'from-teal-500/15 to-transparent text-teal-700 dark:text-teal-300',
    sky: 'from-sky-500/15 to-transparent text-sky-700 dark:text-sky-300',
    emerald: 'from-emerald-500/15 to-transparent text-emerald-700 dark:text-emerald-300',
    amber: 'from-amber-500/15 to-transparent text-amber-700 dark:text-amber-300',
    rose: 'from-rose-500/15 to-transparent text-rose-700 dark:text-rose-300',
    slate: 'from-slate-500/10 to-transparent text-slate-600 dark:text-slate-300',
  };

  const className = `admin-surface group relative overflow-hidden p-4 sm:p-5 transition duration-200 ${
    to
      ? 'block hover:-translate-y-0.5 hover:border-teal-500/30 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500'
      : ''
  }`;

  const content = (
    <>
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80 ${accents[accent] ?? accents.teal}`}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted text-[11px] font-bold uppercase tracking-wider">{label}</p>
          <p className="text-heading mt-2 text-3xl font-extrabold tabular-nums tracking-tight">
            {value}
          </p>
          {hint ? <p className="text-muted mt-1.5 text-xs leading-relaxed">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 ring-1 ring-black/[0.06] dark:bg-white/5 dark:ring-white/10">
            <Icon className="h-5 w-5 opacity-80" aria-hidden />
          </span>
        ) : null}
      </div>
    </>
  );

  if (to) {
    return (
      <a
        href={to}
        onClick={(event) => {
          event.preventDefault();
          navigateAdmin?.(to);
        }}
        className={className}
        aria-label={`Open ${label}`}
      >
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}
