import { useEffect, useState } from 'react';
import { AuthScreen } from '../components/AuthScreen.jsx';
import { VerifyEmailScreen } from '../components/VerifyEmailScreen.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { fetchAdminMe } from '../api.js';
import { AdminLayout } from './AdminLayout.jsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.jsx';
import { AdminDealsPage } from './pages/AdminDealsPage.jsx';
import { AdminReportsPage } from './pages/AdminReportsPage.jsx';
import { AdminFeedbackPage } from './pages/AdminFeedbackPage.jsx';

function getAdminPage() {
  const path = window.location.pathname.replace(/\/$/, '') || '/admin';
  if (path === '/admin/deals') return 'deals';
  if (path === '/admin/reports') return 'reports';
  if (path === '/admin/feedback') return 'feedback';
  return 'dashboard';
}

export function AdminApp() {
  const auth = useAuth();
  const [adminCheck, setAdminCheck] = useState({ loading: true, isAdmin: false, email: null });
  const page = getAdminPage();

  useEffect(() => {
    if (!auth.canUseApp) {
      setAdminCheck({ loading: false, isAdmin: false, email: null });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAdminMe();
        if (!cancelled) {
          setAdminCheck({
            loading: false,
            isAdmin: Boolean(data.isAdmin),
            email: data.email ?? auth.user?.email ?? null,
          });
        }
      } catch {
        if (!cancelled) {
          setAdminCheck({ loading: false, isAdmin: false, email: auth.user?.email ?? null });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.canUseApp, auth.user?.email]);

  if (auth.booting) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-muted text-sm">Checking session…</p>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <AuthScreen
        needsHousehold={false}
        error={auth.error}
        setError={auth.setError}
        onSignup={auth.signup}
        onLogin={auth.login}
        onCreateHousehold={auth.createHousehold}
        onJoinHousehold={auth.joinHousehold}
        onFinishHouseholdSetup={auth.finishHouseholdSetup}
      />
    );
  }

  if (auth.needsVerification) {
    return (
      <VerifyEmailScreen
        email={auth.user?.email}
        error={auth.error}
        setError={auth.setError}
        onCheckVerified={auth.checkVerification}
        onResend={auth.resendVerificationEmail}
        onLogout={auth.logout}
      />
    );
  }

  if (auth.needsHousehold) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-12">
        <h1 className="text-heading text-lg font-bold">Household required</h1>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Finish household setup in the main app first, then return to{' '}
          <a href="/admin" className="font-semibold text-sky-600 underline">
            /admin
          </a>
          .
        </p>
        <a
          href="/"
          className="mt-6 inline-flex justify-center rounded-xl bg-slate-800 py-3 text-sm font-bold text-white"
        >
          Open main app
        </a>
      </div>
    );
  }

  if (adminCheck.loading) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-muted text-sm">Checking admin access…</p>
      </div>
    );
  }

  if (!adminCheck.isAdmin) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-12">
        <h1 className="text-heading text-lg font-bold">Admin access denied</h1>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Signed in as <strong>{adminCheck.email}</strong>. Add this email to{' '}
          <code className="text-xs">ADMIN_EMAILS</code> on the server, then reload.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex justify-center rounded-xl bg-slate-800 py-3 text-sm font-bold text-white"
        >
          Back to app
        </a>
      </div>
    );
  }

  let content = <AdminDashboardPage />;
  if (page === 'deals') content = <AdminDealsPage />;
  if (page === 'reports') content = <AdminReportsPage />;
  if (page === 'feedback') content = <AdminFeedbackPage />;

  return (
    <AdminLayout email={adminCheck.email} onLogout={auth.logout}>
      {content}
    </AdminLayout>
  );
}
