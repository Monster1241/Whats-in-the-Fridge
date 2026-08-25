import { getAdminPageFromPath } from './adminNavigation.js';

export function AdminNavLink({ to, end, children, navigateAdmin }) {
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

  return (
    <a
      href={to}
      onClick={handleClick}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
        active
          ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
          : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-zinc-950 dark:text-slate-200 dark:ring-slate-800 dark:hover:bg-zinc-900'
      }`}
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
