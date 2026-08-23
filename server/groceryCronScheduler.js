import {
  normalizeGroceryRefreshMode,
  refreshDueStoreDeals,
  refreshGroceryData,
} from './groceryDataRefresh.js';
import {
  getSydneyClock,
  isSydneyGroceryCronDue,
  SYDNEY_TZ,
} from './sydneyCronGuard.js';

const CHECK_INTERVAL_MS = 60_000;

/**
 * Local dev / self-hosted scheduler. Production should use Vercel Cron.
 * @param {{ enabled?: boolean }} [options]
 */
export function startGroceryCronScheduler(options = {}) {
  if (options.enabled === false || process.env.ENABLE_GROCERY_CRON !== '1') {
    return null;
  }

  const fired = new Set();

  const tick = async () => {
    const now = new Date();
    const clock = getSydneyClock(now);
    const slotKey = `${clock.dateKey}-${clock.hour}:${clock.minute}`;

    let mode = null;
    if (isSydneyGroceryCronDue('sneakPeek', now)) mode = 'sneakPeek';
    if (isSydneyGroceryCronDue('officialReset', now)) mode = 'officialReset';

    try {
      const storeDealRefresh = await refreshDueStoreDeals(now);
      if (storeDealRefresh.due > 0) {
        console.log('[grocery-cron] per-store deals', JSON.stringify(storeDealRefresh));
      }
    } catch (err) {
      console.error('[grocery-cron] per-store deals failed', err.message || err);
    }

    if (!mode || !normalizeGroceryRefreshMode(mode) || fired.has(slotKey)) return;

    fired.add(slotKey);
    try {
      const result = await refreshGroceryData(mode);
      console.log(`[grocery-cron] ${mode}`, JSON.stringify(result));
    } catch (err) {
      console.error(`[grocery-cron] ${mode} failed`, err.message || err);
    }

    if (fired.size > 48) fired.clear();
  };

  const timer = setInterval(() => {
    tick().catch((err) => {
      console.error('[grocery-cron] tick failed', err.message || err);
    });
  }, CHECK_INTERVAL_MS);

  console.log(
    `[grocery-cron] Scheduler active (${SYDNEY_TZ}): Mon 18:00 sneak peek, Wed 00:00 official reset`,
  );

  return timer;
}
