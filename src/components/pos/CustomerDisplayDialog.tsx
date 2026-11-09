import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Monitor, QrCode, Copy, Check, ExternalLink, Sparkles, Tv, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '@/hooks/use-toast';
import { getStoredRegisterId, getStoredRegisterName, setStoredRegisterConfig, broadcastCustomerDisplay } from '@/services/customerDisplayService';

interface CustomerDisplayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  storeLogo?: string;
}

export const CustomerDisplayDialog: React.FC<CustomerDisplayDialogProps> = ({
  isOpen,
  onClose,
  storeId,
  storeName,
  storeLogo,
}) => {
  const { toast } = useToast();
  const [registerName, setRegisterName] = useState<string>('Caja 1');
  const [registerId, setRegisterId] = useState<string>('caja_1');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const savedId = getStoredRegisterId();
      const savedName = getStoredRegisterName();
      setRegisterId(savedId);
      setRegisterName(savedName);
    }
  }, [isOpen]);

  const handleNameChange = (name: string) => {
    setRegisterName(name);
    // Auto-generate a clean slug ID from the name (e.g. "Caja Principal" -> "caja_principal")
    const cleanId = name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'caja_1';
    setRegisterId(cleanId);
    setStoredRegisterConfig(cleanId, name);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const displayUrl = `${origin}/customer-display?store=${storeId}&caja=${registerId}&name=${encodeURIComponent(storeName)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(displayUrl);
    setCopied(true);
    toast({
      title: "Enlace copiado",
      description: "Pega este enlace en el navegador de la tablet del cliente.",
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenLocalDisplay = () => {
    window.open(displayUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSendTestSignal = () => {
    broadcastCustomerDisplay({
      status: 'idle',
      storeId,
      storeName,
      storeLogo,
      registerId,
      registerName,
      cart: [],
      subtotal: 0,
      tax: 0,
      discount: 0,
      total: 0,
      itemsCount: 0,
      updatedAt: Date.now(),
    });
    toast({
      title: "Señal enviada",
      description: `Señal de sincronización enviada a ${registerName}.`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border shadow-2xl rounded-2xl p-5 overflow-y-auto max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="pb-3 border-b border-border/50 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Tv className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                Visor para Clientes (Tablet)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Pantalla interactiva orientada al cliente para ver productos y totales en vivo.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3 text-xs">
          {/* Register Name setting */}
          <div className="space-y-1.5 bg-muted/30 p-3 rounded-xl border border-border/60">
            <Label htmlFor="register-name" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Nombre / Número de esta Caja:</span>
              <span className="text-[10px] text-muted-foreground font-mono">ID: {registerId}</span>
            </Label>
            <Input
              id="register-name"
              type="text"
              value={registerName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej. Caja 1, Caja 2, Caja Rápida..."
              className="h-9 text-xs font-bold"
            />
            <p className="text-[10px] text-muted-foreground">
              Cada caja debe tener un nombre único para que su tablet visor reciba los cobros correctos.
            </p>
          </div>

          {/* QR Code and Pairing Box */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/20 border border-emerald-500/30 p-3.5 rounded-xl">
            <div className="bg-white p-2 rounded-xl shadow-md shrink-0 border border-border/40">
              <QRCodeSVG value={displayUrl} size={110} level="M" />
            </div>
            <div className="space-y-2 flex-1 text-center sm:text-left">
              <div>
                <p className="font-bold text-xs text-foreground flex items-center justify-center sm:justify-start gap-1">
                  <QrCode className="h-3.5 w-3.5 text-emerald-500" /> Escanea desde la Tablet
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Abre la cámara de la tablet del cliente y apunta al código QR para vincularla a esta caja en 3 segundos.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="h-7 text-xs font-semibold gap-1.5 rounded-lg border-border/60 flex-1"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copiado' : 'Copiar Link'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleOpenLocalDisplay}
                  className="h-7 text-xs font-semibold gap-1.5 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg flex-1"
                  title="Abrir visor en una nueva pestaña"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir Visor
                </Button>
              </div>
            </div>
          </div>

          {/* Direct Link Input */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Enlace directo del Visor:</span>
            <div className="flex items-center gap-1.5 bg-muted/50 p-1.5 rounded-lg border border-border/50">
              <code className="text-[11px] font-mono text-muted-foreground truncate flex-1 px-1">
                {displayUrl}
              </code>
            </div>
          </div>

          {/* How it works banner */}
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-[11px] space-y-1.5 text-muted-foreground">
            <p className="font-bold text-foreground text-xs flex items-center gap-1.5 text-emerald-500">
              <Sparkles className="h-3.5 w-3.5" /> ¿Cómo funciona en el supermercado?
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li><strong>En espera:</strong> Muestra el logo de tu negocio, bienvenida y ofertas del día.</li>
              <li><strong>Escaneando:</strong> Muestra el último producto en grande y la lista con el total a pagar.</li>
              <li><strong>Cobro y cambio:</strong> Muestra el monto pagado y la <strong>devuelta en verde</strong>.</li>
              <li><strong>Finalizado:</strong> Presenta un <strong>QR</strong> para que el cliente descargue su factura digital en su celular.</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex flex-row items-center justify-between gap-2 pt-2 border-t border-border/50">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSendTestSignal}
            className="text-xs text-muted-foreground hover:text-foreground h-9"
          >
            Probar Conexión
          </Button>
          <Button
            type="button"
            onClick={onClose}
            className="h-9 px-5 bg-primary text-primary-foreground font-bold text-xs rounded-xl"
          >
            Aceptar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDisplayDialog;
