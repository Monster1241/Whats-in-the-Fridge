import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Flashlight, FlashlightOff, Keyboard, X } from 'lucide-react';
import { vibrateBarcodeSuccess } from '../inventory/barcodeLookup.js';

/** @type {Promise<void>|null} */
let cameraReleasePromise = null;

const CAMERA_RELEASE_DELAY_MS = 350;

/**
 * Extract EAN/UPC-style numeric code from decoded barcode text.
 * @param {string} raw
 */
export function normalizeBarcodeScan(raw) {
  const trimmed = String(raw || '').trim();
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 8 ? digits : trimmed;
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * @param {HTMLElement} el
 * @param {number} [timeoutMs]
 */
async function waitForElementSize(el, timeoutMs = 5000) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    const { clientWidth, clientHeight } = el;
    if (clientWidth >= 120 && clientHeight >= 120) return true;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  const { clientWidth, clientHeight } = el;
  return clientWidth > 0 && clientHeight > 0;
}

/**
 * @param {unknown} err
 */
function formatCameraError(err) {
  const message = String(err?.message ?? err ?? '').trim();
  const lower = message.toLowerCase();

  if (!window.isSecureContext) {
    return 'Camera needs a secure connection (HTTPS). Open the app via https:// or localhost.';
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'This browser does not support camera access. Try Chrome or Safari, or type the barcode below.';
  }
  if (/permission|denied|notallowed|not allowed/i.test(lower)) {
    return 'Camera permission denied. Allow camera access in browser settings, then try again.';
  }
  if (/notfound|no camera|devices not found/i.test(lower)) {
    return 'No camera found on this device. Type the barcode number below instead.';
  }
  if (/in use|busy|notreadable|track started/i.test(lower)) {
    return 'Camera is in use by another app. Close it and try again.';
  }
  if (message) return message.split('\n')[0];
  return 'Could not start the camera. Type the barcode number below instead.';
}

/**
 * @param {import('html5-qrcode').Html5Qrcode} scanner
 */
async function stopScanner(scanner) {
  if (!scanner) return;

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
    // Scanner may never have reached SCANNING — safe to ignore.
  }

  try {
    scanner.clear();
  } catch {
    // ignore
  }
}

/**
 * @param {import('html5-qrcode').Html5Qrcode} scanner
 * @param {object} scanConfig
 * @param {(text: string) => void} onDecoded
 */
async function startScannerWithFallbacks(scanner, scanConfig, onDecoded) {
  const { Html5Qrcode } = await import('html5-qrcode');
  const noop = () => {};

  /** @type {Array<string | { facingMode: string }>} */
  const cameraAttempts = [
    { facingMode: 'environment' },
    { facingMode: 'user' },
  ];

  try {
    const cameras = await Html5Qrcode.getCameras();
    const rear = cameras?.find((camera) => /back|rear|environment/i.test(camera.label || ''));
    const fallback = cameras?.length ? cameras[cameras.length - 1] : null;
    if (rear?.id) cameraAttempts.unshift(rear.id);
    else if (fallback?.id) cameraAttempts.unshift(fallback.id);
  } catch {
    // enumerateDevices may fail before permission — facingMode attempts still run.
  }

  let lastError = null;
  for (const camera of cameraAttempts) {
    try {
      await scanner.start(camera, scanConfig, onDecoded, noop);
      return;
    } catch (err) {
      lastError = err;
      try {
        await stopScanner(scanner);
      } catch {
        // ignore
      }
      await sleep(120);
    }
  }

  throw lastError ?? new Error('Could not start camera');
}

