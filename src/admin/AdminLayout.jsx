import { AdminNavLink } from './AdminNavLink.jsx';
import { getAdminPageFromPath } from './adminNavigation.js';
import {
  ExternalLink,
  Flame,
  Headphones,
  Home,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';
import { AdminButton } from './components/AdminButton.jsx';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, page: 'dashboard' },
  { to: '/admin/deals', label: 'Deals', icon: Flame, page: 'deals' },
  { to: '/admin/support', label: 'Support', icon: Headphones, page: 'support' },
  { to: '/admin/recovery', label: 'Recovery', icon: Home, page: 'recovery' },
  { to: '/admin/reports', label: 'Reports', icon: ShieldAlert, page: 'reports' },
  { to: '/admin/feedback', label: 'Feedback', icon: MessageSquare, page: 'feedback' },
];

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  deals: 'Deal curation',
  support: 'Support chat',
  recovery: 'Household recovery',
  reports: 'User reports',
  feedback: 'User feedback',
};

export function AdminLayout({ children, email, onLogout, navigateAdmin, verifyingAccess = false }) {
  const page = getAdminPageFromPath();
  const pageTitle = PAGE_TITLES[page] ?? 'Admin';

  return (
    <div className="admin-shell">
      <div className="mx-auto flex min-h-full max-w-[90rem]">
        <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col border-r border-white/5 bg-[var(--admin-sidebar)] px-4 py-5 md:flex">
          <div className="mb-8 px-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-400/90">
              Fridge
            </p>
            <p className="mt-1 text-xl font-extrabold tracking-tight text-white">Admin</p>
            <p className="mt-2 truncate text-xs text-[var(--admin-sidebar-muted)]" title={email}>
              {email}
              {verifyingAccess ? ' · verifying…' : ''}
            </p>
          </div>

          <nav className="flex flex-1 flex-col gap-1" aria-label="Admin">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <AdminNavLink key={to} to={to} end={end} navigateAdmin={navigateAdmin}>
                <Icon
                  className="h-4 w-4 shrink-0 opacity-80 group-hover:opacity-100"
                  aria-hidden
                />
                {label}
              </AdminNavLink>
            ))}
          </nav>

          <div className="mt-auto space-y-2 border-t border-white/10 pt-4">
            <a
              href="/"
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open app
            </a>
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/75 backdrop-blur-md dark:border-white/[0.06] dark:bg-zinc-950/75">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
              <div className="min-w-0 md:hidden">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-600 dark:text-teal-400">
                  Fridge Admin
                </p>
                <p className="text-heading truncate text-sm font-bold">{pageTitle}</p>
              </div>
              <div className="hidden min-w-0 md:block">
                <p className="text-heading text-sm font-bold tracking-tight">{pageTitle}</p>
                <p className="text-muted truncate text-xs">
                  {email}
                  {verifyingAccess ? ' · verifying access…' : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 md:hidden">
                <a
                  href="/"
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/5"
                >
                  App
                </a>
                <AdminButton variant="dark" size="sm" onClick={onLogout}>
                  Sign out
                </AdminButton>
              </div>
            </div>

            <nav
              className="flex gap-2 overflow-x-auto px-4 pb-3 sm:px-6 md:hidden"
              aria-label="Admin pages"
            >
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <AdminNavLink
                  key={to}
                  to={to}
                  end={end}
                  navigateAdmin={navigateAdmin}
                  variant="mobile"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {label}
                </AdminNavLink>
              ))}
            </nav>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
