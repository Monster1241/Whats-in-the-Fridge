export function AdminTable({ children, className = '' }) {
  return (
    <div
      className={`admin-surface overflow-x-auto ${className}`}
      style={{ padding: 0 }}
    >
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function AdminTableHead({ children }) {
  return (
    <thead className="border-b border-slate-200/80 bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-zinc-400">
      {children}
    </thead>
  );
}

export function AdminTh({ children, className = '' }) {
  return <th className={`px-4 py-3 font-bold ${className}`}>{children}</th>;
}

export function AdminTd({ children, className = '' }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

export function AdminTr({ children, className = '' }) {
  return (
    <tr
      className={`border-b border-slate-100 transition hover:bg-slate-50/80 dark:border-white/[0.04] dark:hover:bg-white/[0.02] ${className}`}
    >
      {children}
    </tr>
  );
}
