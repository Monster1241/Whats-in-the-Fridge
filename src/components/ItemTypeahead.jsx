import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { filterItemSuggestions } from '../inventory/itemSuggestions.js';
import { getCategoryMeta } from '../inventory/constants.js';
import {
  BARCODE_LOOKUP_LOADING_TEXT,
  BARCODE_UNKNOWN_PLACEHOLDER,
  lookupBarcode,
  vibrateBarcodeUnknown,
} from '../inventory/barcodeLookup.js';
import { BarcodeScanner } from './BarcodeScanner.jsx';

export function ItemTypeahead({
  value,
  onChange,
  onPick,
  onBarcodeResolved,
  enabledModules,
  placeholder,
  inputClassName = 'input-field min-w-0 flex-1',
  id: idProp,
  enableBarcodeScan = false,
}) {
  const autoId = useId();
  const inputId = idProp || `item-typeahead-${autoId}`;
  const listId = `${inputId}-listbox`;
  const rootRef = useRef(null);
  const lookupAbortRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [barcodeLookingUp, setBarcodeLookingUp] = useState(false);
  const [barcodeUnknown, setBarcodeUnknown] = useState(false);

  const matches = useMemo(
    () => filterItemSuggestions(value, enabledModules),
    [value, enabledModules],
  );

  const inputPlaceholder = barcodeUnknown ? BARCODE_UNKNOWN_PLACEHOLDER : placeholder;
  const inputValue = barcodeLookingUp ? BARCODE_LOOKUP_LOADING_TEXT : value;

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
    setBarcodeUnknown(false);
    onChange(entry.name);
    onPick?.(entry);
    setOpen(false);
  };

  const handleBarcodeScan = async (code) => {
    const lookupId = lookupAbortRef.current + 1;
    lookupAbortRef.current = lookupId;
    setBarcodeUnknown(false);
    setBarcodeLookingUp(true);
    onChange(BARCODE_LOOKUP_LOADING_TEXT);
    setOpen(false);

    try {
      const result = await lookupBarcode(code);
      if (lookupAbortRef.current !== lookupId) return;

      if (result) {
        onChange(result.name);
        onBarcodeResolved?.(result);
        setOpen(true);
      } else {
        onChange('');
        setBarcodeUnknown(true);
        vibrateBarcodeUnknown();
        onBarcodeResolved?.(null);
      }
    } catch {
      if (lookupAbortRef.current !== lookupId) return;
      onChange('');
      setBarcodeUnknown(true);
      vibrateBarcodeUnknown();
      onBarcodeResolved?.(null);
    } finally {
      if (lookupAbortRef.current === lookupId) {
        setBarcodeLookingUp(false);
      }
    }
  };

  const showMenu =
    !barcodeLookingUp && open && value.trim().length > 0 && matches.length > 0;

  return (
    <>
      <div className="relative flex min-w-0 flex-1 items-stretch gap-1.5">
        <div ref={rootRef} className="relative min-w-0 flex-1">
          <input
            id={inputId}
            type="text"
            inputMode="text"
            value={inputValue}
            readOnly={barcodeLookingUp}
            onChange={(e) => {
              if (barcodeLookingUp) return;
              setBarcodeUnknown(false);
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              if (!barcodeLookingUp) setOpen(true);
            }}
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
            placeholder={inputPlaceholder}
            className={`${inputClassName}${barcodeLookingUp ? ' text-slate-400 italic' : ''}`}
            role="combobox"
            aria-expanded={showMenu}
            aria-controls={showMenu ? listId : undefined}
            aria-autocomplete="list"
            aria-busy={barcodeLookingUp}
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
                        {entry.itemType === 'Household' ? '🏠' : entry.itemType === 'Baby' ? '👶' : '🍽️'}{' '}
                        {meta?.label ?? entry.category}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {enableBarcodeScan && (
          <button
            type="button"
            disabled={barcodeLookingUp}
            onClick={() => setScannerOpen(true)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-emerald-700 shadow-sm transition active:scale-95 hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-emerald-400 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40"
            aria-label="Scan barcode"
            title="Scan barcode"
          >
            <Camera className="h-5 w-5" />
          </button>
        )}
      </div>

      {enableBarcodeScan && (
        <BarcodeScanner
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={handleBarcodeScan}
        />
      )}
    </>
  );
}
