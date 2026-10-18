import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Button } from '@/components/ui/button';
import { X, Camera, RefreshCw, ShieldAlert, ScanLine, Zap, ZapOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { isAndroidNative } from '@/utils/platform';
import { startEmbeddedNativeScan, stopEmbeddedNativeScan, onBarcodeScanned } from '@/utils/barcodeScanner';

export interface ScanDetectResult {
    /** true si el código coincide con un producto (ya agregado al carrito). */
    found: boolean;
    /** Nombre del producto agregado, si found es true. */
    productName?: string;
}

interface BarcodeScannerPanelProps {
    isOpen: boolean;
    onClose: () => void;
    /** Se llama con cada código decodificado. El panel NO se cierra solo —
     *  avisa el resultado por toast (encontrado / sin coincidencia) y sigue
     *  escaneando, para poder leer varios productos seguidos. */
    onDetect: (code: string) => ScanDetectResult;
}

type PermissionState = 'idle' | 'requesting' | 'granted' | 'denied' | 'no-device';

// ── ZXing hints – optimizados para lectura ultrarrápida de retail (EAN-13, EAN-8, UPC, Code 128) ─────
const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.QR_CODE,
]);
hints.set(DecodeHintType.TRY_HARDER, true);

/**
 * Panel de escaneo EN LÍNEA con motor dual:
 * 1. BarcodeDetector nativo (acelerado por hardware en iOS 17+ y Android Chrome)
 * 2. Fallback a ZXing multi-formato optimizado
 */
