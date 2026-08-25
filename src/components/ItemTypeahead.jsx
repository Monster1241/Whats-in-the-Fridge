import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { classifyInventoryItem } from '../api.js';
import {
  filterItemSuggestions,
  hasExactSuggestionMatch,
  shouldRequestAiSuggestion,
} from '../inventory/itemSuggestions.js';
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

const AI_SUGGEST_DEBOUNCE_MS = 450;

export function ItemTypeahead({
  value,
  onChange,
  onPick,
  onBarcodeResolved,
  onKnowledgeUpdate,
  enabledModules,
  itemKnowledge,
  preferredItemType,
  placeholder,
  inputClassName = 'input-field min-w-0 flex-1',
  id: idProp,
  enableBarcodeScan = false,
  enableAiSuggest = true,
}) {
  const autoId = useId();
  const inputId = idProp || `item-typeahead-${autoId}`;
  const listId = `${inputId}-listbox`;
  const rootRef = useRef(null);
  const lookupAbortRef = useRef(0);
  const aiAbortRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [barcodeLookingUp, setBarcodeLookingUp] = useState(false);
  const [barcodeUnknown, setBarcodeUnknown] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiError, setAiError] = useState(false);

  const matches = useMemo(
    () => filterItemSuggestions(value, enabledModules, 8, itemKnowledge),
    [value, enabledModules, itemKnowledge],
  );

  const displayMatches = useMemo(() => {
    if (!aiSuggestion) return matches;
    const aiKey = `${aiSuggestion.name}|${aiSuggestion.itemType}`;
    if (matches.some((entry) => `${entry.name}|${entry.itemType}` === aiKey)) {
      return matches;
    }
    return [aiSuggestion, ...matches].slice(0, 8);
  }, [aiSuggestion, matches]);

  const inputPlaceholder = barcodeUnknown ? BARCODE_UNKNOWN_PLACEHOLDER : placeholder;
  const inputValue = barcodeLookingUp ? BARCODE_LOOKUP_LOADING_TEXT : value;

  useEffect(() => {
    setHighlight(0);
  }, [value, displayMatches.length]);

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!enableAiSuggest || barcodeLookingUp) {
      setAiSuggestion(null);
      setAiBusy(false);
      setAiError(false);
      return undefined;
    }

    const trimmed = value.trim();
    if (!shouldRequestAiSuggestion(trimmed, matches)) {
      aiAbortRef.current += 1;
      setAiSuggestion(null);
      setAiBusy(false);
      setAiError(false);
      return undefined;
    }

    const requestId = aiAbortRef.current + 1;
    aiAbortRef.current = requestId;
    setAiBusy(true);
    setAiError(false);

    const timer = window.setTimeout(async () => {
      try {
        const ai = await classifyInventoryItem(trimmed, {
          itemType: preferredItemType,
          remember: false,
        });
        if (aiAbortRef.current !== requestId) return;
        if (hasExactSuggestionMatch(trimmed, matches)) {
          setAiSuggestion(null);
          return;
        }
        setAiSuggestion({
          name: ai.name ?? trimmed,
          itemType: ai.itemType,
          category: ai.category,
          subCategory: ai.subCategory,
          source: 'ai',
        });
      } catch {
        if (aiAbortRef.current !== requestId) return;
        setAiSuggestion(null);
        setAiError(true);
      } finally {
        if (aiAbortRef.current === requestId) {
          setAiBusy(false);
        }
      }
    }, AI_SUGGEST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, matches, preferredItemType, enableAiSuggest, barcodeLookingUp]);

  const pick = async (entry) => {
    setBarcodeUnknown(false);
    setScanFeedback(null);
    onChange(entry.name);
    onPick?.(entry);
    setOpen(false);

    if (entry.source === 'ai' && onKnowledgeUpdate) {
      try {
        const ai = await classifyInventoryItem(entry.name, {
          itemType: entry.itemType ?? preferredItemType,
          remember: true,
        });
        if (Array.isArray(ai.itemKnowledge)) {
          onKnowledgeUpdate(ai.itemKnowledge, ai.usageInsights);
        }
      } catch {
        // Add flow will still classify on submit if needed.
      }
    }
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
          detail: 'Type the product name — AI will help find and categorise it.',
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
    !barcodeLookingUp &&
    open &&
    value.trim().length > 0 &&
    (displayMatches.length > 0 || aiBusy);

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
                setHighlight((i) => (i + 1) % Math.max(displayMatches.length, 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight(
                  (i) => (i - 1 + Math.max(displayMatches.length, 1)) % Math.max(displayMatches.length, 1),
                );
              } else if (e.key === 'Enter' && displayMatches[highlight]) {
                e.preventDefault();
                pick(displayMatches[highlight]);
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
            aria-busy={barcodeLookingUp || aiBusy}
            autoComplete="off"
          />

          {showMenu && (
            <ul
              id={listId}
              role="listbox"
              className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-black/[0.08] bg-lm-raised py-1 shadow-lg dark:border-slate-600 dark:bg-dm-card"
            >
              {aiBusy && displayMatches.length === 0 && (
                <li className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-600" aria-hidden />
                    Finding item with AI…
                  </span>
                </li>
              )}
              {displayMatches.map((entry, index) => {
                const meta = getCategoryMeta(entry.category, entry.itemType);
                const subMeta = getSubcategoryMeta(
                  entry.subCategory,
                  entry.itemType,
                  entry.category,
                );
                const active = index === highlight;
                const isAi = entry.source === 'ai';
                const isLearned = entry.source === 'learned';
                return (
                  <li key={`${entry.name}-${entry.category}-${entry.source ?? 'catalog'}`} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => pick(entry)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition ${
                        active
                          ? isAi
                            ? 'bg-violet-50 text-violet-950 dark:bg-violet-950/60 dark:text-violet-100'
                            : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100'
                          : 'text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-medium">
                          {(isAi || isLearned) && (
                            <Sparkles
                              className={`h-3.5 w-3.5 shrink-0 ${isAi ? 'text-violet-600' : 'text-emerald-600'}`}
                              aria-hidden
                            />
                          )}
                          <span className="truncate">{entry.name}</span>
                        </span>
                        <span className="text-muted mt-0.5 flex items-center gap-1 text-[10px] font-semibold">
                          <MetaIcon name={subMeta.label} className="h-3 w-3" /> {subMeta.label}
                          {isAi ? ' · AI suggestion' : isLearned ? ' · Saved before' : ''}
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
              {aiError && displayMatches.length === 0 && !aiBusy && (
                <li className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  AI lookup unavailable — you can still add the item manually.
                </li>
              )}
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
