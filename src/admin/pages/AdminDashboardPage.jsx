import { useEffect, useState } from 'react';
import { fetchAdminDashboard } from '../../api.js';

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-zinc-950">
      <p className="text-muted text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-heading mt-2 text-3xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="text-muted mt-1 text-xs">{hint}</p>}
    </div>
  );
}

export function AdminDashboardPage() {
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAdminDashboard();
        if (!cancelled) setCounts(data.counts ?? null);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-muted text-sm">Loading dashboard…</p>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-heading mb-1 text-xl font-extrabold">Dashboard</h1>
      <p className="text-muted mb-6 text-sm">Overview of deals curation and user support.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Unverified deals"
          value={counts?.unverifiedDeals ?? 0}
          hint="Need catalogue check before prices show"
        />
        <StatCard
          label="Open reports"
          value={counts?.openReports ?? 0}
          hint="Wrong prices, missing deals, bugs"
        />
        <StatCard
          label="Open feedback"
          value={counts?.openFeedback ?? 0}
          hint="Ideas and general messages"
        />
      </div>
    </div>
  );
}
