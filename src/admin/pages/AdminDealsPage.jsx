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
import {
  AdminAlert,
  AdminButton,
  AdminEmptyState,
  AdminFilterChips,
  AdminLoading,
  AdminPageHeader,
  AdminTable,
  AdminTableHead,
  AdminTd,
  AdminTh,
  AdminTr,
} from '../components/index.js';

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
      <AdminPageHeader
        title="Deal curation"
        description="Add, edit, or remove deals. Use Check price to search the store site or open the catalogue, then verify when prices match."
        actions={
          <AdminButton
            onClick={() => {
              setEditorError('');
              setEditor({ mode: 'create' });
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add deal
          </AdminButton>
        }
      />

      <AdminFilterChips
        value={viewVerified ? 'verified' : 'unverified'}
        onChange={(id) => setViewVerified(id === 'verified')}
        options={[
          { id: 'unverified', label: 'Unverified' },
          { id: 'verified', label: 'Verified' },
        ]}
      />

      <AdminFilterChips
        value={storeFilter}
        onChange={setStoreFilter}
        options={[
          { id: '', label: 'All stores' },
          ...DEAL_STORES.map((store) => ({
            id: store,
            label: store.charAt(0).toUpperCase() + store.slice(1),
          })),
        ]}
      />

      <div className="mb-2 flex flex-wrap gap-2">
        {DEAL_STORES.map((store) => (
          <AdminButton
            key={`verify-${store}`}
            variant="success"
            size="sm"
            disabled={busyId != null}
            onClick={() => verifyStore(store)}
          >
            Verify all {store}
          </AdminButton>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {DEAL_STORES.map((store) => (
          <AdminButton
            key={`unverify-${store}`}
            variant="warning"
            size="sm"
            disabled={busyId != null}
            onClick={() => unverifyStore(store)}
          >
            Unverify all {store}
          </AdminButton>
        ))}
      </div>

      <AdminAlert variant="success">{message}</AdminAlert>
      <AdminAlert variant="error">{error}</AdminAlert>

      {loading ? (
        <AdminLoading label="Loading deals…" className="admin-surface p-5" />
      ) : deals.length === 0 ? (
        <AdminEmptyState
          title={`No ${viewVerified ? 'verified' : 'unverified'} deals`}
          description="Try another store filter or add a new deal."
        />
      ) : (
        <AdminTable>
          <AdminTableHead>
            <tr>
              <AdminTh>Product</AdminTh>
              <AdminTh>Store</AdminTh>
              <AdminTh>Prices</AdminTh>
              <AdminTh>Check price</AdminTh>
              {viewVerified && <AdminTh>Verified</AdminTh>}
              <AdminTh>Actions</AdminTh>
            </tr>
          </AdminTableHead>
          <tbody>
            {deals.map((deal) => {
              const links = getDealPriceCheckLinks(deal);
              return (
                <AdminTr key={deal.id}>
                  <AdminTd>
                    <p className="font-semibold text-slate-900 dark:text-zinc-100">{deal.name}</p>
                    <p className="text-muted text-xs">
                      {deal.dealType}
                      {deal.category ? ` · ${deal.category}` : ''}
                    </p>
                  </AdminTd>
                  <AdminTd className="capitalize">{deal.store}</AdminTd>
                  <AdminTd className="tabular-nums">
                    ${Number(deal.dealPrice).toFixed(2)}
                    {deal.originalPrice != null && (
                      <span className="text-muted ml-1 line-through">
                        ${Number(deal.originalPrice).toFixed(2)}
                      </span>
                    )}
                  </AdminTd>
                  <AdminTd>
                    <div className="flex flex-wrap gap-1.5">
                      <AdminButton
                        size="sm"
                        variant="secondary"
                        title="Search this product on the store website"
                        onClick={() => openExternal(links.searchUrl)}
                        disabled={!links.searchUrl}
                        className="!bg-violet-600 !text-white hover:!bg-violet-500 dark:!bg-violet-600"
                      >
                        <Search className="h-3.5 w-3.5" aria-hidden />
                        Search
                      </AdminButton>
                      <AdminButton
                        size="sm"
                        variant="dark"
                        title="Open the store catalogue"
                        onClick={() => openExternal(links.catalogueUrl)}
                        disabled={!links.catalogueUrl}
                      >
                        <BookOpen className="h-3.5 w-3.5" aria-hidden />
                        Catalogue
                      </AdminButton>
                    </div>
                  </AdminTd>
                  {viewVerified && (
                    <AdminTd className="text-muted text-xs">{deal.priceVerifiedBy ?? '—'}</AdminTd>
                  )}
                  <AdminTd>
                    <div className="flex flex-wrap gap-1.5">
                      <AdminButton
                        size="sm"
                        variant="secondary"
                        disabled={busyId != null}
                        onClick={() => {
                          setEditorError('');
                          setEditor({ mode: 'edit', deal });
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Edit
                      </AdminButton>
                      <AdminButton
                        size="sm"
                        variant="danger"
                        disabled={busyId != null}
                        onClick={() => removeDeal(deal)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Delete
                      </AdminButton>
                      {viewVerified ? (
                        <AdminButton
                          size="sm"
                          variant="warning"
                          disabled={busyId != null}
                          onClick={() => unverifyOne(deal)}
                        >
                          {busyId === deal.id ? '…' : 'Unverify'}
                        </AdminButton>
                      ) : (
                        <AdminButton
                          size="sm"
                          variant="success"
                          disabled={busyId != null}
                          onClick={() => verifyOne(deal)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          {busyId === deal.id ? '…' : 'Verify'}
                        </AdminButton>
                      )}
                    </div>
                  </AdminTd>
                </AdminTr>
              );
            })}
          </tbody>
        </AdminTable>
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
