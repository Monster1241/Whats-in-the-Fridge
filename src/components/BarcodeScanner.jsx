import { useLayoutEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

const READER_ID = 'barcode-scanner-reader';

/** @type {Promise<void>|null} */
let cameraReleasePromise = null;

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
 * @param {HTMLElement} el
 * @param {number} [timeoutMs]
 */
async function waitForElementSize(el, timeoutMs = 4000) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    if (el.clientWidth >= 120 && el.clientHeight >= 120) return true;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return el.clientWidth > 0 && el.clientHeight > 0;
}

/**
 * @param {import('html5-qrcode').Html5Qrcode} scanner
 */
async function stopScanner(scanner) {
  try {
    const { Html5QrcodeScannerState } = await import('html5-qrcode');
    const state = scanner.getState();
    if (
      state === Html5QrcodeScannerState.SCANNING
      || state === Html5QrcodeScannerState.PAUSED
    ) {
      await scanner.stop();
    }
  } catch {
    try {
      await scanner.stop();
    } catch {
      // already stopped
    }
  }
  try {
    scanner.clear();
  } catch {
    // ignore
  }
}

export function BarcodeScanner({ open, onClose, onScan }) {
  const containerRef = useRef(null);
  const scannerRef = useRef(null);
  const runIdRef = useRef(0);
  const handledRef = useRef(false);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const [status, setStatus] = useState('idle');

  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    if (!open) {
      setStatus('idle');
      return undefined;
    }

    handledRef.current = false;
    const runId = ++runIdRef.current;
    const container = containerRef.current;
    if (!container) return undefined;

    container.id = READER_ID;
    let active = true;

    const teardown = async (scanner) => {
      if (!scanner) return;
      scannerRef.current = null;
      const release = stopScanner(scanner);
      cameraReleasePromise = release;
      await release;
      if (cameraReleasePromise === release) {
        cameraReleasePromise = null;
      }
    };

    (async () => {
      setStatus('starting');

      if (cameraReleasePromise) {
        try {
          await cameraReleasePromise;
        } catch {
          // ignore
        }
      }

      const sized = await waitForElementSize(container);
      if (!active || runId !== runIdRef.current) return;
      if (!sized) {
        setStatus('error');
        return;
      }

      const {
        Html5Qrcode,
        Html5QrcodeSupportedFormats,
        Html5QrcodeScannerState,
      } = await import('html5-qrcode');

      if (!active || runId !== runIdRef.current) return;

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
      ];

      const scanner = new Html5Qrcode(READER_ID, { verbose: false });
      scannerRef.current = scanner;

      const scanConfig = {
        fps: 10,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const maxW = Math.max(160, Math.floor(viewfinderWidth * 0.88));
          const maxH = Math.max(56, Math.floor(viewfinderHeight * 0.32));
          return {
            width: Math.min(maxW, 320),
            height: Math.min(maxH, 130),
          };
        },
        formatsToSupport,
      };

      const onDecoded = (decodedText) => {
        if (handledRef.current || runId !== runIdRef.current) return;
        handledRef.current = true;
        const code = normalizeBarcodeScan(decodedText);
        teardown(scanner).finally(() => {
          onScanRef.current(code);
          onCloseRef.current();
        });
      };

      try {
        await scanner.start(
          { facingMode: 'environment' },
          scanConfig,
          onDecoded,
          () => {},
        );

        if (!active || runId !== runIdRef.current) {
          await teardown(scanner);
          return;
        }

        if (scanner.getState() === Html5QrcodeScannerState.SCANNING) {
          setStatus('scanning');
        }
      } catch (firstErr) {
        if (!active || runId !== runIdRef.current) {
          await teardown(scanner);
          return;
        }

        try {
          const cameras = await Html5Qrcode.getCameras();
          const rear = cameras?.length
            ? cameras.find((c) => /back|rear|environment/i.test(c.label || ''))
              ?? cameras[cameras.length - 1]
            : null;

          if (!rear?.id) throw firstErr;

          await scanner.start(rear.id, scanConfig, onDecoded, () => {});

          if (!active || runId !== runIdRef.current) {
            await teardown(scanner);
            return;
          }

          setStatus('scanning');
        } catch (err) {
          console.error('Barcode scanner start failed', err);
          await teardown(scanner);
          if (active && runId === runIdRef.current) setStatus('error');
        }
      }
    })();

    return () => {
      active = false;
      runIdRef.current += 1;
      const scanner = scannerRef.current;
      if (scanner) {
        teardown(scanner);
      }
    };
  }, [open]);

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
        {status === 'scanning' && 'Align the barcode inside the green frame'}
        {status === 'idle' && 'Point at the product barcode'}
      </p>

      <div className="flex min-h-0 flex-1 flex-col px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div
          ref={containerRef}
          className="barcode-scanner-view mx-auto w-full max-w-lg flex-1"
          aria-hidden={status === 'error'}
        />
      </div>
    </div>
  );
}
