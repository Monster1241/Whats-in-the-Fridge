import {
  normalizeGroceryRefreshMode,
  refreshGroceryData,
} from './groceryDataRefresh.js';

const SYDNEY_TZ = 'Australia/Sydney';
const CHECK_INTERVAL_MS = 60_000;

function getSydneyClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: SYDNEY_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const pick = (type) => parts.find((part) => part.type === type)?.value ?? '';
  const weekday = pick('weekday');
  const hour = Number(pick('hour'));
  const minute = Number(pick('minute'));

  return { weekday, hour, minute };
}

function shouldRunSneakPeek({ weekday, hour, minute }) {
  return weekday === 'Mon' && hour === 18 && minute === 0;
}

function shouldRunOfficialReset({ weekday, hour, minute }) {
  return weekday === 'Wed' && hour === 0 && minute === 1;
}

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
    const clock = getSydneyClock();
    const slotKey = `${clock.weekday}-${clock.hour}:${clock.minute}`;
    if (fired.has(slotKey)) return;

    let mode = null;
    if (shouldRunSneakPeek(clock)) mode = 'sneakPeek';
    if (shouldRunOfficialReset(clock)) mode = 'officialReset';
    if (!mode || !normalizeGroceryRefreshMode(mode)) return;

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
    `[grocery-cron] Scheduler active (${SYDNEY_TZ}): Mon 18:00 sneak peek, Wed 00:01 official reset`,
  );

  return timer;
}
