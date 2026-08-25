import { useState } from 'react';
import {
  fetchAdminRecoveryHousehold,
  fetchAdminRecoveryUser,
  postAdminRecoveryRejoin,
} from '../../api.js';

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function HouseholdCard({ household, userId, onRejoin, rejoiningId }) {
  if (!household) return null;
  const busy = rejoiningId === household.id;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-heading text-sm font-extrabold">
            Household {household.id.slice(-6)}
            {household.softDeleted ? (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Soft-deleted
              </span>
            ) : (
              <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                Active
              </span>
            )}
          </p>
          <p className="text-muted mt-1 font-mono text-xs break-all">{household.id}</p>
        </div>
        {userId ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onRejoin(household)}
            className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900"
          >
            {busy ? 'Rejoining…' : household.softDeleted ? 'Restore & rejoin' : 'Rejoin user'}
          </button>
        ) : null}
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted font-semibold uppercase tracking-wide">Invite code</dt>
          <dd className="text-heading mt-0.5 font-mono text-sm font-bold tracking-wider">
            {household.inviteCode || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-muted font-semibold uppercase tracking-wide">Inventory items</dt>
          <dd className="text-heading mt-0.5 font-semibold">{household.inventoryCount ?? 0}</dd>
        </div>
        <div>
          <dt className="text-muted font-semibold uppercase tracking-wide">Members now</dt>
          <dd className="text-heading mt-0.5 font-semibold">{household.memberCount ?? 0}</dd>
        </div>
        <div>
          <dt className="text-muted font-semibold uppercase tracking-wide">Owner id</dt>
          <dd className="mt-0.5 font-mono text-[11px] break-all">{household.ownerId || '—'}</dd>
        </div>
        {household.softDeleted ? (
          <>
            <div>
              <dt className="text-muted font-semibold uppercase tracking-wide">Deleted at</dt>
              <dd className="mt-0.5">{formatWhen(household.deletedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted font-semibold uppercase tracking-wide">Purge after</dt>
              <dd className="mt-0.5">{formatWhen(household.purgeAt)}</dd>
            </div>
          </>
        ) : null}
        {household.lastLeftByEmail ? (
          <div className="sm:col-span-2">
            <dt className="text-muted font-semibold uppercase tracking-wide">Last left by</dt>
            <dd className="mt-0.5">
              {household.lastLeftByEmail}
              {household.lastLeftByUserId ? (
                <span className="text-muted font-mono"> · {household.lastLeftByUserId}</span>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>

      {Array.isArray(household.members) && household.members.length > 0 ? (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-muted text-[10px] font-semibold uppercase tracking-wide">Current members</p>
          <ul className="mt-1 space-y-1 text-xs">
            {household.members.map((m) => (
              <li key={m.id || m.email} className="font-mono">
                {m.email || m.id}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {Array.isArray(household.membershipHistory) && household.membershipHistory.length > 0 ? (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-muted text-[10px] font-semibold uppercase tracking-wide">Leave history</p>
          <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs">
            {[...household.membershipHistory].reverse().map((entry, idx) => (
              <li key={`${entry.userId}-${entry.leftAt}-${idx}`}>
                {entry.email || entry.userId || 'unknown'} · {entry.event || 'left'} ·{' '}
                {formatWhen(entry.leftAt)}
                {entry.wasOwner ? ' · was owner' : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function AdminRecoveryPage() {
  const [email, setEmail] = useState('');
  const [householdQuery, setHouseholdQuery] = useState('');
  const [userResult, setUserResult] = useState(null);
  const [householdResult, setHouseholdResult] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingHousehold, setLoadingHousehold] = useState(false);
  const [rejoiningId, setRejoiningId] = useState(null);

  async function lookupUser(event) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoadingUser(true);
    try {
      const data = await fetchAdminRecoveryUser(email.trim());
      setUserResult(data);
      setHouseholdResult(null);
    } catch (err) {
      setUserResult(null);
      setError(err.message || 'Could not look up user.');
    } finally {
      setLoadingUser(false);
    }
  }

  async function lookupHousehold(event) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoadingHousehold(true);
    try {
      const data = await fetchAdminRecoveryHousehold(householdQuery.trim());
      setHouseholdResult(data.household);
    } catch (err) {
      setHouseholdResult(null);
      setError(err.message || 'Could not look up household.');
    } finally {
      setLoadingHousehold(false);
    }
  }

  async function rejoin(household, { force = false } = {}) {
    const userId = userResult?.user?.id;
    if (!userId || !household?.id) {
      setError('Look up a user by email first, then rejoin them to a household.');
      return;
    }

    const label = household.softDeleted ? 'restore and rejoin' : 'rejoin';
    const ok = window.confirm(
      force
        ? `Force ${label} ${userResult.user.email} into household ${household.id}? Ownership was not verified automatically.`
        : `${label.charAt(0).toUpperCase() + label.slice(1)} ${userResult.user.email} into this household? Invite code will be visible after.`,
    );
    if (!ok) return;

    setError(null);
    setSuccess(null);
    setRejoiningId(household.id);
    try {
      const data = await postAdminRecoveryRejoin({
        userId,
        householdId: household.id,
        force,
      });
      setSuccess(
        `Rejoined ${data.user?.email}. Invite code: ${data.inviteCode || '—'}${
          data.forced ? ' (forced)' : ''
        }.`,
      );
      const refreshed = await fetchAdminRecoveryUser(userResult.user.email);
      setUserResult(refreshed);
      setHouseholdResult(data.household);
    } catch (err) {
      if (err.code === 'OWNERSHIP_UNVERIFIED' || err.body?.code === 'OWNERSHIP_UNVERIFIED' || /former member/i.test(err.message || '')) {
        const forceOk = window.confirm(
          `${err.message}\n\nForce rejoin only after verifying identity with the user (and ideally their partner). Continue?`,
        );
        if (forceOk) {
          setRejoiningId(null);
          await rejoin(household, { force: true });
          return;
        }
      }
      setError(err.message || 'Could not rejoin.');
    } finally {
      setRejoiningId(null);
    }
  }

  const related = userResult?.relatedHouseholds ?? [];
  const last = userResult?.lastHousehold;
  const current = userResult?.currentHousehold;

  return (
    <div>
      <h1 className="text-heading mb-1 text-xl font-extrabold">Household recovery</h1>
      <p className="text-muted mb-6 text-sm">
        Look up a user by email or a household by id / invite code. Soft-deleted households are kept for 30
        days after the last member leaves.
      </p>

      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {success}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={lookupUser}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-zinc-950"
        >
          <label className="text-heading block text-sm font-bold" htmlFor="recovery-email">
            User email
          </label>
          <p className="text-muted mt-1 text-xs">Verify they own the account before rejoining.</p>
          <div className="mt-3 flex gap-2">
            <input
              id="recovery-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-zinc-900"
              placeholder="user@example.com"
            />
            <button
              type="submit"
              disabled={loadingUser}
              className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {loadingUser ? '…' : 'Look up'}
            </button>
          </div>
        </form>

        <form
          onSubmit={lookupHousehold}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-zinc-950"
        >
          <label className="text-heading block text-sm font-bold" htmlFor="recovery-household">
            Household id or invite code
          </label>
          <p className="text-muted mt-1 text-xs">Reveals invite code for support after verification.</p>
          <div className="mt-3 flex gap-2">
            <input
              id="recovery-household"
              type="text"
              value={householdQuery}
              onChange={(e) => setHouseholdQuery(e.target.value)}
              required
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-zinc-900"
              placeholder="ObjectId or invite code"
            />
            <button
              type="submit"
              disabled={loadingHousehold}
              className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {loadingHousehold ? '…' : 'Look up'}
            </button>
          </div>
        </form>
      </div>

      {userResult?.user ? (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-zinc-950">
          <p className="text-heading text-sm font-extrabold">{userResult.user.email}</p>
          <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted font-semibold uppercase tracking-wide">User id</dt>
              <dd className="mt-0.5 font-mono break-all">{userResult.user.id}</dd>
            </div>
            <div>
              <dt className="text-muted font-semibold uppercase tracking-wide">Verified</dt>
              <dd className="mt-0.5">{userResult.user.isVerified ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-muted font-semibold uppercase tracking-wide">Current household</dt>
              <dd className="mt-0.5 font-mono break-all">{userResult.user.householdId || 'None'}</dd>
            </div>
            <div>
              <dt className="text-muted font-semibold uppercase tracking-wide">Last household</dt>
              <dd className="mt-0.5 font-mono break-all">{userResult.user.lastHouseholdId || '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted font-semibold uppercase tracking-wide">Left at</dt>
              <dd className="mt-0.5">{formatWhen(userResult.user.leftHouseholdAt)}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="space-y-4">
        {current ? (
          <div>
            <h2 className="text-heading mb-2 text-sm font-bold uppercase tracking-wide">Current household</h2>
            <HouseholdCard
              household={current}
              userId={userResult?.user?.id}
              onRejoin={rejoin}
              rejoiningId={rejoiningId}
            />
          </div>
        ) : null}
        {last ? (
          <div>
            <h2 className="text-heading mb-2 text-sm font-bold uppercase tracking-wide">Last household</h2>
            <HouseholdCard
              household={last}
              userId={userResult?.user?.id}
              onRejoin={rejoin}
              rejoiningId={rejoiningId}
            />
          </div>
        ) : null}
        {related.length > 0 ? (
          <div>
            <h2 className="text-heading mb-2 text-sm font-bold uppercase tracking-wide">Related households</h2>
            <div className="space-y-3">
              {related.map((h) => (
                <HouseholdCard
                  key={h.id}
                  household={h}
                  userId={userResult?.user?.id}
                  onRejoin={rejoin}
                  rejoiningId={rejoiningId}
                />
              ))}
            </div>
          </div>
        ) : null}
        {householdResult ? (
          <div>
            <h2 className="text-heading mb-2 text-sm font-bold uppercase tracking-wide">Household lookup</h2>
            <HouseholdCard
              household={householdResult}
              userId={userResult?.user?.id}
              onRejoin={rejoin}
              rejoiningId={rejoiningId}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
