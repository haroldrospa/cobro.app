import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Camera, RefreshCw, ShieldAlert, MonitorSmartphone } from 'lucide-react';

interface BarcodeScannerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (decodedText: string) => void;
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
// Try harder = more accurate but slower; good tradeoff for barcodes
hints.set(DecodeHintType.TRY_HARDER, true);

const BarcodeScannerDialog: React.FC<BarcodeScannerDialogProps> = ({ isOpen, onClose, onScan }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [permissionState, setPermissionState] = useState<PermissionState>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const readerRef = useRef<BrowserMultiFormatReader | null>(null);
    const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // ── Tear everything down ─────────────────────────────────────────────────
    const stopScanner = useCallback(() => {
        if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; }
        readerRef.current?.reset();
        readerRef.current = null;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsScanning(false);
    }, []);

    // ── Start scanning ───────────────────────────────────────────────────────
    const startScanner = useCallback(async () => {
        setErrorMsg(null);
        setPermissionState('requesting');

        try {
            // 1. Explicitly ask for camera – triggers OS/browser permission prompt
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false,
            });

            streamRef.current = stream;

            // 2. Attach stream to video element
            if (!videoRef.current) {
                setPermissionState('denied');
                setErrorMsg('No se pudo acceder al elemento de video.');
                stream.getTracks().forEach(t => t.stop());
                return;
            }

            videoRef.current.srcObject = stream;
            videoRef.current.setAttribute('playsinline', 'true'); // iOS Safari requires this
            await videoRef.current.play();

            // 3. Start ZXing continuous decode loop
            const reader = new BrowserMultiFormatReader(hints, {
                delayBetweenScanAttempts: 80,  // ~12 scans/s
                delayBetweenScanSuccess: 1500, // wait 1.5s before next successful scan
            });
            readerRef.current = reader;

            reader.decodeFromVideoElement(videoRef.current, (result, err) => {
                if (result) {
                    onScan(result.getText());
                }
                if (err && !(err instanceof NotFoundException)) {
                    // Only log real errors, not "nothing found in this frame"
                    console.warn('ZXing decode error:', err);
                }
            });

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
                // On macOS this often means OS hasn't approved the camera yet
                setPermissionState('denied');
                setErrorMsg('El sistema operativo bloqueó la cámara. Activa el permiso en Configuración del Sistema → Privacidad y Seguridad → Cámara y vuelve aquí.');
            } else {
                setPermissionState('denied');
                setErrorMsg('Error de cámara: ' + (err?.message || 'Desconocido'));
            }
        }
    }, [onScan, stopScanner]);

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

    // ── Open / close lifecycle ────────────────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            setPermissionState('idle');
            setIsScanning(false);
            const t = setTimeout(() => startScanner(), 400);
            return () => { clearTimeout(t); stopScanner(); };
        } else {
            stopScanner();
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const isLoading = permissionState === 'idle' || permissionState === 'requesting';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent hideCloseButton className="sm:max-w-md w-full p-0 overflow-hidden bg-black border-none shadow-2xl rounded-[32px] h-[85vh] max-h-[800px] flex flex-col">
                <DialogTitle className="sr-only">Escanear Código de Barras</DialogTitle>
                <DialogDescription className="sr-only">
                    Use la cámara de su dispositivo para escanear códigos de barras de productos
                </DialogDescription>

                {/* Top bar */}
                <div className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-start pointer-events-none">
                    <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 pointer-events-auto">
                        <h2 className="text-white font-medium text-sm flex items-center gap-2">
                            <Camera className="h-4 w-4 text-emerald-400" />
                            Escanear Producto
                        </h2>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="bg-black/40 backdrop-blur-md hover:bg-black/60 text-white border border-white/10 rounded-full h-10 w-10 pointer-events-auto transition-all active:scale-95"
                        aria-label="Cerrar escáner"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Video layer — always mounted so ref is ready */}
                <div className="relative w-full flex-1 bg-black flex items-center justify-center overflow-hidden">
                    <video
                        ref={videoRef}
                        className="absolute inset-0 w-full h-full object-cover"
                        playsInline
                        muted
                        autoPlay
                    />

                    {/* Loading */}
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-10 gap-4">
                            <RefreshCw className="h-10 w-10 text-emerald-500 animate-spin" />
                            <p className="text-zinc-400 text-sm">
                                {permissionState === 'requesting' ? 'Solicitando acceso a la cámara...' : 'Iniciando cámara...'}
                            </p>
                        </div>
                    )}

                    {/* Permission error */}
                    {permissionState === 'denied' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-zinc-900 z-[11]">
                            <div className="bg-red-500/15 p-5 rounded-full mb-5">
                                <ShieldAlert className="h-10 w-10 text-red-400" />
                            </div>
                            <p className="text-white font-bold text-lg mb-1">Acceso a Cámara Bloqueado</p>
                            <p className="text-zinc-400 text-sm mb-4 max-w-[270px] leading-relaxed">
                                {errorMsg ?? 'El navegador no tiene permiso para usar la cámara.'}
                            </p>
                            <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-4 mb-6 text-left text-xs text-zinc-300 max-w-[290px] space-y-2">
                                <p className="font-semibold text-white flex items-center gap-2">
                                    <MonitorSmartphone className="h-4 w-4 text-blue-400 shrink-0" />
                                    Cómo permitir en macOS:
                                </p>
                                <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                                    <li>Abre <span className="text-white font-medium">Configuración del Sistema</span></li>
                                    <li>Ve a <span className="text-white font-medium">Privacidad y Seguridad → Cámara</span></li>
                                    <li>Activa el permiso para tu navegador</li>
                                    <li>Vuelve aquí — se abrirá automáticamente ✓</li>
                                </ol>
                            </div>
                            <div className="flex flex-col gap-2 w-full max-w-[240px]">
                                <Button
                                    onClick={() => startScanner()}
                                    className="bg-white text-black hover:bg-zinc-200 rounded-full px-6 w-full font-semibold"
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Reintentar
                                </Button>
                                <p className="text-[11px] text-zinc-600 text-center">Verificando automáticamente cada 2.5s...</p>
                            </div>
                        </div>
                    )}

                    {/* No device */}
                    {permissionState === 'no-device' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-zinc-900 z-[11]">
                            <div className="bg-orange-500/15 p-5 rounded-full mb-5">
                                <Camera className="h-10 w-10 text-orange-400" />
                            </div>
                            <p className="text-white font-bold text-lg mb-2">Sin Cámara Disponible</p>
                            <p className="text-zinc-400 text-sm mb-6 max-w-[260px] leading-relaxed">
                                No se detectaron cámaras en este dispositivo.
                            </p>
                            <Button onClick={() => startScanner()} className="bg-white text-black hover:bg-zinc-200 rounded-full px-6 font-semibold">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Reintentar
                            </Button>
                        </div>
                    )}

                    {/* Scanning overlay */}
                    {isScanning && (
                        <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                            {/* Dim everything outside the box */}
                            <div className="relative w-[85%] max-w-[340px] h-[140px] rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                                {/* Corner marks */}
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-xl" />
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-xl" />
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-xl" />
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-xl" />
                                {/* Scan line animation */}
                                <div className="absolute left-3 right-3 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-[scan_2s_ease-in-out_infinite]" />
                            </div>
                            <div className="absolute bottom-14 sm:bottom-20 px-6 py-2.5 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 text-center">
                                <p className="text-white/90 text-sm font-medium tracking-wide">
                                    Apunta el código de barras aquí
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default BarcodeScannerDialog;
