import { useCallback, useEffect, useState } from 'react';
import { BookOpen, ExternalLink, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  createAdminDeal,
  deleteAdminDeal,
  fetchAdminDeals,
  unverifyAdminDeal,
  updateAdminDeal,
  verifyAdminDeal,
} from '../../api.js';
import { AdminDealEditorModal, DEAL_STORES } from '../AdminDealEditorModal.jsx';
import { getDealPriceCheckLinks } from '../dealPriceCheck.js';

function confirmAction(message) {
  return window.confirm(message);
}

function openExternal(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function AdminDealsPage() {
  const [storeFilter, setStoreFilter] = useState('');
  const [viewVerified, setViewVerified] = useState(false);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [editor, setEditor] = useState(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [editorError, setEditorError] = useState('');

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

  const removeDeal = async (deal) => {
    if (!confirmAction(`Delete "${deal.name}" from ${deal.store}?\n\nThis cannot be undone.`)) {
      return;
    }
    setBusyId(deal.id);
    setMessage(null);
    try {
      await deleteAdminDeal(deal.id);
      setMessage('Deal deleted.');
      await load();
    } catch (err) {
      setError(err.message || 'Delete failed.');
    } finally {
      setBusyId(null);
    }
  };

  const saveEditor = async (payload) => {
    setEditorBusy(true);
    setEditorError('');
    try {
      if (editor?.mode === 'create') {
        await createAdminDeal(payload);
        setMessage('Deal added.');
      } else if (editor?.deal?.id) {
        await updateAdminDeal(editor.deal.id, payload);
        setMessage('Deal updated.');
      }
      setEditor(null);
      await load();
    } catch (err) {
      setEditorError(err.message || 'Could not save deal.');
    } finally {
      setEditorBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-heading mb-1 text-xl font-extrabold">Deal curation</h1>
          <p className="text-muted text-sm">
            Add, edit, or remove deals. Use Check price to search the store site or open the
            catalogue, then verify when prices match.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditorError('');
            setEditor({ mode: 'create' });
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-500"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add deal
        </button>
      </div>

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
        {DEAL_STORES.map((store) => (
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
        {DEAL_STORES.map((store) => (
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
        {DEAL_STORES.map((store) => (
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
                <th className="px-4 py-3">Check price</th>
                {viewVerified && <th className="px-4 py-3">Verified</th>}
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => {
                const links = getDealPriceCheckLinks(deal);
                return (
                  <tr key={deal.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3">
                      <p className="font-medium">{deal.name}</p>
                      <p className="text-muted text-xs">
                        {deal.dealType}
                        {deal.category ? ` · ${deal.category}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 capitalize">{deal.store}</td>
                    <td className="px-4 py-3 tabular-nums">
                      ${Number(deal.dealPrice).toFixed(2)}
                      {deal.originalPrice != null && (
                        <span className="text-muted ml-1 line-through">
                          ${Number(deal.originalPrice).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          title="Search this product on the store website"
                          onClick={() => openExternal(links.searchUrl)}
                          disabled={!links.searchUrl}
                          className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-40"
                        >
                          <Search className="h-3.5 w-3.5" aria-hidden />
                          Search
                        </button>
                        <button
                          type="button"
                          title="Open the store catalogue"
                          onClick={() => openExternal(links.catalogueUrl)}
                          disabled={!links.catalogueUrl}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-slate-600 disabled:opacity-40"
                        >
                          <BookOpen className="h-3.5 w-3.5" aria-hidden />
                          Catalogue
                        </button>
                      </div>
                    </td>
                    {viewVerified && (
                      <td className="text-muted px-4 py-3 text-xs">
                        {deal.priceVerifiedBy ?? '—'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busyId != null}
                          onClick={() => {
                            setEditorError('');
                            setEditor({ mode: 'edit', deal });
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busyId != null}
                          onClick={() => removeDeal(deal)}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          Delete
                        </button>
                        {viewVerified ? (
                          <button
                            type="button"
                            disabled={busyId != null}
                            onClick={() => unverifyOne(deal)}
                            className="rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50"
                          >
                            {busyId === deal.id ? '…' : 'Unverify'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId != null}
                            onClick={() => verifyOne(deal)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            {busyId === deal.id ? '…' : 'Verify'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editor ? (
        <AdminDealEditorModal
          mode={editor.mode}
          deal={editor.deal}
          defaultStore={storeFilter || undefined}
          busy={editorBusy}
          error={editorError}
          onClose={() => !editorBusy && setEditor(null)}
          onSave={saveEditor}
        />
      ) : null}
    </div>
  );
}
