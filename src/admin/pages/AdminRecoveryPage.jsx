import { useState } from 'react';
import {
  fetchAdminRecoveryHousehold,
  fetchAdminRecoveryUser,
  postAdminRecoveryRejoin,
} from '../../api.js';
import { formatWhen } from '../adminFormat.js';
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminPageHeader,
  AdminSurface,
} from '../components/index.js';

const fieldClass =
  'min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-zinc-900';

function HouseholdCard({ household, userId, onRejoin, rejoiningId }) {
  if (!household) return null;
  const busy = rejoiningId === household.id;

  return (
    <AdminSurface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-heading text-sm font-extrabold">
              Household {household.id.slice(-6)}
            </p>
            {household.softDeleted ? (
              <AdminBadge tone="amber">Soft-deleted</AdminBadge>
            ) : (
              <AdminBadge tone="emerald">Active</AdminBadge>
            )}
          </div>
          <p className="text-muted mt-1 font-mono text-xs break-all">{household.id}</p>
        </div>
        {userId ? (
          <AdminButton
            size="sm"
            variant="dark"
            disabled={busy}
            onClick={() => onRejoin(household)}
          >
            {busy ? 'Rejoining…' : household.softDeleted ? 'Restore & rejoin' : 'Rejoin user'}
          </AdminButton>
        ) : null}
      </div>

      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
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
        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-white/[0.06]">
          <p className="text-muted text-[10px] font-semibold uppercase tracking-wide">
            Current members
          </p>
          <ul className="mt-1.5 space-y-1 text-xs">
            {household.members.map((m) => (
              <li key={m.id || m.email} className="font-mono">
                {m.email || m.id}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {Array.isArray(household.membershipHistory) && household.membershipHistory.length > 0 ? (
        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-white/[0.06]">
          <p className="text-muted text-[10px] font-semibold uppercase tracking-wide">
            Leave history
          </p>
          <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto text-xs">
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
    </AdminSurface>
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
      if (
        err.code === 'OWNERSHIP_UNVERIFIED' ||
        err.body?.code === 'OWNERSHIP_UNVERIFIED' ||
        /former member/i.test(err.message || '')
      ) {
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
      <AdminPageHeader
        title="Household recovery"
        description="Look up a user by email or a household by id / invite code. Soft-deleted households are kept for 30 days after the last member leaves."
      />

      <AdminAlert variant="error">{error}</AdminAlert>
      <AdminAlert variant="success">{success}</AdminAlert>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <AdminSurface as="form" onSubmit={lookupUser}>
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
              className={fieldClass}
              placeholder="user@example.com"
            />
            <AdminButton type="submit" disabled={loadingUser} size="sm">
              {loadingUser ? '…' : 'Look up'}
            </AdminButton>
          </div>
        </AdminSurface>

        <AdminSurface as="form" onSubmit={lookupHousehold}>
          <label className="text-heading block text-sm font-bold" htmlFor="recovery-household">
            Household id or invite code
          </label>
          <p className="text-muted mt-1 text-xs">
            Reveals invite code for support after verification.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              id="recovery-household"
              type="text"
              value={householdQuery}
              onChange={(e) => setHouseholdQuery(e.target.value)}
              required
              className={`${fieldClass} font-mono`}
              placeholder="ObjectId or invite code"
            />
            <AdminButton type="submit" disabled={loadingHousehold} size="sm">
              {loadingHousehold ? '…' : 'Look up'}
            </AdminButton>
          </div>
        </AdminSurface>
      </div>

      {userResult?.user ? (
        <AdminSurface className="mb-6">
          <p className="text-heading text-sm font-extrabold">{userResult.user.email}</p>
          <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted font-semibold uppercase tracking-wide">User id</dt>
              <dd className="mt-0.5 font-mono break-all">{userResult.user.id}</dd>
            </div>
            <div>
              <dt className="text-muted font-semibold uppercase tracking-wide">Verified</dt>
              <dd className="mt-0.5">{userResult.user.isVerified ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-muted font-semibold uppercase tracking-wide">
                Current household
              </dt>
              <dd className="mt-0.5 font-mono break-all">
                {userResult.user.householdId || 'None'}
              </dd>
            </div>
            <div>
              <dt className="text-muted font-semibold uppercase tracking-wide">Last household</dt>
              <dd className="mt-0.5 font-mono break-all">
                {userResult.user.lastHouseholdId || '—'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted font-semibold uppercase tracking-wide">Left at</dt>
              <dd className="mt-0.5">{formatWhen(userResult.user.leftHouseholdAt)}</dd>
            </div>
          </dl>
        </AdminSurface>
      ) : null}

      <div className="space-y-4">
        {current ? (
          <div>
            <h2 className="text-muted mb-2 text-[11px] font-bold uppercase tracking-wider">
              Current household
            </h2>
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
            <h2 className="text-muted mb-2 text-[11px] font-bold uppercase tracking-wider">
              Last household
            </h2>
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
            <h2 className="text-muted mb-2 text-[11px] font-bold uppercase tracking-wider">
              Related households
            </h2>
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
            <h2 className="text-muted mb-2 text-[11px] font-bold uppercase tracking-wider">
              Household lookup
            </h2>
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
