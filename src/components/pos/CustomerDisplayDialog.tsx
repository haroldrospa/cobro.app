import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Monitor, QrCode, Copy, Check, ExternalLink, Sparkles, Tv, Receipt, ArrowRight } from 'lucide-react';
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
      <DialogContent className="max-w-md sm:max-w-lg bg-card border-border shadow-2xl rounded-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(var(--visual-viewport-height,100dvh)-1.5rem)] sm:max-h-[88vh]">
        {/* Header - Fixed */}
        <DialogHeader className="p-4 pb-3 border-b border-border/50 text-left shrink-0 bg-card">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
              <Tv className="h-5 w-5" />
            </div>
            <div className="min-w-0 pr-6">
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground leading-tight">
                Visor para Clientes (Tablet)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate mt-0.5">
                Pantalla orientada al cliente para ver productos y totales en vivo.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs overscroll-contain">
          {/* Register Name setting */}
          <div className="space-y-1.5 bg-muted/30 p-2.5 rounded-xl border border-border/60">
            <Label htmlFor="register-name" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Nombre / Número de esta Caja:</span>
              <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">ID: {registerId}</span>
            </Label>
            <Input
              id="register-name"
              type="text"
              value={registerName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej. Caja 1, Caja 2, Caja Rápida..."
              className="h-8 text-xs font-bold bg-background"
            />
            <p className="text-[10px] text-muted-foreground leading-tight">
              Cada caja debe tener un identificador único para que su tablet visor reciba los cobros correctos.
            </p>
          </div>

          {/* QR Code and Pairing Box */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/20 border border-emerald-500/30 p-3 rounded-xl">
            <div className="bg-white p-2 rounded-xl shadow-sm shrink-0 border border-border/40">
              <QRCodeSVG value={displayUrl} size={92} level="M" />
            </div>
            <div className="space-y-2 flex-1 text-center sm:text-left min-w-0 w-full">
              <div>
                <p className="font-bold text-xs text-foreground flex items-center justify-center sm:justify-start gap-1">
                  <QrCode className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Escanea desde la Tablet
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug break-words">
                  Abre la cámara de la tablet del cliente y apunta al código QR para vincularla al instante.
                </p>
              </div>

              {/* Action Buttons in 2-column grid to ensure neither wraps or gets cut */}
              <div className="grid grid-cols-2 gap-2 pt-0.5 w-full">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="h-7 text-xs font-semibold gap-1.5 rounded-lg border-border/60 px-2 truncate"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{copied ? 'Copiado' : 'Copiar Link'}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleOpenLocalDisplay}
                  className="h-7 text-xs font-semibold gap-1.5 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg px-2 truncate border border-emerald-500/20"
                  title="Abrir visor en una nueva pestaña"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Abrir Visor</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Direct Link Input */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Enlace directo del Visor:</span>
            <div className="flex items-center gap-2 bg-muted/50 p-1.5 px-2 rounded-lg border border-border/50">
              <code className="text-[11px] font-mono text-muted-foreground truncate flex-1 select-all">
                {displayUrl}
              </code>
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-[10px] font-semibold text-emerald-500 hover:text-emerald-400 shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-emerald-500/10"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Listo' : 'Copiar'}
              </button>
            </div>
          </div>

          {/* How it works - Compact 2x2 grid */}
          <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-[11px] space-y-1.5 text-muted-foreground">
            <p className="font-bold text-foreground text-xs flex items-center gap-1.5 text-emerald-500">
              <Sparkles className="h-3.5 w-3.5" /> ¿Cómo funciona en tu negocio?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5 text-[10px] text-foreground/80">
              <div className="flex items-center gap-1.5 bg-background/50 p-1.5 rounded-lg border border-border/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span><strong>En espera:</strong> Logo y ofertas del día</span>
              </div>
              <div className="flex items-center gap-1.5 bg-background/50 p-1.5 rounded-lg border border-border/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span><strong>Cobrando:</strong> Productos y total en vivo</span>
              </div>
              <div className="flex items-center gap-1.5 bg-background/50 p-1.5 rounded-lg border border-border/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span><strong>Pago:</strong> Monto y devuelta en verde</span>
              </div>
              <div className="flex items-center gap-1.5 bg-background/50 p-1.5 rounded-lg border border-border/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span><strong>Fin:</strong> QR para factura digital</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Fixed, always visible */}
        <DialogFooter className="p-3 px-4 border-t border-border/50 bg-muted/20 shrink-0 flex flex-row items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSendTestSignal}
            className="text-xs text-muted-foreground hover:text-foreground h-8 px-3"
          >
            Probar Conexión
          </Button>
          <Button
            type="button"
            onClick={onClose}
            className="h-8 px-5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-sm hover:opacity-90 active:scale-95 transition-all"
          >
            Aceptar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDisplayDialog;