export function BarcodeScanner({ open, onClose, onScan }) {
  const readerId = useId().replace(/:/g, '');
  const containerRef = useRef(null);
  const scannerRef = useRef(null);
  const runIdRef = useRef(0);
  const handledRef = useRef(false);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);

  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  const submitManual = () => {
    const code = normalizeBarcodeScan(manualCode);
    if (code.length < 8) return;
    handledRef.current = true;
    vibrateBarcodeSuccess();
    onScanRef.current(code);
    onCloseRef.current();
  };

  const toggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner || !torchSupported) return;
    try {
      const next = !torchOn;
      await scanner.applyVideoConstraints({
        advanced: [{ torch: next }],
      });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
      setTorchOn(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setStatus('idle');
      setErrorMessage('');
      setTorchOn(false);
      setTorchSupported(false);
      setManualCode('');
      setShowManual(false);
      return undefined;
    }

    handledRef.current = false;
    const runId = ++runIdRef.current;
    let active = true;

    const teardown = async (scanner) => {
      if (!scanner) return;
      scannerRef.current = null;
      const release = (async () => {
        await stopScanner(scanner);
        await sleep(CAMERA_RELEASE_DELAY_MS);
      })();
      cameraReleasePromise = release;
      await release;
      if (cameraReleasePromise === release) {
        cameraReleasePromise = null;
      }
    };

    (async () => {
      setStatus('starting');
      setErrorMessage('');
      setShowManual(false);

      if (cameraReleasePromise) {
        try {
          await cameraReleasePromise;
        } catch {
          // ignore
        }
      }

      // Wait for portal paint + layout (flex children need a frame to size).
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (!active || runId !== runIdRef.current) return;

      const container = containerRef.current;
      if (!container) {
        setStatus('error');
        setErrorMessage('Scanner view failed to load. Try again or enter the barcode manually.');
        setShowManual(true);
        return;
      }

      container.id = readerId;

      const sized = await waitForElementSize(container);
      if (!active || runId !== runIdRef.current) return;
      if (!sized) {
        setStatus('error');
        setErrorMessage('Scanner view is too small. Rotate your phone or enter the barcode manually.');
        setShowManual(true);
        return;
      }

      if (!window.isSecureContext) {
        setStatus('error');
        setErrorMessage(formatCameraError(new Error('insecure context')));
        setShowManual(true);
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setErrorMessage(formatCameraError(new Error('getUserMedia not supported')));
        setShowManual(true);
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

      const scanner = new Html5Qrcode(readerId, { verbose: false });
      scannerRef.current = scanner;

      const scanConfig = {
        fps: 10,
        disableFlip: false,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const width = Math.min(Math.floor(viewfinderWidth * 0.92), 340);
          const height = Math.min(Math.max(72, Math.floor(width * 0.38)), 150);
          return { width, height };
        },
        formatsToSupport,
      };

      const onDecoded = (decodedText) => {
        if (handledRef.current || runId !== runIdRef.current) return;
        handledRef.current = true;
        const code = normalizeBarcodeScan(decodedText);
        vibrateBarcodeSuccess();
        teardown(scanner).finally(() => {
          onScanRef.current(code);
          onCloseRef.current();
        });
      };

      try {
        await startScannerWithFallbacks(scanner, scanConfig, onDecoded);

        if (!active || runId !== runIdRef.current) {
          await teardown(scanner);
          return;
        }

        if (scanner.getState() === Html5QrcodeScannerState.SCANNING) {
          setStatus('scanning');
          try {
            const caps = scanner.getRunningTrackCameraCapabilities();
            setTorchSupported(Boolean(caps?.torch));
          } catch {
            setTorchSupported(false);
          }
        }
      } catch (err) {
        console.error('Barcode scanner start failed', err);
        await teardown(scanner);
        if (active && runId === runIdRef.current) {
          setStatus('error');
          setErrorMessage(formatCameraError(err));
          setShowManual(true);
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
  }, [open, readerId]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-slate-950"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-scanner-title"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-emerald-400" aria-hidden />
          <div>
            <h2 id="barcode-scanner-title" className="text-sm font-bold text-white">
              Scan product barcode
            </h2>
            <p className="text-[10px] text-slate-400">Australian products · Open Food Facts</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {torchSupported && status === 'scanning' && (
            <button
              type="button"
              onClick={toggleTorch}
              className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
              aria-label={torchOn ? 'Turn torch off' : 'Turn torch on'}
            >
              {torchOn ? (
                <FlashlightOff className="h-5 w-5" aria-hidden />
              ) : (
                <Flashlight className="h-5 w-5" aria-hidden />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <p className="shrink-0 px-4 py-2 text-center text-xs text-slate-400">
        {status === 'starting' && 'Starting camera… allow access if prompted'}
        {status === 'error' && (errorMessage || 'Camera unavailable — enter the barcode below.')}
        {status === 'scanning' && 'Centre the barcode in the frame — we’ll look it up automatically'}
        {status === 'idle' && 'Point at the barcode on the pack'}
      </p>

      <div className="relative flex min-h-0 flex-1 flex-col px-3 pb-2">
        <div className="relative mx-auto flex h-full w-full max-w-lg flex-1 flex-col">
          <div
            ref={containerRef}
            className="barcode-scanner-view w-full flex-1"
            style={{ minHeight: 'min(52dvh, 420px)' }}
            aria-hidden={status === 'error'}
          />
          {status === 'scanning' && (
            <div className="barcode-scanner-overlay pointer-events-none" aria-hidden>
              <div className="barcode-scanner-frame" />
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-800 bg-slate-950 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setShowManual((value) => !value)}
          className="mb-2 flex w-full items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
        >
          <Keyboard className="h-4 w-4" aria-hidden />
          {showManual ? 'Hide manual entry' : 'Type barcode number instead'}
        </button>
        {(showManual || status === 'error') && (
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 14))}
              placeholder="e.g. 9300601234567"
              className="input-field min-w-0 flex-1 border-slate-700 bg-slate-900 text-white placeholder:text-slate-500"
              aria-label="Barcode number"
            />
            <button
              type="button"
              onClick={submitManual}
              disabled={normalizeBarcodeScan(manualCode).length < 8}
              className="rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-40"
            >
              Look up
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
