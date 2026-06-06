/** Australian retail week boundaries (Wednesday reset). Times align with Sydney cron schedule. */

export function getCurrentWednesdayStart(from = new Date()) {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const day = d.getUTCDay();
  const daysSinceWednesday = (day + 7 - 3) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceWednesday);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function getNextWednesdayExpiry(from = new Date()) {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const day = d.getUTCDay();
  let daysUntil = (3 - day + 7) % 7;
  if (daysUntil === 0) daysUntil = 7;
  d.setUTCDate(d.getUTCDate() + daysUntil);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Upcoming retail cycle (Monday sneak-peek window).
 * @returns {{ validFrom: Date, validTo: Date, expiresAt: Date }}
 */
export function getSneakPeekCycleBounds(from = new Date()) {
  const currentWednesday = getCurrentWednesdayStart(from);
  const validFrom = new Date(currentWednesday);
  if (from.getTime() >= currentWednesday.getTime()) {
    validFrom.setUTCDate(validFrom.getUTCDate() + 7);
  }
  const validTo = getNextWednesdayExpiry(validFrom);
  return { validFrom, validTo, expiresAt: validTo };
}

/**
 * Active retail cycle after the Wednesday 12:01 AM reset.
 * @returns {{ validFrom: Date, validTo: Date, expiresAt: Date }}
 */
export function getOfficialResetCycleBounds(from = new Date()) {
  const validFrom = getCurrentWednesdayStart(from);
  const validTo = getNextWednesdayExpiry(validFrom);
  return { validFrom, validTo, expiresAt: validTo };
}
