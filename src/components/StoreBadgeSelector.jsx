import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getStoreBadgeClassName, PREFERRED_STORE_OPTIONS } from '../inventory/storeOptions.js';

export function StoreBadgeSelector({ store, onSelect, disabled = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const badgeClass = getStoreBadgeClassName(store);

  return (
    <span ref={rootRef} className="relative ml-1.5 inline-flex">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ring-1 transition active:scale-95 disabled:opacity-50 ${badgeClass}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        title="Change preferred store"
      >
        {store}
        <ChevronDown
          className={`h-3 w-3 opacity-70 transition ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 top-full z-40 mt-1 min-w-[10.5rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
        >
          {PREFERRED_STORE_OPTIONS.map((option) => {
            const selected = option === store;
            return (
              <li key={option} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition ${
                    selected
                      ? 'bg-sky-50 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200'
                      : 'text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ring-1 ${getStoreBadgeClassName(option)}`}
                  >
                    {option}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </span>
  );
}
