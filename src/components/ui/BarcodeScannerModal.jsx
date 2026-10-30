'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  X,
  RefreshCw,
  AlertCircle,
  Flashlight,
  SwitchCamera,
  CheckCircle2,
} from 'lucide-react';
import { Button } from './Button';

const VIEWPORT_ID = 'sm-barcode-scanner-viewport';

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Barcode / QR Code',
  description = 'Point your camera at a barcode to scan automatically',
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState(0);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const scannerRef = useRef(null);
  const hasScannedRef = useRef(false);
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);

  // Play audio beep on successful scan
  const playScanBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.14);
    } catch (e) {
      // AudioContext may be blocked or unsupported; ignore silently
    }
  };

  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
        scanner.clear();
      } catch (err) {
        console.warn('BarcodeScanner: Error stopping scanner:', err);
      } finally {
        scannerRef.current = null;
      }
    }
    isStoppingRef.current = false;
  }, []);

  const handleScanSuccess = useCallback(
    async (decodedText) => {
      // Prevent duplicate scan execution
      if (hasScannedRef.current) return;
      hasScannedRef.current = true;

      playScanBeep();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(90);
        } catch (e) {}
      }

      // Stop camera before closing
      await stopScanner();

      if (onScan) {
        onScan(decodedText.trim());
      }
      if (onClose) {
        onClose();
      }
    },
    [onScan, onClose, stopScanner]
  );

  const startScanner = useCallback(
    async (preferredCameraId = null) => {
      if (isStartingRef.current || !isOpen) return;
      isStartingRef.current = true;
      setLoading(true);
      setError(null);
      setErrorType(null);
      hasScannedRef.current = false;

      try {
        await stopScanner();

        // Dynamically import html5-qrcode for client-side execution only
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

        // Check if DOM container is present
        const viewportEl = document.getElementById(VIEWPORT_ID);
        if (!viewportEl) {
          throw new Error('Scanner container element not found.');
        }

        // Enumerate cameras if available
        let availableCameras = [];
        try {
          availableCameras = await Html5Qrcode.getCameras();
          setCameras(availableCameras || []);
        } catch (e) {
          console.warn('Unable to query camera devices:', e);
        }

        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ];

        const scanner = new Html5Qrcode(VIEWPORT_ID, {
          formatsToSupport,
          verbose: false,
        });
        scannerRef.current = scanner;

        const scanConfig = {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.min(Math.floor(viewfinderWidth * 0.82), 300);
            const height = Math.min(Math.floor(viewfinderHeight * 0.62), 170);
            return { width, height };
          },
          aspectRatio: 1.333333,
          disableFlip: false,
        };

        const onScanFailure = () => {
          // Standard frame without detected barcode - no action needed
        };

        let started = false;

        // 1. Try user-preferred camera ID if provided
        if (preferredCameraId) {
          try {
            await scanner.start(preferredCameraId, scanConfig, handleScanSuccess, onScanFailure);
            started = true;
          } catch (e) {
            console.warn('Failed to start preferred camera ID, falling back:', e);
          }
        }

        // 2. Try rear / environment camera (ideal for mobile phone scanning)
        if (!started) {
          try {
            await scanner.start(
              { facingMode: { ideal: 'environment' } },
              scanConfig,
              handleScanSuccess,
              onScanFailure
            );
            started = true;
          } catch (e) {
            console.warn('Failed to start environment camera, falling back:', e);
          }
        }

        // 3. Try user facing camera / webcam
        if (!started) {
          try {
            await scanner.start(
              { facingMode: 'user' },
              scanConfig,
              handleScanSuccess,
              onScanFailure
            );
            started = true;
          } catch (e) {
            console.warn('Failed to start user camera, falling back to camera index:', e);
          }
        }

        // 4. Try first enumerated device
        if (!started && availableCameras.length > 0) {
          await scanner.start(
            availableCameras[0].id,
            scanConfig,
            handleScanSuccess,
            onScanFailure
          );
          started = true;
        }

        if (!started) {
          throw new Error('Could not access any suitable camera device.');
        }

        // Check torch capability
        try {
          const trackCaps = scanner.getRunningTrackCameraCapabilities();
          if (trackCaps && typeof trackCaps.torchFeature === 'function') {
            const torchFeature = trackCaps.torchFeature();
            setTorchAvailable(Boolean(torchFeature && torchFeature.isSupported()));
          } else {
            setTorchAvailable(false);
          }
        } catch (e) {
          setTorchAvailable(false);
        }

        setLoading(false);
      } catch (err) {
        console.error('BarcodeScanner start error:', err);
        const errMsg = err?.message || String(err);
        setLoading(false);

        if (
          errMsg.includes('NotAllowedError') ||
          errMsg.includes('Permission') ||
          errMsg.includes('PermissionDeniedError')
        ) {
          setErrorType('PERMISSION');
          setError('Camera permission was denied. Please allow camera access in your browser settings to scan barcodes.');
        } else if (
          errMsg.includes('NotFoundError') ||
          errMsg.includes('DevicesNotFoundError')
        ) {
          setErrorType('NOT_FOUND');
          setError('No camera was detected on this device. You can still type the Item ID manually.');
        } else if (
          errMsg.includes('NotReadableError') ||
          errMsg.includes('TrackStartError')
        ) {
          setErrorType('BUSY');
          setError('Camera is currently in use by another application or tab. Please close other camera apps and retry.');
        } else {
          setErrorType('GENERAL');
          setError(errMsg || 'Failed to start camera. Please check permissions and try again.');
        }
      } finally {
        isStartingRef.current = false;
      }
    },
    [isOpen, handleScanSuccess, stopScanner]
  );

  // Switch camera when multiple devices exist
  const handleSwitchCamera = async () => {
    if (cameras.length <= 1) return;
    const nextIdx = (activeCameraIndex + 1) % cameras.length;
    setActiveCameraIndex(nextIdx);
    const nextCamera = cameras[nextIdx];
    await startScanner(nextCamera.id);
  };

  // Toggle torch / flashlight
  const handleToggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner || !torchAvailable) return;
    try {
      const nextTorch = !torchOn;
      await scanner.applyVideoConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn('Failed to toggle torch:', err);
    }
  };

  // Manage open / close lifecycle
  useEffect(() => {
    let timer;
    if (isOpen) {
      // Allow DOM modal element to paint before starting scanner
      timer = setTimeout(() => {
        startScanner();
      }, 100);
    } else {
      stopScanner();
    }

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, startScanner, stopScanner]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-200 z-10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 leading-tight">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
            title="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Body */}
        <div className="p-4 sm:p-5 flex flex-col items-center">
          <div className="relative w-full aspect-4/3 bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border border-slate-800">
            {/* Target DOM container for Html5Qrcode */}
            <div
              id={VIEWPORT_ID}
              className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
            />

            {/* Loading state overlay */}
            {loading && !error && (
              <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center gap-3 text-white z-20">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
                <span className="text-xs font-semibold tracking-wide text-slate-200">
                  Starting camera...
                </span>
              </div>
            )}

            {/* Error State Overlay */}
            {error && (
              <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center z-20 space-y-3">
                <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                  <CameraOff className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">
                  {errorType === 'PERMISSION'
                    ? 'Camera Permission Needed'
                    : errorType === 'NOT_FOUND'
                    ? 'No Camera Detected'
                    : 'Camera Unavailable'}
                </h4>
                <p className="text-xs text-slate-300 max-w-xs">{error}</p>
                <div className="pt-2 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-transparent border-slate-700 text-white hover:bg-slate-800"
                    onClick={onClose}
                  >
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => startScanner()}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {/* Laser Scanning Animation and Reticle (visible when camera active) */}
            {!loading && !error && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                {/* Aiming Reticle Box */}
                <div className="relative w-[78%] h-[58%] border-2 border-dashed border-white/50 rounded-xl overflow-hidden shadow-2xl">
                  {/* Corner Accents */}
                  <div className="absolute -top-0.5 -left-0.5 w-4 h-4 border-t-3 border-l-3 border-blue-400 rounded-tl-sm" />
                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 border-t-3 border-r-3 border-blue-400 rounded-tr-sm" />
                  <div className="absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-3 border-l-3 border-blue-400 rounded-bl-sm" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-3 border-r-3 border-blue-400 rounded-br-sm" />

                  {/* Red/Blue Animated Laser Beam */}
                  <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_rgba(239,68,68,1)] animate-[scanline_2s_ease-in-out_infinite]" />
                </div>
              </div>
            )}
          </div>

          {/* Quick Controls below viewfinder */}
          <div className="mt-3.5 w-full flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              {cameras.length > 1 && (
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  disabled={loading}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
                  title="Switch between front and back cameras"
                >
                  <SwitchCamera className="w-3.5 h-3.5 text-blue-600" />
                  Switch Camera
                </button>
              )}

              {torchAvailable && (
                <button
                  type="button"
                  onClick={handleToggleTorch}
                  disabled={loading}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors ${
                    torchOn
                      ? 'bg-amber-100 border-amber-300 text-amber-800'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  }`}
                  title="Toggle flashlight"
                >
                  <Flashlight className={`w-3.5 h-3.5 ${torchOn ? 'text-amber-600' : 'text-slate-500'}`} />
                  {torchOn ? 'Torch On' : 'Torch Off'}
                </button>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </Button>
          </div>

          {/* Tip / instructions */}
          <div className="mt-2 text-center">
            <span className="text-[11px] text-slate-400">
              Supports EAN-13, EAN-8, UPC, Code 128, Code 39, and QR codes
            </span>
          </div>
        </div>
      </div>

      {/* Global CSS for laser animation */}
      <style jsx global>{`
        @keyframes scanline {
          0% {
            top: 5%;
            opacity: 0.85;
          }
          50% {
            top: 92%;
            opacity: 1;
          }
          100% {
            top: 5%;
            opacity: 0.85;
          }
        }
      `}</style>
    </div>
  );
}

