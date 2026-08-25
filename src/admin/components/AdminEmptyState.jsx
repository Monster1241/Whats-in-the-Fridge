export function AdminEmptyState({ title = 'Nothing here', description, className = '' }) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-slate-300/90 bg-white/40 px-6 py-10 text-center dark:border-white/10 dark:bg-white/[0.02] ${className}`}
    >
      <p className="text-heading text-sm font-semibold">{title}</p>
      {description ? <p className="text-muted mx-auto mt-1.5 max-w-sm text-sm">{description}</p> : null}
    </div>
  );
}
