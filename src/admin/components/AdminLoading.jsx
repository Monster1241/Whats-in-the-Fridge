export function AdminLoading({ label = 'Loading…', className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} role="status" aria-live="polite">
      <span className="admin-skeleton h-4 w-4 shrink-0 rounded-full" aria-hidden />
      <div className="flex-1 space-y-2">
        <div className="admin-skeleton h-3 w-2/5 max-w-[12rem] rounded-full" />
        <div className="admin-skeleton h-3 w-3/5 max-w-[18rem] rounded-full" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function AdminStatSkeleton({ count = 3 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="admin-surface p-4 sm:p-5">
          <div className="admin-skeleton mb-3 h-3 w-24 rounded-full" />
          <div className="admin-skeleton h-9 w-16 rounded-lg" />
          <div className="admin-skeleton mt-3 h-3 w-40 rounded-full" />
        </div>
      ))}
    </div>
  );
}
