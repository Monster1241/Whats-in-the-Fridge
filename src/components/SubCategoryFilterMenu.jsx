import { useEffect, useId, useRef, useState } from 'react';
import { ListFilter, X } from 'lucide-react';
import {
  getSubcategoriesForCategory,
  getSubcategoryMeta,
} from '../inventory/subcategories.js';

/**
 * @param {{
 *   itemType: string,
 *   category: string,
 *   selected: Set<string>,
 *   onToggle: (subCategory: string) => void,
 *   onClear: () => void,
 *   counts: Map<string, number>,
 * }} props
 */
export function SubCategoryFilterMenu({
  itemType,
  category,
  selected,
  onToggle,
  onClear,
  counts,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const panelId = useId();

  const options = getSubcategoriesForCategory(itemType, category);
  const available = options
    .map((sub) => ({ sub, count: counts.get(sub) ?? 0 }))
    .filter((entry) => entry.count > 0);

  const total = available.reduce((sum, entry) => sum + entry.count, 0);
  const activeCount = selected.size;

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

  if (total === 0) return null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition active:scale-[0.98] ${
          activeCount > 0
            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:bg-dm-card dark:text-slate-200'
        }`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
      >
        <ListFilter className="h-4 w-4 shrink-0" aria-hidden />
        Filters
        {activeCount > 0 && (
          <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums dark:bg-emerald-500">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Filter by item type"
          className="absolute right-0 z-40 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-600 dark:bg-dm-card"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-heading text-xs font-bold uppercase tracking-wide">Show types</p>
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
              ? 'All types shown. Check boxes to narrow the list.'
              : `Showing ${activeCount} selected type${activeCount === 1 ? '' : 's'} only.`}
          </p>

          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {available.map(({ sub, count }) => {
              const meta = getSubcategoryMeta(sub, itemType, category);
              const checked = selected.has(sub);
              const inputId = `${panelId}-${sub}`;

              return (
                <li key={sub}>
                  <label
                    htmlFor={inputId}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition ${
                      checked
                        ? 'bg-emerald-50 dark:bg-emerald-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(sub)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-500 dark:bg-dm-card"
                    />
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                      <span className="mr-1" aria-hidden>
                        {meta.emoji}
                      </span>
                      {meta.label}
                    </span>
                    <span className="text-muted shrink-0 text-xs font-semibold tabular-nums">
                      {count}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onClear();
              }}
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
