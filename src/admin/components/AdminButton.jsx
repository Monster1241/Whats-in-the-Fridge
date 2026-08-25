const VARIANTS = {
  primary:
    'bg-sky-600 text-white hover:bg-sky-500 focus-visible:outline-sky-500 shadow-sm shadow-sky-900/10',
  secondary:
    'bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-white/10 dark:hover:bg-zinc-800',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/5',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:outline-emerald-500',
  warning:
    'bg-amber-600 text-white hover:bg-amber-500 focus-visible:outline-amber-500',
  danger:
    'bg-rose-600 text-white hover:bg-rose-500 focus-visible:outline-rose-500',
  dark: 'bg-slate-800 text-white hover:bg-slate-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white',
};

const SIZES = {
  sm: 'rounded-lg px-2.5 py-1.5 text-xs font-bold',
  md: 'rounded-xl px-3.5 py-2.5 text-sm font-semibold',
  lg: 'rounded-xl px-4 py-3 text-sm font-semibold',
};

export function AdminButton({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${VARIANTS[variant] ?? VARIANTS.primary} ${SIZES[size] ?? SIZES.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
