import { useCallback, useEffect, useState } from 'react';
import { AuthScreen } from '../components/AuthScreen.jsx';
import { VerifyEmailScreen } from '../components/VerifyEmailScreen.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { fetchAdminMe } from '../api.js';
import { AdminLayout } from './AdminLayout.jsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.jsx';
import { AdminDealsPage } from './pages/AdminDealsPage.jsx';
import { AdminReportsPage } from './pages/AdminReportsPage.jsx';
import { AdminFeedbackPage } from './pages/AdminFeedbackPage.jsx';
import { AdminSupportChatsPage } from './pages/AdminSupportChatsPage.jsx';
import { getAdminPageFromPath, navigateAdmin as goToAdminPage } from './adminNavigation.js';

const ADMIN_ACCESS_CACHE_KEY = 'fridge.adminAccess';

function readCachedAdminAccess(email) {
  if (!email) return null;
  try {
    const raw = sessionStorage.getItem(ADMIN_ACCESS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.isAdmin && parsed.email === email) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function readCachedAdminAccessAny() {
  try {
    const raw = sessionStorage.getItem(ADMIN_ACCESS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.isAdmin && parsed.email) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function writeCachedAdminAccess(email, isAdmin) {
  try {
    if (isAdmin && email) {
      sessionStorage.setItem(ADMIN_ACCESS_CACHE_KEY, JSON.stringify({ email, isAdmin: true }));
    } else {
      sessionStorage.removeItem(ADMIN_ACCESS_CACHE_KEY);
    }
  } catch {
    // ignore
  }
}

function getInitialAdminCheck() {
  const cached = readCachedAdminAccessAny();
  if (cached) {
    return {
      loading: true,
      isAdmin: true,
      email: cached.email,
      resolved: false,
    };
  }
  return {
    loading: true,
    isAdmin: false,
    email: null,
    resolved: false,
  };
}

function renderAdminPage(page, navigateAdmin) {
  switch (page) {
    case 'deals':
      return <AdminDealsPage />;
    case 'support':
      return <AdminSupportChatsPage />;
    case 'reports':
      return <AdminReportsPage />;
    case 'feedback':
      return <AdminFeedbackPage />;
    default:
      return <AdminDashboardPage navigateAdmin={navigateAdmin} />;
  }
}

export function AdminApp() {
  const auth = useAuth();
  const [page, setPage] = useState(() => getAdminPageFromPath());
  const [adminCheck, setAdminCheck] = useState(getInitialAdminCheck);

  const navigateAdmin = useCallback(
    (to) => {
      goToAdminPage(to, setPage);
    },
    [],
  );

  useEffect(() => {
    const onPopState = () => setPage(getAdminPageFromPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (auth.booting || !auth.canUseApp) return;

    const email = auth.user?.email ?? null;
    const cached = readCachedAdminAccess(email);
    if (cached) {
      setAdminCheck({
        loading: true,
        isAdmin: true,
        email: cached.email,
        resolved: false,
      });
    } else {
      setAdminCheck({
        loading: true,
        isAdmin: false,
        email,
        resolved: false,
      });
    }

    let cancelled = false;

    (async () => {
      try {
        const data = await fetchAdminMe();
        if (cancelled) return;

        const isAdmin = Boolean(data.isAdmin);
        const resolvedEmail = data.email ?? email;
        writeCachedAdminAccess(resolvedEmail, isAdmin);

        setAdminCheck({
          loading: false,
          isAdmin,
          email: resolvedEmail,
          resolved: true,
        });
      } catch {
        if (cancelled) return;

        const fallback = readCachedAdminAccess(email);
        setAdminCheck({
          loading: false,
          isAdmin: Boolean(fallback?.isAdmin),
          email: fallback?.email ?? email,
          resolved: true,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.booting, auth.canUseApp, auth.user?.email]);

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

  const canEnterAdmin = adminCheck.isAdmin && adminCheck.email;

  if (canEnterAdmin) {
    return (
      <AdminLayout
        email={adminCheck.email}
        navigateAdmin={navigateAdmin}
        verifyingAccess={!adminCheck.resolved}
        onLogout={async () => {
          writeCachedAdminAccess(adminCheck.email, false);
          await auth.logout();
        }}
      >
        {renderAdminPage(page, navigateAdmin)}
      </AdminLayout>
    );
  }

  if (!adminCheck.resolved) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-muted text-sm">Checking admin access…</p>
      </div>
    );
  }

  const handleGoBackToAdminLogin = async () => {
    writeCachedAdminAccess(adminCheck.email, false);
    await auth.logout();
    window.location.href = '/admin';
  };

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-heading text-lg font-bold">Admin access denied</h1>
      <p className="text-muted mt-2 text-sm leading-relaxed">
        Signed in as <strong>{adminCheck.email}</strong>. Add this email to{' '}
        <code className="text-xs">ADMIN_EMAILS</code> on the server, then try again — or go back
        to log in with a different account.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleGoBackToAdminLogin}
          className="inline-flex justify-center rounded-xl bg-sky-600 py-3 text-sm font-bold text-white hover:bg-sky-500 active:scale-[0.98]"
        >
          Go back
        </button>
        <a
          href="/"
          className="inline-flex justify-center rounded-xl bg-slate-800 py-3 text-sm font-bold text-white dark:bg-slate-200 dark:text-slate-900"
        >
          Back to app
        </a>
      </div>
    </div>
  );
}
