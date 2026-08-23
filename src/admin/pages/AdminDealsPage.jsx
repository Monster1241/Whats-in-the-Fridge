import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminDeals,
  unverifyAdminDeal,
  verifyAdminDeal,
} from '../../api.js';

const STORES = ['coles', 'woolworths', 'aldi', 'harrisfarm', 'costco'];

function confirmAction(message) {
  return window.confirm(message);
}

export function AdminDealsPage() {
  const [storeFilter, setStoreFilter] = useState('');
  const [viewVerified, setViewVerified] = useState(false);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminDeals(storeFilter || undefined, viewVerified);
      setDeals(data.deals ?? []);
    } catch (err) {
      setDeals([]);
      setError(err.message || 'Could not load deals.');
    } finally {
      setLoading(false);
    }
  }, [storeFilter, viewVerified]);

  useEffect(() => {
    load();
  }, [load]);

  const verifyOne = async (deal) => {
    if (
      !confirmAction(
        `Verify "${deal.name}" at ${deal.store}?\n\nUsers will see a verified price badge for this item.`,
      )
    ) {
      return;
    }
    setBusyId(deal.id);
    setMessage(null);
    try {
      await verifyAdminDeal({ dealId: deal.id });
      setMessage('Deal verified.');
      await load();
    } catch (err) {
      setError(err.message || 'Verify failed.');
    } finally {
      setBusyId(null);
    }
  };

  const unverifyOne = async (deal) => {
    if (
      !confirmAction(
        `Remove verified badge from "${deal.name}" at ${deal.store}?\n\nPrices will still show with the usual disclaimer.`,
      )
    ) {
      return;
    }
    setBusyId(deal.id);
    setMessage(null);
    try {
      await unverifyAdminDeal({ dealId: deal.id });
      setMessage('Deal unverified.');
      await load();
    } catch (err) {
      setError(err.message || 'Unverify failed.');
    } finally {
      setBusyId(null);
    }
  };

  const verifyStore = async (store) => {
    if (
      !confirmAction(
        `Verify ALL active ${store} deals?\n\nOnly do this if you have checked the ${store} catalogue for every item in the list.`,
      )
    ) {
      return;
    }
    setBusyId(`verify:${store}`);
    setMessage(null);
    try {
      const result = await verifyAdminDeal({ store });
      setMessage(`Verified ${result.count ?? 0} ${store} deal(s).`);
      await load();
    } catch (err) {
      setError(err.message || 'Verify failed.');
    } finally {
      setBusyId(null);
    }
  };

  const unverifyStore = async (store) => {
    if (
      !confirmAction(
        `Remove verified badge from ALL active ${store} deals?\n\nPrices will still show; only the verified badge is removed.`,
      )
    ) {
      return;
    }
    setBusyId(`unverify:${store}`);
    setMessage(null);
    try {
      const result = await unverifyAdminDeal({ store });
      setMessage(`Unverified ${result.count ?? 0} ${store} deal(s).`);
      await load();
    } catch (err) {
      setError(err.message || 'Unverify failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="text-heading mb-1 text-xl font-extrabold">Deal curation</h1>
      <p className="text-muted mb-4 text-sm">
        Confirm prices against retailer catalogues, then verify so users see a verified badge.
        Prices are shown either way — verification is optional.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setViewVerified(false)}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${!viewVerified ? 'bg-slate-800 text-white' : 'bg-white ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-slate-700'}`}
        >
          Unverified
        </button>
        <button
          type="button"
          onClick={() => setViewVerified(true)}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${viewVerified ? 'bg-slate-800 text-white' : 'bg-white ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-slate-700'}`}
        >
          Verified
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStoreFilter('')}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${!storeFilter ? 'bg-slate-800 text-white' : 'bg-white ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-slate-700'}`}
        >
          All stores
        </button>
        {STORES.map((store) => (
          <button
            key={store}
            type="button"
            onClick={() => setStoreFilter(store)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize ${storeFilter === store ? 'bg-slate-800 text-white' : 'bg-white ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-slate-700'}`}
          >
            {store}
          </button>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {STORES.map((store) => (
          <button
            key={`verify-${store}`}
            type="button"
            disabled={busyId != null}
            onClick={() => verifyStore(store)}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Verify all {store}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {STORES.map((store) => (
          <button
            key={`unverify-${store}`}
            type="button"
            disabled={busyId != null}
            onClick={() => unverifyStore(store)}
            className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            Unverify all {store}
          </button>
        ))}
      </div>

      {message && (
        <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {message}
        </p>
      )}
      {error && (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : deals.length === 0 ? (
        <p className="text-muted rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm dark:border-slate-700">
          No {viewVerified ? 'verified' : 'unverified'} deals for this filter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-zinc-950">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Prices</th>
                {viewVerified && <th className="px-4 py-3">Verified</th>}
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-medium">{deal.name}</td>
                  <td className="px-4 py-3 capitalize">{deal.store}</td>
                  <td className="px-4 py-3 tabular-nums">
                    ${Number(deal.dealPrice).toFixed(2)}
                    {deal.originalPrice != null && (
                      <span className="text-muted ml-1 line-through">
                        ${Number(deal.originalPrice).toFixed(2)}
                      </span>
                    )}
                  </td>
                  {viewVerified && (
                    <td className="text-muted px-4 py-3 text-xs">
                      {deal.priceVerifiedBy ?? '—'}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {viewVerified ? (
                      <button
                        type="button"
                        disabled={busyId != null}
                        onClick={() => unverifyOne(deal)}
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50"
                      >
                        {busyId === deal.id ? '…' : 'Unverify'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId != null}
                        onClick={() => verifyOne(deal)}
                        className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-50"
                      >
                        {busyId === deal.id ? '…' : 'Verify'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
