import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Wallet,
  Building,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Image as ImageIcon,
  ArrowRight,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { useDigitalServices, useDigitalTopupRequests, COBROAPP_BANK_ACCOUNTS } from '@/hooks/useDigitalServices';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface BankTransferTopUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAmount?: number;
}

export const BankTransferTopUpDialog: React.FC<BankTransferTopUpDialogProps> = ({
  open,
  onOpenChange,
  defaultAmount = 1000,
}) => {
  const { wallet, submitTopupRequest, isSubmittingTopup } = useDigitalServices();
  const { data: recentRequests = [] } = useDigitalTopupRequests({ allStores: false });

  const [selectedBank, setSelectedBank] = useState<string>('Banco BHD');
  const [amount, setAmount] = useState<number | string>(defaultAmount);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [copiedBankId, setCopiedBankId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<'form' | 'success'>('form');

  const currentBalance = Number(wallet?.balance || 0);
  const numericAmount = Number(amount) || 0;
  const isAmountValid = numericAmount >= 500 && numericAmount <= 20000;

  const handleCopyAccount = (bankId: string, accountNumber: string) => {
    navigator.clipboard.writeText(accountNumber.replace(/-/g, ''));
    setCopiedBankId(bankId);
    toast({
      title: 'Número copiado al portapapeles',
      description: accountNumber,
    });
    setTimeout(() => setCopiedBankId(null), 2500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        alert('El archivo no debe exceder los 8 MB');
        return;
      }
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAmountValid) {
      alert('El monto debe estar entre RD$ 500 y RD$ 20,000');
      return;
    }
    if (!referenceNumber.trim()) {
      alert('Por favor ingrese el número de comprobante o referencia de la transferencia');
      return;
    }

    try {
      await submitTopupRequest({
        amount: numericAmount,
        bankName: selectedBank,
        referenceNumber: referenceNumber.trim(),
        receiptFile: receiptFile || undefined,
        notes: notes.trim() || undefined,
      });

      setActiveStep('success');
    } catch (err: any) {
      console.error('Error al enviar recarga:', err);
    }
  };

  const handleReset = () => {
    setActiveStep('form');
    setReferenceNumber('');
    setNotes('');
    setReceiptFile(null);
    setReceiptPreview(null);
    setAmount(1000);
    onOpenChange(false);
  };

  const pendingRequests = recentRequests.filter((r) => r.status === 'pending');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-background border border-border/80 shadow-2xl rounded-2xl max-h-[90vh] flex flex-col">
        {/* Cabecera */}
        <DialogHeader className="p-4 sm:p-5 bg-card border-b border-border/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Recargar Saldo de Billetera
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/30 text-primary">
                  Vía Transferencia
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Transfiere a nuestras cuentas bancarias oficiales y reporta tu comprobante para activación.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Contenido con Scroll Interior */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-4">
          {activeStep === 'success' ? (
            <div className="py-6 text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto border border-primary/20">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">¡Comprobante Enviado con Éxito!</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tu solicitud de recarga por <strong>RD$ {numericAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</strong> ha sido enviada al panel administrativo.
                </p>
              </div>

              <div className="p-3.5 bg-muted/40 rounded-xl border border-border/60 text-xs text-left space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Banco Destino:</span>
                  <span className="font-semibold text-foreground">{selectedBank}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Referencia / Comprobante:</span>
                  <span className="font-mono font-bold text-foreground">{referenceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estado actual:</span>
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                    En Verificación
                  </Badge>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <Button
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto h-10 px-6 font-bold bg-primary text-primary-foreground rounded-xl"
                >
                  Entendido y Volver
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Alerta si ya tiene una solicitud pendiente */}
              {pendingRequests.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs flex items-start gap-2 text-amber-800 dark:text-amber-200">
                  <Clock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <div className="flex-1">
                    <span className="font-bold block">Tienes {pendingRequests.length} solicitud(es) en verificación</span>
                    <span className="text-[11px] opacity-90 block">
                      Última enviada por RD$ {Number(pendingRequests[0].amount).toFixed(2)} (Ref: {pendingRequests[0].reference_number}). Se activará en breve.
                    </span>
                  </div>
                </div>
              )}

              {/* Paso 1: Cuentas Bancarias de CobroApp */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-primary" />
                    1. Cuentas Bancarias Oficiales de CobroApp
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    Haz clic para copiar número
                  </span>
                </Label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {COBROAPP_BANK_ACCOUNTS.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => {
                        setSelectedBank(b.bank);
                        handleCopyAccount(b.id, b.accountNumber);
                      }}
                      className={cn(
                        "p-2.5 rounded-xl border transition-all cursor-pointer relative text-left",
                        selectedBank === b.bank
                          ? "bg-primary/5 border-primary ring-1 ring-primary shadow-2xs"
                          : "bg-card hover:bg-muted/40 border-border/70"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-foreground truncate">{b.bank}</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title="Copiar número"
                        >
                          {copiedBankId === b.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="text-[11px] font-mono font-bold text-primary tracking-wide">
                        {b.accountNumber}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {b.accountType} &bull; {b.holder}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Paso 2: Monto a Recargar (Min 500 - Max 20,000) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="topup-amount" className="text-xs font-bold text-foreground">
                    2. Monto Transferido (RD$)
                  </Label>
                  <span className={cn(
                    "text-[11px] font-semibold",
                    isAmountValid ? "text-primary" : "text-destructive"
                  )}>
                    {numericAmount < 500
                      ? 'Mínimo RD$ 500'
                      : numericAmount > 20000
                      ? 'Máximo RD$ 20,000'
                      : 'Monto válido ✓'}
                  </span>
                </div>

                <Input
                  id="topup-amount"
                  type="number"
                  min={500}
                  max={20000}
                  step={100}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500 a 20,000"
                  className="h-10 text-base font-bold rounded-xl border-border/70 bg-card"
                  required
                />

                {/* Chips de montos rápidos */}
                <div className="grid grid-cols-6 gap-1.5">
                  {[500, 1000, 2000, 5000, 10000, 20000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(amt)}
                      className={cn(
                        "py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer text-center",
                        Number(amount) === amt
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-card hover:bg-muted border-border/70 text-foreground"
                      )}
                    >
                      ${amt >= 1000 ? `${amt / 1000}k` : amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paso 3: Número de Comprobante / Referencia */}
              <div className="space-y-1.5">
                <Label htmlFor="topup-ref" className="text-xs font-bold text-foreground">
                  3. Número de Comprobante / Referencia Bancaria *
                </Label>
                <Input
                  id="topup-ref"
                  type="text"
                  placeholder="Ej. REF-984321, 002345 o Número de Aprobación"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="h-10 text-sm font-semibold rounded-xl border-border/70 bg-card"
                  required
                />
              </div>

              {/* Paso 4: Adjuntar Imagen del Comprobante */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>4. Foto o Captura del Comprobante</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Recomendado</span>
                </Label>

                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border/80 hover:border-primary/60 rounded-xl cursor-pointer bg-muted/20 hover:bg-muted/40 transition-all text-xs font-medium text-muted-foreground hover:text-foreground">
                    <UploadCloud className="h-4 w-4 text-primary" />
                    <span>{receiptFile ? receiptFile.name : 'Seleccionar imagen o captura de pantalla'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>

                  {receiptPreview && (
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-border/60 shrink-0">
                      <img src={receiptPreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* Resumen de Saldo */}
              <div className="p-3 bg-muted/30 border border-border/60 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Saldo actual:</span>
                  <span className="font-bold text-foreground">
                    RD$ {currentBalance.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-right">
                  <span className="text-muted-foreground block text-[11px]">Saldo con esta recarga:</span>
                  <span className="font-bold text-primary">
                    RD$ {(currentBalance + numericAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Botón de Enviar */}
              <Button
                type="submit"
                disabled={isSubmittingTopup || !isAmountValid || !referenceNumber.trim()}
                className="w-full h-11 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-xs cursor-pointer gap-2"
              >
                {isSubmittingTopup ? (
                  'Registrando transferencia...'
                ) : (
                  <>
                    Enviar Solicitud &bull; RD$ {numericAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
