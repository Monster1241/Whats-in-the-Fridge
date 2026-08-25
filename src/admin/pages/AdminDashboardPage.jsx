import { useEffect, useState } from 'react';
import {
  Activity,
  Flame,
  Headphones,
  Home,
  MessageSquare,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { fetchAdminDashboard } from '../../api.js';
import { AdminAlert } from '../components/AdminAlert.jsx';
import { AdminPageHeader } from '../components/AdminPageHeader.jsx';
import { AdminStatCard } from '../components/AdminStatCard.jsx';
import { AdminStatSkeleton } from '../components/AdminLoading.jsx';

export function AdminDashboardPage({ navigateAdmin }) {
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
    return (
      <div>
        <AdminPageHeader
          title="Dashboard"
          description="Overview of users, deals curation, and support."
        />
        <AdminStatSkeleton count={3} />
        <div className="mt-4">
          <AdminStatSkeleton count={4} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <AdminPageHeader title="Dashboard" description="Overview of users, deals curation, and support." />
        <AdminAlert variant="error">{error}</AdminAlert>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        description="Overview of users, deals curation, and support queues."
      />

      <section className="mb-8">
        <h2 className="text-muted mb-3 text-[11px] font-bold uppercase tracking-wider">
          Audience
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <AdminStatCard
            label="Total users"
            value={counts?.totalUsers ?? 0}
            hint="Active accounts only — deleted users are removed from the database"
            icon={Users}
            accent="slate"
          />
          <AdminStatCard
            label="Live users"
            value={counts?.liveUsers ?? 0}
            hint={`Used the app in the last ${counts?.liveWindowMinutes ?? 15} minutes`}
            icon={Activity}
            accent="teal"
          />
          <AdminStatCard
            label="Active today"
            value={counts?.activeToday ?? 0}
            hint="Signed in or synced in the last 24 hours"
            icon={Users}
            accent="sky"
          />
        </div>
      </section>

      <section>
        <h2 className="text-muted mb-3 text-[11px] font-bold uppercase tracking-wider">
          Work queues
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AdminStatCard
            label="Unverified deals"
            value={counts?.unverifiedDeals ?? 0}
            hint="Optional — verify to show the verified badge"
            icon={Flame}
            accent="amber"
            to="/admin/deals"
            navigateAdmin={navigateAdmin}
          />
          <AdminStatCard
            label="Support chats"
            value={counts?.unreadSupportChats ?? counts?.openSupportChats ?? 0}
            hint={
              counts?.unreadSupportChats
                ? `${counts.unreadSupportChats} unread · ${counts.openSupportChats ?? 0} open`
                : 'User messages waiting for a reply'
            }
            icon={Headphones}
            accent="rose"
            to="/admin/support"
            navigateAdmin={navigateAdmin}
          />
          <AdminStatCard
            label="Open reports"
            value={counts?.openReports ?? 0}
            hint="Wrong prices, missing deals, bugs"
            icon={ShieldAlert}
            accent="rose"
            to="/admin/reports"
            navigateAdmin={navigateAdmin}
          />
          <AdminStatCard
            label="Open feedback"
            value={counts?.openFeedback ?? 0}
            hint="Ideas and general messages"
            icon={MessageSquare}
            accent="sky"
            to="/admin/feedback"
            navigateAdmin={navigateAdmin}
          />
          <AdminStatCard
            label="Household recovery"
            value="→"
            hint="Reconnect users who left by mistake"
            icon={Home}
            accent="emerald"
            to="/admin/recovery"
            navigateAdmin={navigateAdmin}
          />
        </div>
      </section>
    </div>
  );
}
