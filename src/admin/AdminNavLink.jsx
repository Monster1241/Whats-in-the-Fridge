import { getAdminPageFromPath } from './adminNavigation.js';

export function AdminNavLink({ to, end, children, navigateAdmin, variant = 'sidebar' }) {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const normalizedTo = to.replace(/\/$/, '') || '/';
  const active = end
    ? path === normalizedTo
    : path === normalizedTo || path.startsWith(`${normalizedTo}/`);

  const handleClick = (event) => {
    event.preventDefault();
    if (navigateAdmin) {
      navigateAdmin(to);
      return;
    }
    window.location.href = to;
  };

  const className =
    variant === 'mobile'
      ? `inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold transition ${
          active
            ? 'bg-teal-600 text-white shadow-sm'
            : 'bg-white/80 text-slate-700 ring-1 ring-slate-200/80 hover:bg-white dark:bg-zinc-900 dark:text-zinc-200 dark:ring-white/10'
        }`
      : `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
          active
            ? 'bg-teal-500/15 text-teal-100 ring-1 ring-teal-400/25'
            : 'text-slate-300 hover:bg-white/5 hover:text-white'
        }`;

  return (
    <a
      href={to}
      onClick={handleClick}
      aria-current={active ? 'page' : undefined}
      className={className}
    >
      {children}
    </a>
  );
}

/** Resolve active tab from pathname (for tests). */
export function isAdminNavActive(to, end, pathname = window.location.pathname) {
  const path = pathname.replace(/\/$/, '') || '/';
  const normalizedTo = to.replace(/\/$/, '') || '/';
  return end
    ? path === normalizedTo
    : path === normalizedTo || path.startsWith(`${normalizedTo}/`);
}

export { getAdminPageFromPath };
