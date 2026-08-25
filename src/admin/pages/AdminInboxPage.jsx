import { useCallback, useEffect, useState } from 'react';
import { formatWhen } from '../adminFormat.js';
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminEmptyState,
  AdminFilterChips,
  AdminLoading,
  AdminModal,
  AdminPageHeader,
} from '../components/index.js';

const STATUSES = [
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'resolved', label: 'Resolved' },
];

function statusTone(status) {
  if (status === 'resolved') return 'emerald';
  if (status === 'in_progress') return 'amber';
  return 'sky';
}

/**
 * @param {{
 *   title: string,
 *   description: string,
 *   fetchItems: (status?: string) => Promise<{ reports?: object[], feedback?: object[] }>,
 *   updateItem: (id: string, patch: object) => Promise<unknown>,
 *   itemKey: 'reports' | 'feedback',
 *   renderMeta?: (item: object) => React.ReactNode,
 * }} props
 */
export function AdminInboxPage({
  title,
  description,
  fetchItems,
  updateItem,
  itemKey,
  renderMeta,
}) {
  const [statusFilter, setStatusFilter] = useState('open');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchItems(statusFilter || undefined);
      setItems(data[itemKey] ?? []);
    } catch (err) {
      setItems([]);
      setError(err.message || 'Could not load items.');
    } finally {
      setLoading(false);
    }
  }, [fetchItems, itemKey, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openItem = (item) => {
    setSelected(item);
    setNotes(item.adminNotes ?? '');
  };

  const save = async (status) => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await updateItem(selected.id, { status, adminNotes: notes });
      setSelected(null);
      await load();
    } catch (err) {
      setError(err.message || 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AdminPageHeader title={title} description={description} />

      <AdminFilterChips
        options={STATUSES}
        value={statusFilter}
        onChange={setStatusFilter}
      />

      <AdminAlert variant="error">{error}</AdminAlert>

      {loading ? (
        <AdminLoading label="Loading…" className="admin-surface p-5" />
      ) : items.length === 0 ? (
        <AdminEmptyState
          title="Nothing in this queue"
          description="Try another status filter or check back later."
        />
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openItem(item)}
                className="admin-surface w-full p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-teal-500/30 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-heading text-sm font-bold">
                      {item.type?.replace(/_/g, ' ') || item.category || 'Message'}
                    </p>
                    <p className="text-muted mt-1 line-clamp-2 text-sm leading-relaxed">
                      {item.message}
                    </p>
                    {renderMeta?.(item)}
                    <p className="text-muted mt-2 text-xs">
                      {item.userEmail || item.userId} · {formatWhen(item.createdAt)}
                    </p>
                  </div>
                  <AdminBadge tone={statusTone(item.status)}>
                    {String(item.status ?? '').replace(/_/g, ' ')}
                  </AdminBadge>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AdminModal
        open={Boolean(selected)}
        busy={busy}
        onClose={() => !busy && setSelected(null)}
        title="Review item"
      >
        {selected ? (
          <>
            <p className="text-muted whitespace-pre-wrap text-sm leading-relaxed">
              {selected.message}
            </p>
            {renderMeta?.(selected)}
            <label className="mt-4 block">
              <span className="text-muted text-xs font-semibold uppercase tracking-wide">
                Internal notes
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-white/10 dark:bg-zinc-900"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <AdminButton
                variant="warning"
                disabled={busy}
                onClick={() => save('in_progress')}
              >
                In progress
              </AdminButton>
              <AdminButton
                variant="success"
                disabled={busy}
                onClick={() => save('resolved')}
              >
                Resolved
              </AdminButton>
              <AdminButton
                variant="secondary"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Close
              </AdminButton>
            </div>
          </>
        ) : null}
      </AdminModal>
    </div>
  );
}
