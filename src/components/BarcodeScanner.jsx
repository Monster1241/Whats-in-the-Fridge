import { useEffect, useId, useRef } from 'react';
import { Camera, X } from 'lucide-react';

/**
 * Extract EAN/UPC-style numeric code from decoded barcode text.
 * @param {string} raw
 */
export function normalizeBarcodeScan(raw) {
  const trimmed = String(raw || '').trim();
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 8 ? digits : trimmed;
}

export function BarcodeScanner({ open, onClose, onScan }) {
  const regionId = useId().replace(/:/g, '');
  const scannerRef = useRef(null);
  const handledRef = useRef(false);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    handledRef.current = false;
    let cancelled = false;

    (async () => {
      const {
        Html5QrcodeScanner,
        Html5QrcodeSupportedFormats,
      } = await import('html5-qrcode');

      if (cancelled) return;

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
      ];

      const config = {
        fps: 10,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const width = Math.floor(Math.min(viewfinderWidth * 0.88, 320));
          const height = Math.floor(Math.min(viewfinderHeight * 0.32, 110));
          return { width: Math.max(width, 200), height: Math.max(height, 72) };
        },
        aspectRatio: 1.7777778,
        rememberLastUsedCamera: true,
        formatsToSupport,
      };

      const scanner = new Html5QrcodeScanner(regionId, config, false);
      scannerRef.current = scanner;

      scanner.render(
        (decodedText) => {
          if (handledRef.current || cancelled) return;
          handledRef.current = true;
          const code = normalizeBarcodeScan(decodedText);
          onScanRef.current(code);
          onCloseRef.current();
        },
        () => {
          // ignore per-frame scan misses
        },
      );
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner.clear().catch(() => {});
      }
    };
  }, [open, regionId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-slate-950/95"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-scanner-title"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-emerald-400" aria-hidden />
          <h2 id="barcode-scanner-title" className="text-sm font-bold text-white">
            Scan barcode
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          aria-label="Close scanner"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <p className="text-muted shrink-0 px-4 py-2 text-center text-xs text-slate-400">
        Point your camera at the product barcode. EAN / UPC codes work best.
      </p>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div
          id={regionId}
          className="barcode-scanner-host w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-black shadow-2xl [&_video]:rounded-xl"
        />
      </div>
    </div>
  );
}
