import { useEffect, useId, useRef, useState } from 'react';
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

/**
 * Prefer rear / environment camera when multiple devices exist.
 * @param {import('html5-qrcode').CameraDevice[]} cameras
 */
function pickRearCameraId(cameras) {
  if (!cameras?.length) return null;
  const back = cameras.find((c) =>
    /back|rear|environment|trás|arrière/i.test(c.label || ''),
  );
  if (back) return back.id;
  if (cameras.length === 1) return cameras[0].id;
  return cameras[cameras.length - 1].id;
}

export function BarcodeScanner({ open, onClose, onScan }) {
  const regionId = useId().replace(/:/g, '');
  const scannerRef = useRef(null);
  const handledRef = useRef(false);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const [status, setStatus] = useState('idle');
  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      setStatus('idle');
      return undefined;
    }

    handledRef.current = false;
    let cancelled = false;

    (async () => {
      setStatus('starting');
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

      if (cancelled) return;

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
      ];

      const scanner = new Html5Qrcode(regionId, { verbose: false });
      scannerRef.current = scanner;

      const scanConfig = {
        fps: 12,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const width = Math.floor(Math.min(viewfinderWidth * 0.92, 360));
          const height = Math.floor(Math.min(viewfinderHeight * 0.38, 130));
          return { width: Math.max(width, 220), height: Math.max(height, 80) };
        },
        aspectRatio: 1.7777778,
        formatsToSupport,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };

      const onDecoded = (decodedText) => {
        if (handledRef.current || cancelled) return;
        handledRef.current = true;
        const code = normalizeBarcodeScan(decodedText);
        scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            scanner.clear().catch(() => {});
            scannerRef.current = null;
            onScanRef.current(code);
            onCloseRef.current();
          });
      };

      try {
        let cameraIdOrConfig = { facingMode: { ideal: 'environment' } };
        try {
          const cameras = await Html5Qrcode.getCameras();
          const rearId = pickRearCameraId(cameras);
          if (rearId) cameraIdOrConfig = rearId;
        } catch {
          // use facingMode fallback
        }

        await scanner.start(cameraIdOrConfig, scanConfig, onDecoded, () => {});
        if (!cancelled) setStatus('scanning');
      } catch (err) {
        console.error('Barcode scanner start failed', err);
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => scanner.clear().catch(() => {}));
      }
    };
  }, [open, regionId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-slate-950"
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

      <p className="shrink-0 px-4 py-2 text-center text-xs text-slate-400">
        {status === 'starting' && 'Starting rear camera…'}
        {status === 'error' && 'Could not open camera. Check permissions and try again.'}
        {status === 'scanning' && 'Align the barcode inside the frame'}
        {status === 'idle' && 'Point at the product barcode'}
      </p>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div
          id={regionId}
          className="barcode-scanner-view w-full max-w-lg [&_video]:!h-full [&_video]:!w-full [&_video]:object-cover"
        />
      </div>
    </div>
  );
}
