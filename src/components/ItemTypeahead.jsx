import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { filterItemSuggestions } from '../inventory/itemSuggestions.js';
import { getCategoryMeta } from '../inventory/constants.js';

export function ItemTypeahead({
  value,
  onChange,
  onPick,
  placeholder,
  inputClassName = 'input-field min-w-0 flex-1',
  id: idProp,
}) {
  const autoId = useId();
  const inputId = idProp || `item-typeahead-${autoId}`;
  const listId = `${inputId}-listbox`;
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const matches = useMemo(() => filterItemSuggestions(value), [value]);

  useEffect(() => {
    setHighlight(0);
  }, [value, matches.length]);

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (entry) => {
    onChange(entry.name);
    onPick?.(entry);
    setOpen(false);
  };

  const showMenu = open && value.trim().length > 0 && matches.length > 0;

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showMenu) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((i) => (i + 1) % matches.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((i) => (i - 1 + matches.length) % matches.length);
          } else if (e.key === 'Enter' && matches[highlight]) {
            e.preventDefault();
            pick(matches[highlight]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className={inputClassName}
        role="combobox"
        aria-expanded={showMenu}
        aria-controls={showMenu ? listId : undefined}
        aria-autocomplete="list"
        autoComplete="off"
      />

      {showMenu && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
        >
          {matches.map((entry, index) => {
            const meta = getCategoryMeta(entry.category, entry.itemType);
            const active = index === highlight;
            return (
              <li key={`${entry.name}-${entry.category}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => pick(entry)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition ${
                    active
                      ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100'
                      : 'text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="font-medium">{entry.name}</span>
                  <span className="text-muted shrink-0 text-[10px] font-semibold uppercase tracking-wide">
                    {entry.itemType === 'Household' ? '🏠' : '🍽️'} {meta?.label ?? entry.category}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
