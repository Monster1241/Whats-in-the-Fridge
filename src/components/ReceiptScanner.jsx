import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Loader2, ScanLine, Trash2, Upload, X } from 'lucide-react';
import { confirmReceiptScan, scanReceipt } from '../api.js';
import { prepareReceiptFileForUpload } from '../utils/prepareReceiptImage.js';

const ACCEPTED_TYPES =
  'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif';
const RECEIPT_SCAN_SESSION_KEY = 'witf:receipt-scan-pending';
const RECEIPT_CATEGORIES = [
  'Produce',
  'Dairy',
  'Meat',
  'Pantry',
  'Bakery',
  'Frozen',
  'Beverage',
  'Other',
];
const STORAGE_OPTIONS = ['Fridge', 'Freezer', 'Pantry'];

/**
 * @param {File} file
 */
function formatFileLabel(file) {
  const mb = file.size / (1024 * 1024);
  return `${file.name} · ${mb < 0.1 ? '<0.1' : mb.toFixed(1)} MB`;
}

function markReceiptScanPending() {
  try {
    sessionStorage.setItem(
      RECEIPT_SCAN_SESSION_KEY,
      JSON.stringify({ pending: true, at: Date.now() }),
    );
  } catch {
    // sessionStorage may be unavailable in private mode
  }
}

function clearReceiptScanPending() {
  try {
    sessionStorage.removeItem(RECEIPT_SCAN_SESSION_KEY);
  } catch {
    // ignore
  }
}

/**
 * @param {{ replaceItemsFromServer?: (items: unknown[]) => unknown[], onSuccess?: (message: string) => void }} props
 */
