import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Usb, Bluetooth, Loader2, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { thermalPrinter } from '@/utils/thermalPrinter';
import { cn } from '@/lib/utils';
import { isElectron, getSystemPrinters, SystemPrinter } from '@/utils/electronPrinter';

interface ThermalPrinterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (deviceName: string) => void;
}

export const ThermalPrinterDialog: React.FC<ThermalPrinterDialogProps> = ({
  open,
  onOpenChange,
  onConnect,
}) => {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [activeMethod, setActiveMethod] = useState<'usb' | 'bluetooth' | 'system' | null>(null);
  const [systemPrinters, setSystemPrinters] = useState<SystemPrinter[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [showUsbList, setShowUsbList] = useState(false);
  const [showBluetoothList, setShowBluetoothList] = useState(false);
  const isElectronApp = isElectron();

  useEffect(() => {
    if (open && isElectronApp) {
      loadSystemPrinters();
    }
  }, [open, isElectronApp]);

  const loadSystemPrinters = async () => {
    setLoadingPrinters(true);
    try {
      const printers = await getSystemPrinters();
      setSystemPrinters(printers);
    } catch (error) {
      console.error('Failed to load printers:', error);
    } finally {
      setLoadingPrinters(false);
    }
  };

  const handleSystemPrinterSelect = (printer: SystemPrinter) => {
    thermalPrinter.setConnectedPrinter(printer.name);
    onConnect(printer.name);
    onOpenChange(false);
    toast({
      title: "Impresora Seleccionada",
      description: `Se usará: ${printer.displayName || printer.name}`,
    });
  };

  const handleConnectUSB = async () => {
    if (isElectronApp) {
      setShowUsbList(!showUsbList);
      setShowBluetoothList(false);
      return;
    }

    setConnecting(true);
    setActiveMethod('usb');

    try {
      const result = await thermalPrinter.connect();

      if (result.success) {
        onConnect(result.deviceName || 'Impresora USB');
        onOpenChange(false);
        toast({
          title: "¡Conexión Exitosa!",
          description: `Impresora USB conectada: ${result.deviceName}`,
        });
      } else {
        const errorLines = (result.error || "No se pudo conectar").split('\n');
        toast({
          title: "Error de Conexión",
          description: (
            <div className="space-y-1">
              {errorLines.map((line, i) => (
                <p key={i} className="text-sm">{line}</p>
              ))}
            </div>
          ),
          variant: "destructive",
          duration: 8000,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al conectar",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
      setActiveMethod(null);
    }
  };

  const handleConnectBluetooth = async () => {
    // If Electron, just toggle the list of system printers
    if (isElectronApp) {
      setShowBluetoothList(!showBluetoothList);
      setShowUsbList(false);
      return;
    }

    // On Web/Mobile, trigger the native Bluetooth selection
    setConnecting(true);
    setActiveMethod('bluetooth');

    try {
      if (!('bluetooth' in navigator)) {
        toast({
          title: "No soportado",
          description: "Tu navegador no soporta Bluetooth Web. Usa Chrome o la App oficial.",
          variant: "destructive",
          duration: 6000,
        });
        setConnecting(false);
        setActiveMethod(null);
        return;
      }

      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          'battery_service',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '00001101-0000-1000-8000-00805f9b34fb' // Serial Port Profile
        ]
      });

      if (device.name) {
        thermalPrinter.setConnectedPrinter(device.name);
        toast({
          title: "Bluetooth Vinculado",
          description: `Dispositivo: ${device.name}`,
        });

        setTimeout(() => {
          onConnect(device.name);
          onOpenChange(false);
        }, 1000);
      }
    } catch (error: any) {
      if (error.name !== 'NotFoundError') {
        console.error("Bluetooth Error:", error);
        toast({
          title: "Error Bluetooth",
          description: "No se pudo conectar al dispositivo.",
          variant: "destructive",
        });
      }
    } finally {
      setConnecting(false);
      setActiveMethod(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-0 bg-background/95 backdrop-blur-xl border-accent/20 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 z-0 pointer-events-none" />

        <DialogHeader className="px-6 pt-6 pb-2 relative z-10 text-center">
          <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4 ring-1 ring-primary/20">
            <Printer className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl font-bold">
            Seleccionar Impresora
          </DialogTitle>
          <DialogDescription className="text-muted-foreground/80">
            {isElectronApp ? 'Selecciona tu impresora de la lista' : 'Elige un método para conectar'}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4 relative z-10">
          {/* USB Option */}
          <div className="space-y-2">
            <button
              onClick={handleConnectUSB}
              disabled={connecting}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-card/80 transition-all text-left",
                showUsbList ? "border-emerald-500/50 ring-2 ring-emerald-500/20 bg-emerald-500/5" : "border-border"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
                showUsbList ? "bg-emerald-500/20 text-emerald-600" : "bg-emerald-500/10 text-emerald-500"
              )}>
                {activeMethod === 'usb' ? <Loader2 className="h-6 w-6 animate-spin" /> : <Usb className="h-6 w-6" />}
              </div>
              <div className="flex-1">
                <div className="font-semibold flex items-center gap-2">
                  🔌 Impresoras USB
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isElectronApp ?
                    (systemPrinters.length > 0 ? `${systemPrinters.length} detectadas` : 'Ver instaladas') :
                    'Conexión directa por cable OTG'}
                </p>
              </div>
              {showUsbList && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            </button>

            {isElectronApp && showUsbList && (
              <div className="ml-4 p-3 bg-muted/30 rounded-xl border border-emerald-500/20 max-h-[200px] overflow-y-auto space-y-2">
                {systemPrinters.length > 0 ? (
                  systemPrinters.map((printer) => (
                    <button
                      key={printer.name}
                      onClick={() => handleSystemPrinterSelect(printer)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-emerald-50 transition-colors text-left text-sm"
                    >
                      <Printer className="h-4 w-4 text-emerald-600" />
                      <span className="flex-1 truncate">{printer.displayName || printer.name}</span>
                      {printer.status === 0 && <span className="text-[10px] text-emerald-600">En línea</span>}
                    </button>
                  ))
                ) : <p className="text-xs text-center p-2">No se encontraron impresoras</p>}
              </div>
            )}
          </div>

          {/* Bluetooth Option */}
          <div className="space-y-2">
            <button
              onClick={handleConnectBluetooth}
              disabled={connecting}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-card/80 transition-all text-left",
                showBluetoothList ? "border-blue-500/50 ring-2 ring-blue-500/20 bg-blue-500/5" : "border-border"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
                showBluetoothList ? "bg-blue-500/20 text-blue-600" : "bg-blue-500/10 text-blue-500"
              )}>
                {activeMethod === 'bluetooth' ? <Loader2 className="h-6 w-6 animate-spin" /> : <Bluetooth className="h-6 w-6" />}
              </div>
              <div className="flex-1">
                <div className="font-semibold">📡 Impresoras Bluetooth</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isElectronApp ? 'Dispositivos vinculados' : 'Escanea y empareja dispositivos'}
                </p>
              </div>
              {showBluetoothList && <CheckCircle2 className="h-5 w-5 text-blue-500" />}
            </button>

            {showBluetoothList && (
              <div className="ml-4 p-4 bg-muted/30 rounded-xl border border-blue-500/20 space-y-3">
                {!isElectronApp && (
                  <Button
                    onClick={handleConnectBluetooth}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Bluetooth className="mr-2 h-4 w-4" />
                    Buscar Dispositivos
                  </Button>
                )}

                {isElectronApp && (
                  <div className="grid gap-2 max-h-[200px] overflow-y-auto pr-1">
                    {systemPrinters.length > 0 ? (
                      systemPrinters.map((printer) => (
                        <button
                          key={printer.name}
                          onClick={() => handleSystemPrinterSelect(printer)}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-blue-50 transition-colors text-left text-sm"
                        >
                          <Printer className="h-4 w-4 text-blue-600" />
                          <span className="flex-1 truncate">{printer.displayName || printer.name}</span>
                          <Zap className="h-3 w-3 text-blue-500" />
                        </button>
                      ))
                    ) : <p className="text-xs text-center p-2">No se encontraron dispositivos</p>}
                  </div>
                )}

                <p className="text-[10px] text-center text-muted-foreground italic">
                  Asegúrate de que la impresora esté encendida y visible.
                </p>
              </div>
            )}
          </div>

          {!isElectronApp && (
            <div className="pt-2">
              <div className="rounded-lg bg-orange-500/5 border border-orange-500/10 p-3 flex gap-3">
                <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground">
                  Para móviles, vincula primero la impresora en los ajustes del sistema de Android/iOS.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
