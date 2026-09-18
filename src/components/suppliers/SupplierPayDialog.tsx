import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Loader2, CheckCircle } from 'lucide-react';
import { SupplierDebt } from '@/hooks/useSupplierDebts';
import { useToast } from '@/hooks/use-toast';

const CATEGORIES = [
  'Inventario',
  'Servicios Públicos',
  'Alquiler',
  'Nómina',
  'Mantenimiento',
  'Marketing',
  'Impuestos',
  'Otros',
];

interface SupplierPayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt: SupplierDebt | null;
  onPayDebt: (payload: {
    debtId: string;
    amountToPay: number;
    category?: string;
    description?: string;
  }) => Promise<any>;
}

export const SupplierPayDialog: React.FC<SupplierPayDialogProps> = ({
  open,
  onOpenChange,
  debt,
  onPayDebt,
}) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [amountToPay, setAmountToPay] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Inventario');

  const remaining = debt ? Math.max(0, Number(debt.amount) - Number(debt.amount_paid)) : 0;

  useEffect(() => {
    if (debt) {
      const rem = Math.max(0, Number(debt.amount) - Number(debt.amount_paid));
      setAmountToPay(rem > 0 ? rem.toString() : '');
      setDescription(`Abono Deuda: ${debt.description}`);
      setCategory(debt.category || 'Inventario');
    }
  }, [debt, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debt) return;

    const numAmount = parseFloat(amountToPay);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: "Monto inválido",
        description: "Introduce un monto válido mayor a 0.",
        variant: "destructive",
      });
      return;
    }

    if (numAmount > remaining + 0.01) {
      toast({
        title: "Monto excede el saldo",
        description: `El monto a pagar ($${numAmount.toLocaleString()}) supera la deuda restante ($${remaining.toLocaleString()}).`,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      await onPayDebt({
        debtId: debt.id,
        amountToPay: numAmount,
        category,
        description: description.trim() || `Pago de factura ${debt.description}`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error al registrar pago",
        description: error.message || "No se pudo registrar el pago.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] rounded-3xl border border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black tracking-tight">
            <DollarSign className="h-5 w-5 text-emerald-500" />
            Registrar Pago / Abono a Deuda
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {debt
              ? `Abono para "${debt.description}". Se registrará automáticamente el egreso financiero en contabilidad.`
              : 'Registra un pago a cuenta por pagar.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="p-3.5 bg-muted/30 rounded-2xl border border-border/40 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Saldo Pendiente
              </span>
              <span className="text-xl font-black text-red-500 font-mono">
                ${remaining.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold rounded-xl gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
              onClick={() => setAmountToPay(remaining.toString())}
            >
              <CheckCircle className="h-3.5 w-3.5" /> Pagar Todo
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Monto a Pagar / Abonar ($) *
            </Label>
            <Input
              id="pay-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              placeholder="0.00"
              value={amountToPay}
              onChange={(e) => setAmountToPay(e.target.value)}
              className="h-10 rounded-xl font-black text-base text-emerald-600 dark:text-emerald-400"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-desc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Concepto del Egreso
            </Label>
            <Input
              id="pay-desc"
              placeholder="Ej. Transferencia Banco Popular, Pago en efectivo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-10 rounded-xl text-xs font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Categoría de Egreso
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-10 rounded-xl text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat} className="text-xs">
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-10 text-xs font-bold"
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-10 px-6 font-bold text-xs shadow-md shadow-emerald-500/20 gap-2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar y Registrar Egreso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
