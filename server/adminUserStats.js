/** Users active within this window count as "live" on the admin dashboard. */
export const LIVE_USER_WINDOW_MS = 15 * 60 * 1000;

/** Window for "active today" stat. */
export const ACTIVE_TODAY_WINDOW_MS = 24 * 60 * 60 * 1000;

function getDb() {
  const db = globalThis._mongo?.db;
  if (!db) throw new Error('Database not connected.');
  return db;
}

/**
 * @param {Date} [now]
 */
export async function getAdminUserStats(now = new Date()) {
  const users = getDb().collection('users');
  const liveSince = new Date(now.getTime() - LIVE_USER_WINDOW_MS);
  const todaySince = new Date(now.getTime() - ACTIVE_TODAY_WINDOW_MS);

  const [totalUsers, liveUsers, activeToday] = await Promise.all([
    users.countDocuments({}),
    users.countDocuments({ last_active_at: { $gte: liveSince } }),
    users.countDocuments({ last_active_at: { $gte: todaySince } }),
  ]);

  return {
    totalUsers,
    liveUsers,
    activeToday,
    liveWindowMinutes: LIVE_USER_WINDOW_MS / 60_000,
  };
}
