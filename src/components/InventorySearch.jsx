import { useMemo, useState } from 'react';
import {
  Check,
  Pencil,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { calculateItemStatus } from '../inventory/consumption.js';
import { getCategoryMeta, isOnShoppingList, STATUS } from '../inventory/constants.js';
import { inventorySearchKey, searchInventoryItems } from '../inventory/searchInventory.js';

const STATUS_LABELS = {
  [STATUS.FRESH]: { label: 'In stock', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
  [STATUS.EXPIRING]: { label: 'Expiring soon', className: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200' },
  [STATUS.ALMOST_FINISHED]: { label: 'Running low', className: 'bg-orange-100 text-orange-900 dark:bg-orange-950/60 dark:text-orange-200' },
  [STATUS.OUT]: { label: 'Need to buy', className: 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200' },
};

function getStatusChip(item) {
  const status = calculateItemStatus(item);
  return STATUS_LABELS[status] ?? STATUS_LABELS[STATUS.FRESH];
}

export function InventorySearch({
  items,
  enabledModules,
  onMoveToShopping,
  onMarkStocked,
  onDelete,
  onEdit,
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const trimmed = query.trim();
  const results = useMemo(
    () => (trimmed ? searchInventoryItems(items, trimmed, enabledModules) : []),
    [items, trimmed, enabledModules],
  );

  const showPanel = expanded && trimmed.length > 0;

  return (
    <section className="relative mb-4">
      <label className="sr-only" htmlFor="inventory-search">
        Search your household inventory
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          id="inventory-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setExpanded(true);
          }}
          onFocus={() => setExpanded(true)}
          placeholder="Search what you have…"
          className="input-field w-full py-3 pl-11 pr-10"
          autoComplete="off"
          enterKeyHint="search"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setExpanded(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="surface-card absolute left-0 right-0 z-30 mt-2 max-h-[min(70vh,24rem)] overflow-y-auto border-2 border-slate-200 p-2 shadow-xl dark:border-slate-600">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-slate-600 dark:text-slate-400">
              No match for &ldquo;{trimmed}&rdquo; in your household.
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((item) => {
                const catMeta = getCategoryMeta(item.category, item.itemType);
                const chip = getStatusChip(item);
                const onShoppingList = isOnShoppingList(item);

                return (
                  <li
                    key={inventorySearchKey(item)}
                    className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-900/50"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-heading text-sm font-bold leading-snug">{item.name}</p>
                        <p className="text-muted mt-0.5 text-xs">
                          {catMeta ? `${catMeta.emoji} ${catMeta.label}` : item.itemType}
                          {item.itemType ? ` · ${item.itemType}` : ''}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${chip.className}`}
                      >
                        {chip.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {onShoppingList ? (
                        <button
                          type="button"
                          onClick={() => onMarkStocked(item)}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white active:scale-[0.98]"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden />
                          Got it — in stock
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onMoveToShopping(item)}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white active:scale-[0.98]"
                        >
                          <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
                          Need to buy
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 active:scale-[0.98] dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
