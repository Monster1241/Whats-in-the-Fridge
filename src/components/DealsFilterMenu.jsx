import { useEffect, useId, useRef, useState } from 'react';
import { ListFilter, X } from 'lucide-react';

/**
 * @param {{
 *   storeOptions: Array<{ id: string, label: string }>,
 *   dealTypeOptions: Array<{ id: string, label: string }>,
 *   selectedStores: Set<string>,
 *   selectedDealTypes: Set<string>,
 *   onToggleStore: (id: string) => void,
 *   onToggleDealType: (id: string) => void,
 *   onClear: () => void,
 *   storeCounts: Map<string, number>,
 *   dealTypeCounts: Map<string, number>,
 * }} props
 */
export function DealsFilterMenu({
  storeOptions,
  dealTypeOptions,
  selectedStores,
  selectedDealTypes,
  onToggleStore,
  onToggleDealType,
  onClear,
  storeCounts,
  dealTypeCounts,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const panelId = useId();

  const availableStores = storeOptions
    .map((option) => ({ ...option, count: storeCounts.get(option.id) ?? 0 }))
    .filter((entry) => entry.count > 0);

  const availableDealTypes = dealTypeOptions
    .map((option) => ({ ...option, count: dealTypeCounts.get(option.id) ?? 0 }))
    .filter((entry) => entry.count > 0);

  const total = availableStores.reduce((sum, e) => sum + e.count, 0);
  const activeCount = selectedStores.size + selectedDealTypes.size;

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (total === 0 && availableDealTypes.length === 0) return null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition active:scale-[0.98] ${
          activeCount > 0
            ? 'border-rose-300 bg-rose-50 text-rose-800 ring-2 ring-rose-200 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-800'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:bg-black dark:text-slate-200'
        }`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
      >
        <ListFilter className="h-4 w-4 shrink-0" aria-hidden />
        Filters
        {activeCount > 0 && (
          <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums dark:bg-rose-500">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Filter deals"
          className="absolute right-0 z-40 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-600 dark:bg-black"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-heading text-xs font-bold uppercase tracking-wide">Filter deals</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close filters"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-muted mb-3 text-[11px] leading-snug">
            {activeCount === 0
              ? 'All stores and deal types shown. Check boxes to narrow the list.'
              : 'Showing only your selected stores and deal types.'}
          </p>

          {availableStores.length > 0 && (
            <div className="mb-3">
              <p className="text-muted mb-1.5 text-[10px] font-bold uppercase tracking-wider">Store</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {availableStores.map(({ id, label, count }) => {
                  const inputId = `${panelId}-store-${id}`;
                  const checked = selectedStores.has(id);
                  return (
                    <li key={id}>
                      <label
                        htmlFor={inputId}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition ${
                          checked
                            ? 'bg-rose-50 dark:bg-rose-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleStore(id)}
                          className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 dark:border-slate-500 dark:bg-black"
                        />
                        <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                          {label}
                        </span>
                        <span className="text-muted shrink-0 text-xs font-semibold tabular-nums">
                          {count}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {availableDealTypes.length > 0 && (
            <div>
              <p className="text-muted mb-1.5 text-[10px] font-bold uppercase tracking-wider">
                Deal type
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {availableDealTypes.map(({ id, label, count }) => {
                  const inputId = `${panelId}-type-${id}`;
                  const checked = selectedDealTypes.has(id);
                  return (
                    <li key={id}>
                      <label
                        htmlFor={inputId}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition ${
                          checked
                            ? 'bg-rose-50 dark:bg-rose-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleDealType(id)}
                          className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 dark:border-slate-500 dark:bg-black"
                        />
                        <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                          {label}
                        </span>
                        <span className="text-muted shrink-0 text-xs font-semibold tabular-nums">
                          {count}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-muted mt-3 w-full rounded-lg py-2 text-center text-xs font-bold hover:text-slate-700 dark:hover:text-slate-200"
            >
              Clear filters — show all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
