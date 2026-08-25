import { AdminNavLink } from './AdminNavLink.jsx';
import {
  Flame,
  LayoutDashboard,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/deals', label: 'Deals', icon: Flame },
  { to: '/admin/reports', label: 'Reports', icon: ShieldAlert },
  { to: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
];

export function AdminLayout({ children, email, onLogout, navigateAdmin, verifyingAccess = false }) {
  return (
    <div className="min-h-full bg-slate-100 dark:bg-black">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div>
            <p className="text-heading text-sm font-extrabold tracking-tight">Fridge Admin</p>
            <p className="text-muted text-xs">
              {email}
              {verifyingAccess ? ' · verifying access…' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/"
              className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-900"
            >
              Open app
            </a>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:flex-row sm:px-6">
        <nav className="flex shrink-0 gap-2 overflow-x-auto sm:w-44 sm:flex-col sm:overflow-visible">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <AdminNavLink key={to} to={to} end={end} navigateAdmin={navigateAdmin}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </AdminNavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