export function ReceiptScanner({ replaceItemsFromServer, onSuccess }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [fileLabel, setFileLabel] = useState('');
  const [items, setItems] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const processingRef = useRef(false);

  const resetState = useCallback(() => {
    setPhase('idle');
    setError('');
    setFileLabel('');
    setItems([]);
    setConfirming(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    resetState();
    clearReceiptScanPending();
  }, [resetState]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RECEIPT_SCAN_SESSION_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data?.pending) {
        setOpen(true);
        setPhase('error');
        setError(
          'Your browser refreshed while choosing a photo. Please select the receipt again.',
        );
      }
    } catch {
      clearReceiptScanPending();
    } finally {
      clearReceiptScanPending();
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && phase !== 'scanning' && !confirming) close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, phase, confirming, close]);

  const processFile = useCallback(async (file) => {
    if (!file || processingRef.current) return;
    processingRef.current = true;
    setError('');
    setPhase('scanning');
    markReceiptScanPending();

    try {
      const prepared = await prepareReceiptFileForUpload(file);
      setFileLabel(formatFileLabel(prepared));
      const result = await scanReceipt(prepared);
      clearReceiptScanPending();
      setItems(
        (result.items ?? []).map((item, index) => ({
          ...item,
          clientId: `${item.name}-${index}`,
        })),
      );
      setPhase('review');
    } catch (err) {
      clearReceiptScanPending();
      setPhase('error');
      setError(err.message || 'Could not scan receipt.');
    } finally {
      processingRef.current = false;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const onFileChange = (event) => {
    const file = event.target.files?.[0];
    void processFile(file);
  };

  const onDrop = (event) => {
    event.preventDefault();
    dropRef.current?.classList.remove('ring-2', 'ring-emerald-400');
    const file = event.dataTransfer.files?.[0];
    void processFile(file);
  };

  const openFilePicker = () => {
    markReceiptScanPending();
    fileInputRef.current?.click();
  };

  const updateItem = (clientId, patch) => {
    setItems((prev) =>
      prev.map((item) => (item.clientId === clientId ? { ...item, ...patch } : item)),
    );
  };

  const removeItem = (clientId) => {
    setItems((prev) => prev.filter((item) => item.clientId !== clientId));
  };

  const handleConfirm = async () => {
    if (!items.length || confirming) return;
    setConfirming(true);
    setError('');
    try {
      const payload = items.map(({ clientId, ...item }) => ({
        name: item.name,
        quantity: Number(item.quantity) || 1,
        unit: item.unit ?? '',
        category: item.category,
        storageLocation: item.storageLocation,
        expiryDate: item.expiryDate,
        inventoryCategory: item.inventoryCategory,
      }));
      const result = await confirmReceiptScan(payload);
      replaceItemsFromServer?.(result.items, { restockHistory: result.restockHistory });
      const moved = result.movedFromShoppingCount ?? 0;
      const base = `Added ${result.addedCount ?? payload.length} item${payload.length === 1 ? '' : 's'} to your inventory.`;
      onSuccess?.(
        moved > 0
          ? `${base} ${moved} matched item${moved === 1 ? '' : 's'} removed from your shopping list.`
          : base,
      );
      close();
    } catch (err) {
      setError(err.message || 'Could not add items to inventory.');
    } finally {
      setConfirming(false);
    }
  };

  const modal = open ? (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-scanner-title"
    >
      <div className="surface-card flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-5 py-4 dark:border-white/10">
          <div>
            <h2 id="receipt-scanner-title" className="text-heading text-lg font-bold">
              Scan receipt
            </h2>
            <p className="text-muted mt-1 text-xs leading-relaxed">
              Upload a grocery receipt or invoice — Gemini extracts and normalizes items for your
              pantry.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={phase === 'scanning' || confirming}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
            aria-label="Close receipt scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {phase === 'idle' && (
            <div
              ref={dropRef}
              onDragOver={(event) => {
                event.preventDefault();
                dropRef.current?.classList.add('ring-2', 'ring-emerald-400');
              }}
              onDragLeave={() => {
                dropRef.current?.classList.remove('ring-2', 'ring-emerald-400');
              }}
              onDrop={onDrop}
              className="surface-inset flex flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-300/80 px-6 py-10 text-center dark:border-emerald-800"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Upload className="h-7 w-7" aria-hidden />
              </div>
              <p className="text-heading text-sm font-semibold">Drop receipt here</p>
              <p className="text-muted mt-1 text-xs">
                JPG, PNG, WEBP, HEIC, or PDF · photos are compressed before upload
              </p>
              <button
                type="button"
                onClick={openFilePicker}
                className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 active:scale-[0.98]"
              >
                Choose file
              </button>
            </div>
          )}

          {phase === 'scanning' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-600" aria-hidden />
              <p className="text-heading mt-4 text-sm font-semibold">Scanning receipt…</p>
              <p className="text-muted mt-1 max-w-xs text-xs leading-relaxed">
                {fileLabel
                  ? `Reading ${fileLabel} and normalizing product names with Gemini.`
                  : 'Preparing your photo and extracting grocery items.'}
              </p>
            </div>
          )}

          {(phase === 'review' || phase === 'error') && (
            <>
              {fileLabel && (
                <p className="text-muted mb-3 flex items-center gap-2 text-xs">
                  <FileText className="h-4 w-4 shrink-0" aria-hidden />
                  {fileLabel}
                </p>
              )}

              {error && (
                <p
                  role="alert"
                  className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                >
                  {error}
                </p>
              )}

              {phase === 'review' && items.length === 0 && (
                <p className="text-muted text-center text-sm">No items left to add.</p>
              )}

              {phase === 'review' && items.length > 0 && (
                <ul className="space-y-3">
                  {items.map((item) => (
                    <li
                      key={item.clientId}
                      className="surface-inset rounded-xl p-3"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(event) =>
                            updateItem(item.clientId, { name: event.target.value })
                          }
                          className="input-field min-w-0 flex-1 text-sm font-semibold"
                          aria-label="Item name"
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(item.clientId)}
                          className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-muted mb-1 block text-[10px] font-semibold uppercase">
                            Qty
                          </label>
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={item.quantity}
                            onChange={(event) =>
                              updateItem(item.clientId, { quantity: event.target.value })
                            }
                            className="input-field text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-muted mb-1 block text-[10px] font-semibold uppercase">
                            Unit
                          </label>
                          <input
                            type="text"
                            value={item.unit ?? ''}
                            onChange={(event) =>
                              updateItem(item.clientId, { unit: event.target.value })
                            }
                            placeholder="g, kg, pack"
                            className="input-field text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-muted mb-1 block text-[10px] font-semibold uppercase">
                            Category
                          </label>
                          <select
                            value={item.category}
                            onChange={(event) =>
                              updateItem(item.clientId, { category: event.target.value })
                            }
                            className="input-field text-sm"
                          >
                            {RECEIPT_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-muted mb-1 block text-[10px] font-semibold uppercase">
                            Storage
                          </label>
                          <select
                            value={item.storageLocation}
                            onChange={(event) =>
                              updateItem(item.clientId, { storageLocation: event.target.value })
                            }
                            className="input-field text-sm"
                          >
                            {STORAGE_OPTIONS.map((storage) => (
                              <option key={storage} value={storage}>
                                {storage}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {item.expiryDate && (
                        <p className="text-muted mt-2 text-[11px]">
                          Suggested expiry:{' '}
                          <span className="font-semibold text-amber-700 dark:text-amber-300">
                            {item.expiryDate}
                          </span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {phase === 'error' && (
                <button
                  type="button"
                  onClick={() => {
                    resetState();
                    openFilePicker();
                  }}
                  className="mt-2 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white"
                >
                  Try another photo
                </button>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 border-t border-black/[0.06] px-5 py-4 dark:border-white/10">
          {phase === 'review' ? (
            <>
              <button
                type="button"
                onClick={resetState}
                disabled={confirming}
                className="flex-1 rounded-xl border border-black/[0.08] py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-zinc-200"
              >
                Scan another
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming || items.length === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {confirming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Adding…
                  </>
                ) : (
                  `Add ${items.length} to inventory`
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={close}
              disabled={phase === 'scanning'}
              className="w-full rounded-xl border border-black/[0.08] py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-zinc-200"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="sr-only"
        onChange={onFileChange}
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => {
          resetState();
          setOpen(true);
        }}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 active:scale-[0.99] dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50"
      >
        <ScanLine className="h-4 w-4" aria-hidden />
        Scan receipt / upload invoice
      </button>
      {typeof document !== 'undefined' ? createPortal(modal, document.body) : null}
    </>
  );
}
