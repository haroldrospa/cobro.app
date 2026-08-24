import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Button } from '@/components/ui/button';
import { X, Camera, RefreshCw, ShieldAlert, ScanLine } from 'lucide-react';
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

// ── ZXing hints – enable all linear + 2D formats ─────────────────────────────
const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.UPC_EAN_EXTENSION,
    BarcodeFormat.ITF,
    BarcodeFormat.CODABAR,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.PDF_417,
    BarcodeFormat.AZTEC,
]);
hints.set(DecodeHintType.TRY_HARDER, true);

/**
 * Panel de escaneo EN LÍNEA (no modal/popup) — se renderiza directamente
 * debajo de la barra de búsqueda cuando isOpen es true. Recuadro chico a
 * propósito (h-[110px]) para no comerse la pantalla — el resultado de cada
 * lectura se avisa por toast, no con una caja fija, para no restarle espacio
 * a la lista/grilla de productos debajo.
 *
 * Nota técnica del bug que esto reemplazó: la versión anterior manejaba la
 * cámara a mano (getUserMedia + video.play()) y luego llamaba a
 * `reader.decodeFromVideoElement(video, callback)` — ese método de ZXing es
 * de UN SOLO intento y ni siquiera acepta un callback (la firma real es
 * `decodeFromVideoElement(source): Promise<Result>`), así que el callback
 * nunca se ejecutaba. Aquí se usa `decodeFromConstraints(...)`, que es quien
 * de verdad expone el modo continuo con callback y además gestiona la cámara
 * internamente (evita además una condición de carrera al reproducir el video
 * dos veces). Ese flujo web solo se usa fuera de la app nativa (navegador /
 * desarrollo) — dentro de la app Android real, ver el flujo nativo incrustado
 * más abajo.
 */
const BarcodeScannerPanel: React.FC<BarcodeScannerPanelProps> = ({ isOpen, onClose, onDetect }) => {
    const { toast } = useToast();
    const [isScanning, setIsScanning] = useState(false);
    const [permissionState, setPermissionState] = useState<PermissionState>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    // Recuadro que mide getBoundingClientRect() para decirle al plugin nativo
    // dónde montar la vista de cámara incrustada (modo nativo — ver abajo).
    const cameraBoxRef = useRef<HTMLDivElement | null>(null);
    // Se incrementa para forzar un reintento del efecto nativo tras un error.
    const [nativeRetryKey, setNativeRetryKey] = useState(0);
    const readerRef = useRef<BrowserMultiFormatReader | null>(null);
    const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const onDetectRef = useRef(onDetect);
    onDetectRef.current = onDetect;

    // Beep corto (Web Audio API, sin archivo de sonido) + destello verde en
    // el borde del recuadro — feedback inmediato de "código leído" sin
    // interrumpir con un popup. Un solo AudioContext reutilizado (crear uno
    // nuevo por cada beep genera advertencias del navegador si se escanea
    // rápido/seguido).
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

    // Único punto donde se procesa un código leído (web o nativo): beep +
    // destello verde en cualquier lectura exitosa, agrega al carrito si hay
    // match, y solo avisa por toast cuando NO hay coincidencia (para eso sí
    // hace falta explicar qué pasó — un simple beep no alcanza).
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
        if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; }
        readerRef.current?.reset(); // también detiene la cámara/tracks
        readerRef.current = null;
        setIsScanning(false);
    }, []);

    const startScanner = useCallback(async () => {
        if (!videoRef.current) return;
        setErrorMsg(null);
        setPermissionState('requesting');

        try {
            const reader = new BrowserMultiFormatReader(hints, {
                delayBetweenScanAttempts: 80,   // ~12 intentos/s
                delayBetweenScanSuccess: 1500,  // espera 1.5s antes de aceptar otro código
            });
            readerRef.current = reader;

            // decodeFromConstraints pide la cámara, la conecta al <video> y
            // arranca el bucle continuo — todo en un solo paso manejado por
            // la propia librería (evita el bug de doble-play descrito arriba).
            await reader.decodeFromConstraints(
                {
                    video: {
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        // Enfoque continuo — sin esto algunas cámaras se quedan
                        // enfocadas a distancia de video-llamada y nunca
                        // resuelven bien un código de barras de cerca.
                        // (no está en el tipo estándar de TS; algunos
                        // navegadores lo soportan igual)
                        ...({ focusMode: 'continuous' } as any),
                        advanced: [{ focusMode: 'continuous' } as any],
                    },
                    audio: false,
                },
                videoRef.current,
                (result, err) => {
                    if (result) {
                        reportDetection(result.getText());
                    }
                    if (err && !(err instanceof NotFoundException)) {
                        console.warn('ZXing decode error:', err);
                    }
                }
            );

            setPermissionState('granted');
            setIsScanning(true);
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
                    "relative h-[110px] bg-black mx-3 mt-2 mb-2.5 rounded-xl overflow-hidden border-2 transition-colors duration-150",
                    scanFlash ? "border-emerald-400" : "border-transparent"
                )}
            >
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
                    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                        <div className="relative w-[85%] h-[70%] rounded-xl shadow-[0_0_0_999px_rgba(0,0,0,0.55)]">
                            <div className="absolute top-0 left-0 w-5 h-5 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-lg" />
                            <div className="absolute top-0 right-0 w-5 h-5 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-lg" />
                            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-lg" />
                            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-lg" />
                            <div className="absolute left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-[scan_2s_ease-in-out_infinite]" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BarcodeScannerPanel;
