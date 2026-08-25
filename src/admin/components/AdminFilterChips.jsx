export function AdminFilterChips({ options, value, onChange, className = '' }) {
  return (
    <div className={`mb-4 flex flex-wrap gap-2 ${className}`}>
      {options.map((opt) => {
        const id = opt.id ?? opt.value;
        const label = opt.label ?? String(id);
        const active = value === id;
        return (
          <button
            key={String(id)}
            type="button"
            onClick={() => onChange(id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 ${
              active
                ? 'bg-teal-600 text-white shadow-sm shadow-teal-900/15'
                : 'bg-white/90 text-slate-700 ring-1 ring-slate-200/80 hover:bg-slate-50 dark:bg-zinc-900/80 dark:text-zinc-200 dark:ring-white/10 dark:hover:bg-zinc-800'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