const BarcodeScannerPanel: React.FC<BarcodeScannerPanelProps> = ({ isOpen, onClose, onDetect }) => {
    const { toast } = useToast();
    const [isScanning, setIsScanning] = useState(false);
    const [permissionState, setPermissionState] = useState<PermissionState>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const cameraBoxRef = useRef<HTMLDivElement | null>(null);
    const [nativeRetryKey, setNativeRetryKey] = useState(0);
    const readerRef = useRef<BrowserMultiFormatReader | null>(null);
    const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const onDetectRef = useRef(onDetect);
    onDetectRef.current = onDetect;

    // Control de stream activo y linterna (torch)
    const activeStreamRef = useRef<MediaStream | null>(null);
    const [torchSupported, setTorchSupported] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const nativeDetectorLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastDetectedCodeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

    const audioCtxRef = useRef<AudioContext | null>(null);
    const [scanFlash, setScanFlash] = useState(false);
    const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            audioCtxRef.current?.close().catch(() => {});
            if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        };
    }, []);

    const playBeep = useCallback(() => {
        try {
            const AudioCtxClass: typeof AudioContext | undefined =
                window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtxClass) return;
            if (!audioCtxRef.current) audioCtxRef.current = new AudioCtxClass();
            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') ctx.resume();

            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.value = 1800; // tono agudo tipo lector de código de barras
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.13);
        } catch {
            // Sin audio disponible — no debe interrumpir el flujo de escaneo.
        }
    }, []);

    const triggerScanFlash = useCallback(() => {
        setScanFlash(true);
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = setTimeout(() => setScanFlash(false), 500);
    }, []);

    const reportDetection = useCallback((code: string) => {
        const result = onDetectRef.current(code);
        playBeep();
        triggerScanFlash();
        if (!result.found) {
            toast({
                variant: 'destructive',
                title: 'Sin coincidencia',
                description: `No hay ningún producto con el código ${code}`,
            });
        }
    }, [toast, playBeep, triggerScanFlash]);

    const stopScanner = useCallback(() => {
        if (nativeDetectorLoopRef.current) {
            clearTimeout(nativeDetectorLoopRef.current);
            nativeDetectorLoopRef.current = null;
        }
        if (retryRef.current) {
            clearInterval(retryRef.current);
            retryRef.current = null;
        }
        if (activeStreamRef.current) {
            activeStreamRef.current.getTracks().forEach((track) => track.stop());
            activeStreamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        readerRef.current?.reset();
        readerRef.current = null;
        setIsScanning(false);
        setTorchOn(false);
        setTorchSupported(false);
    }, []);

    const toggleTorch = useCallback(async () => {
        if (!activeStreamRef.current) return;
        try {
            const track = activeStreamRef.current.getVideoTracks()[0];
            const nextState = !torchOn;
            await (track as any).applyConstraints({
                advanced: [{ torch: nextState }],
            });
            setTorchOn(nextState);
        } catch (e) {
            console.warn('Torch toggle not supported on this track:', e);
        }
    }, [torchOn]);

    const startScanner = useCallback(async () => {
        if (!videoRef.current) return;
        setErrorMsg(null);
        setPermissionState('requesting');

        if (typeof window !== 'undefined' && !window.isSecureContext && !isAndroidNative()) {
            setPermissionState('denied');
            setErrorMsg('La cámara requiere conexión segura (HTTPS). Entra con https:// en lugar de http://');
            return;
        }

        if (typeof navigator === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
            setPermissionState('denied');
            setErrorMsg('Tu navegador no permite la cámara en conexiones no seguras (usa https://).');
            return;
        }

        try {
            // 1. Iniciar cámara con resolución 720p (perfecta para no saturar CPU y permitir enfoque nítido de cerca)
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280, min: 640 },
                    height: { ideal: 720, min: 480 },
                    ...({ focusMode: 'continuous' } as any),
                    advanced: [{ focusMode: 'continuous' } as any],
                },
                audio: false,
            });

            activeStreamRef.current = stream;
            if (!videoRef.current) {
                stream.getTracks().forEach((t) => t.stop());
                return;
            }

            videoRef.current.srcObject = stream;
            await videoRef.current.play();

            // Comprobar soporte de linterna (torch)
            try {
                const track = stream.getVideoTracks()[0];
                const capabilities = (track.getCapabilities?.() || {}) as any;
                if (capabilities?.torch) {
                    setTorchSupported(true);
                }
            } catch {
                // Torch no disponible
            }

            setPermissionState('granted');
            setIsScanning(true);

            // 2. Detección nativa acelerada por hardware (BarcodeDetector en iOS 17+, Android Chrome)
            let hasNativeDetector = false;
            let nativeDetector: any = null;

            if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
                try {
                    const formats = await (window as any).BarcodeDetector.getSupportedFormats?.() || [];
                    if (formats.length === 0 || formats.includes('ean_13') || formats.includes('code_128')) {
                        nativeDetector = new (window as any).BarcodeDetector({
                            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
                        });
                        hasNativeDetector = true;
                    }
                } catch {
                    hasNativeDetector = false;
                }
            }

            if (hasNativeDetector && nativeDetector) {
                // Bucle nativo ultrarrápido
                const scanNativeLoop = async () => {
                    if (!activeStreamRef.current || !videoRef.current) return;

                    try {
                        if (videoRef.current.readyState >= 2) {
                            const barcodes = await nativeDetector.detect(videoRef.current);
                            if (barcodes && barcodes.length > 0) {
                                const rawValue = barcodes[0].rawValue;
                                const now = Date.now();
                                if (
                                    rawValue &&
                                    (rawValue !== lastDetectedCodeRef.current.code ||
                                        now - lastDetectedCodeRef.current.time > 1500)
                                ) {
                                    lastDetectedCodeRef.current = { code: rawValue, time: now };
                                    reportDetection(rawValue);
                                }
                            }
                        }
                    } catch {
                        // Error de frame individual
                    }

                    if (activeStreamRef.current) {
                        nativeDetectorLoopRef.current = setTimeout(scanNativeLoop, 75);
                    }
                };

                scanNativeLoop();
            } else {
                // 3. Fallback a ZXing optimizado
                const reader = new BrowserMultiFormatReader(hints, {
                    delayBetweenScanAttempts: 70,
                    delayBetweenScanSuccess: 1500,
                });
                readerRef.current = reader;

                reader.decodeFromVideoElementContinuously(videoRef.current, (result, err) => {
                    if (result) {
                        reportDetection(result.getText());
                    }
                    if (err && !(err instanceof NotFoundException)) {
                        console.warn('ZXing decode warning:', err);
                    }
                });
            }
        } catch (err: any) {
            console.error('Camera error:', err);
            stopScanner();

            if (
                err?.name === 'NotAllowedError' ||
                err?.name === 'PermissionDeniedError' ||
                err?.message?.toLowerCase().includes('permission')
            ) {
                setPermissionState('denied');
            } else if (
                err?.name === 'NotFoundError' ||
                err?.name === 'DevicesNotFoundError' ||
                err?.message?.toLowerCase().includes('not found') ||
                err?.message?.toLowerCase().includes('no device')
            ) {
                setPermissionState('no-device');
            } else {
                setPermissionState('denied');
                setErrorMsg('Error de cámara: ' + (err?.message || 'Desconocido'));
            }
        }
    }, [stopScanner, reportDetection]);

    // ── Auto-retry while OS permission is pending ────────────────────────────
    useEffect(() => {
        if (permissionState === 'denied' && isOpen) {
            retryRef.current = setInterval(async () => {
                try {
                    const res = await navigator.permissions.query({ name: 'camera' as PermissionName });
                    if (res.state === 'granted') {
                        clearInterval(retryRef.current!);
                        retryRef.current = null;
                        startScanner();
                    }
                } catch { /* browser may not support this query */ }
            }, 2500);
        }
        return () => { if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; } };
    }, [permissionState, isOpen, startScanner]);

    // ── Flujo nativo (Android empaquetado): cámara CameraX + ML Kit ─────────
    // INCRUSTADA justo sobre este recuadro — no una Activity ni ventana
    // aparte. El WebView pinta un <video> con normalidad vía getUserMedia,
    // pero en varios dispositivos (tablets económicas incluidas) el frame
    // nunca llega legible al canvas donde ZXing decodifica: se ve nítido en
    // pantalla y aun así nunca reconoce nada, ni con códigos planos. Por eso
    // la cámara real la maneja el plugin nativo: mide este <div> con
    // getBoundingClientRect() y monta el PreviewView exactamente encima (ver
    // src/utils/barcodeScanner.ts y BarcodeScannerPlugin.kt). Queda
    // escaneando en continuo — cada código detectado llega como evento.
    useEffect(() => {
        if (!isOpen || !isAndroidNative() || !cameraBoxRef.current) return;

        const rect = cameraBoxRef.current.getBoundingClientRect();
        setPermissionState('granted');
        setIsScanning(true);
        setErrorMsg(null);

        startEmbeddedNativeScan({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            radius: 12, // a juego con el rounded-xl del recuadro
        }).catch((err: any) => {
            console.error('No se pudo abrir la cámara nativa incrustada:', err);
            setIsScanning(false);
            setErrorMsg('No se pudo abrir la cámara nativa: ' + (err?.message || 'Desconocido'));
        });

        const listenerHandle = onBarcodeScanned(reportDetection);

        return () => {
            setIsScanning(false);
            listenerHandle.remove();
            stopEmbeddedNativeScan();
        };
    }, [isOpen, nativeRetryKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Flujo web (navegador / desarrollo): getUserMedia + ZXing ────────────
    useEffect(() => {
        if (isAndroidNative()) return; // usa el flujo nativo de arriba
        if (isOpen) {
            setPermissionState('idle');
            setIsScanning(false);
            const t = setTimeout(() => startScanner(), 150);
            return () => { clearTimeout(t); stopScanner(); };
        } else {
            stopScanner();
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!isOpen) return null;

    const nativeMode = isAndroidNative();
    const isLoading = !nativeMode && (permissionState === 'idle' || permissionState === 'requesting');

    return (
        <div className="mt-2 rounded-2xl border bg-card overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                    <ScanLine className="h-3.5 w-3.5 text-emerald-500" />
                    Escanear producto
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-6 w-6 rounded-full"
                    aria-label="Cerrar escáner"
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Camera — recuadro chico, no pantalla completa. En modo nativo,
                el plugin monta la vista de cámara real (nativa, fuera del DOM)
                exactamente sobre este <div> — ver el efecto de arriba. Lo que
                hay acá abajo solo se ve un instante mientras esa vista
                termina de montarse, o si falló. */}
            <div
                ref={cameraBoxRef}
                className={cn(
                    "relative h-[185px] sm:h-[210px] bg-black mx-3 mt-2 mb-2.5 rounded-2xl overflow-hidden border-2 transition-colors duration-150 shadow-inner",
                    scanFlash ? "border-emerald-400" : "border-border/40"
                )}
            >
                {/* Botón de Linterna (Flash) si está disponible */}
                {torchSupported && isScanning && !nativeMode && (
                    <button
                        type="button"
                        onClick={toggleTorch}
                        className={cn(
                            "absolute top-2.5 right-2.5 z-20 p-2 rounded-full backdrop-blur-md transition-all active:scale-90 border flex items-center justify-center cursor-pointer shadow-md",
                            torchOn
                                ? "bg-amber-400 text-black border-amber-300 shadow-amber-400/30"
                                : "bg-black/60 text-white/90 border-white/20 hover:bg-black/80"
                        )}
                        title={torchOn ? "Apagar linterna" : "Encender linterna"}
                    >
                        {torchOn ? <Zap className="h-4 w-4 fill-current" /> : <ZapOff className="h-4 w-4" />}
                    </button>
                )}

                {nativeMode ? (
                    errorMsg ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-zinc-900 z-[11]">
                            <ShieldAlert className="h-6 w-6 text-red-400 mb-1.5" />
                            <p className="text-white font-semibold text-xs mb-0.5">Cámara bloqueada</p>
                            <p className="text-zinc-400 text-[10px] mb-2 max-w-[260px] leading-relaxed">{errorMsg}</p>
                            <Button
                                size="sm"
                                onClick={() => setNativeRetryKey((n) => n + 1)}
                                className="bg-white text-black hover:bg-zinc-200 rounded-full h-7 text-[11px]"
                            >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Reintentar
                            </Button>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-4 text-center">
                            <Camera className="h-5 w-5 text-emerald-400" />
                            <p className="text-zinc-400 text-[11px]">Iniciando cámara...</p>
                        </div>
                    )
                ) : (
                    <>
                        <video
                            ref={videoRef}
                            className="absolute inset-0 w-full h-full object-cover"
                            playsInline
                            muted
                            autoPlay
                        />

                        {isLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-10 gap-2">
                                <RefreshCw className="h-5 w-5 text-emerald-500 animate-spin" />
                                <p className="text-zinc-400 text-[11px]">
                                    {permissionState === 'requesting' ? 'Solicitando acceso a la cámara...' : 'Iniciando cámara...'}
                                </p>
                            </div>
                        )}

                        {permissionState === 'denied' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-zinc-900 z-[11]">
                                <ShieldAlert className="h-6 w-6 text-red-400 mb-1.5" />
                                <p className="text-white font-semibold text-xs mb-0.5">Cámara bloqueada</p>
                                <p className="text-zinc-400 text-[10px] mb-2 max-w-[260px] leading-relaxed">
                                    {errorMsg ?? 'Permite el acceso a la cámara para escanear.'}
                                </p>
                                <Button
                                    size="sm"
                                    onClick={() => startScanner()}
                                    className="bg-white text-black hover:bg-zinc-200 rounded-full h-7 text-[11px]"
                                >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Reintentar
                                </Button>
                            </div>
                        )}

                        {permissionState === 'no-device' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-zinc-900 z-[11]">
                                <Camera className="h-6 w-6 text-orange-400 mb-1.5" />
                                <p className="text-white font-semibold text-xs mb-2">Sin cámara disponible</p>
                                <Button size="sm" onClick={() => startScanner()} className="bg-white text-black hover:bg-zinc-200 rounded-full h-7 text-[11px]">
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Reintentar
                                </Button>
                            </div>
                        )}
                    </>
                )}

                {isScanning && !nativeMode && (
                    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center p-3">
                        <div className="relative w-[85%] max-w-[290px] h-[105px] rounded-xl shadow-[0_0_0_999px_rgba(0,0,0,0.5)]">
                            <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-lg" />
                            <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-lg" />
                            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-lg" />
                            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-lg" />
                            <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse" />
                        </div>
                        <p className="text-[10px] text-white/75 font-semibold tracking-wide mt-2 bg-black/50 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                            Mantén el código enfocado a 15-20 cm
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BarcodeScannerPanel;
