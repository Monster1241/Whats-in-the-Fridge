import { useCallback, useEffect, useState } from 'react';

const STATUSES = ['open', 'in_progress', 'resolved'];

function formatWhen(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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
      <h1 className="text-heading mb-1 text-xl font-extrabold">{title}</h1>
      <p className="text-muted mb-4 text-sm">{description}</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize ${
              statusFilter === status
                ? 'bg-slate-800 text-white'
                : 'bg-white ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-slate-700'
            }`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-muted rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm dark:border-slate-700">
          Nothing in this queue.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openItem(item)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-300 dark:border-slate-800 dark:bg-zinc-950 dark:hover:border-sky-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-heading text-sm font-bold">
                      {item.type?.replace(/_/g, ' ') || item.category || 'Message'}
                    </p>
                    <p className="text-muted mt-1 line-clamp-2 text-sm">{item.message}</p>
                    {renderMeta?.(item)}
                    <p className="text-muted mt-2 text-xs">
                      {item.userEmail || item.userId} · {formatWhen(item.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase dark:bg-zinc-900">
                    {item.status}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => !busy && setSelected(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-heading text-lg font-bold">Review item</h2>
            <p className="text-muted mt-2 whitespace-pre-wrap text-sm">{selected.message}</p>
            {renderMeta?.(selected)}
            <label className="mt-4 block">
              <span className="text-muted text-xs font-semibold uppercase">Internal notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-zinc-900"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => save('in_progress')}
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                In progress
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => save('resolved')}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                Resolved
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setSelected(null)}
                className="rounded-xl px-4 py-2 text-xs font-bold ring-1 ring-slate-200 dark:ring-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
