import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2 } from 'lucide-react';
import { filterItemSuggestions } from '../inventory/itemSuggestions.js';
import { getCategoryMeta } from '../inventory/constants.js';
import { getSubcategoryMeta } from '../inventory/subcategories.js';
import {
  BARCODE_LOOKUP_LOADING_TEXT,
  BARCODE_UNKNOWN_PLACEHOLDER,
  lookupBarcode,
  vibrateBarcodeUnknown,
} from '../inventory/barcodeLookup.js';
import { BarcodeScanner } from './BarcodeScanner.jsx';
import { MetaIcon } from './MetaIcon.jsx';

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
  const [scanFeedback, setScanFeedback] = useState(null);

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
    setScanFeedback(null);
    onChange(entry.name);
    onPick?.(entry);
    setOpen(false);
  };

  const handleBarcodeScan = async (code) => {
    const lookupId = lookupAbortRef.current + 1;
    lookupAbortRef.current = lookupId;
    setBarcodeUnknown(false);
    setScanFeedback(null);
    setBarcodeLookingUp(true);
    onChange(BARCODE_LOOKUP_LOADING_TEXT);
    setOpen(false);

    try {
      const result = await lookupBarcode(code);
      if (lookupAbortRef.current !== lookupId) return;

      if (result) {
        onChange(result.name);
        const catMeta = getCategoryMeta(result.category, result.itemType);
        const subMeta = getSubcategoryMeta(
          result.subCategory,
          result.itemType,
          result.category,
        );
        setScanFeedback({
          type: 'success',
          title: result.name,
          detail: [
            result.isAustralian ? 'Australian product' : 'Product found',
            catMeta?.label,
            subMeta.label,
            result.expiryHint,
          ]
            .filter(Boolean)
            .join(' · '),
        });
        onBarcodeResolved?.(result);
      } else {
        onChange('');
        setBarcodeUnknown(true);
        setScanFeedback({
          type: 'unknown',
          title: 'Barcode not in database',
          detail: 'Type the product name — we’ll still auto-categorise it for you.',
        });
        vibrateBarcodeUnknown();
        onBarcodeResolved?.(null);
      }
    } catch {
      if (lookupAbortRef.current !== lookupId) return;
      onChange('');
      setBarcodeUnknown(true);
      setScanFeedback({
        type: 'unknown',
        title: 'Lookup failed',
        detail: 'Check your connection or type the item name manually.',
      });
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
              setScanFeedback(null);
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
              className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-black/[0.08] bg-lm-raised py-1 shadow-lg dark:border-slate-600 dark:bg-dm-card"
            >
              {matches.map((entry, index) => {
                const meta = getCategoryMeta(entry.category, entry.itemType);
                const subMeta = getSubcategoryMeta(
                  entry.subCategory,
                  entry.itemType,
                  entry.category,
                );
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
                      <span className="min-w-0">
                        <span className="block font-medium">{entry.name}</span>
                        <span className="text-muted mt-0.5 flex items-center gap-1 text-[10px] font-semibold">
                          <MetaIcon name={subMeta.label} className="h-3 w-3" /> {subMeta.label}
                        </span>
                      </span>
                      <span className="text-muted flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
                        <MetaIcon
                          name={
                            entry.itemType === 'Household'
                              ? 'Household'
                              : entry.itemType === 'Baby'
                                ? 'Baby'
                                : 'Food'
                          }
                          className="h-3 w-3"
                        />
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
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition active:scale-95 hover:border-emerald-400 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
            aria-label="Scan product barcode"
            title="Scan barcode (AU products)"
          >
            <Camera className="h-5 w-5" />
          </button>
        )}
      </div>

      {barcodeLookingUp && (
        <p className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" aria-hidden />
          Searching AU &amp; global product databases…
        </p>
      )}

      {scanFeedback && !barcodeLookingUp && (
        <p
          role="status"
          className={`mt-2 rounded-xl px-3 py-2 text-xs leading-snug ${
            scanFeedback.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
              : 'border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
          }`}
        >
          {scanFeedback.type === 'success' && (
            <CheckCircle2 className="mb-0.5 inline h-3.5 w-3.5 shrink-0" aria-hidden />
          )}{' '}
          <span className="font-bold">{scanFeedback.title}</span>
          {scanFeedback.detail && (
            <span className="mt-0.5 block font-medium opacity-90">{scanFeedback.detail}</span>
          )}
        </p>
      )}

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
