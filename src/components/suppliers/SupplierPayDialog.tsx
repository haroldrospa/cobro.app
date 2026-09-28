import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Loader2, CheckCircle } from 'lucide-react';
import { SupplierDebt, useSupplierDebts } from '@/hooks/useSupplierDebts';
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
  allDebts?: SupplierDebt[];
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
  allDebts,
  onPayDebt,
}) => {
  const { toast } = useToast();
  const { supplierDebts: hookDebts } = useSupplierDebts();
  const [isSaving, setIsSaving] = useState(false);
  const [amountToPay, setAmountToPay] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Inventario');

  const currentDebtRemaining = debt ? Math.max(0, Number(debt.amount) - Number(debt.amount_paid)) : 0;

  const subsequentDebts = useMemo(() => {
    if (!debt) return [];
    const sourceList = allDebts && allDebts.length > 0 ? allDebts : hookDebts;
    return sourceList
      .filter((d) => d.supplier_id === debt.supplier_id && d.id !== debt.id && d.status !== 'paid')
      .sort((a, b) => {
        if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
  }, [debt, allDebts, hookDebts]);

  const subsequentTotalRemaining = useMemo(() => {
    return subsequentDebts.reduce((sum, d) => sum + Math.max(0, Number(d.amount) - Number(d.amount_paid)), 0);
  }, [subsequentDebts]);

  const totalSupplierRemaining = currentDebtRemaining + subsequentTotalRemaining;

  const numAmount = parseFloat(amountToPay) || 0;
  const excess = Math.max(0, numAmount - currentDebtRemaining);

  const distributionPlan = useMemo(() => {
    if (!debt || excess <= 0.001) return [];
    let remainingExcess = excess;
    const plan: Array<{
      id: string;
      description: string;
      allocated: number;
      willBeFullyPaid: boolean;
    }> = [];

    for (const nextDebt of subsequentDebts) {
      if (remainingExcess <= 0.001) break;
      const rem = Math.max(0, Number(nextDebt.amount) - Number(nextDebt.amount_paid));
      if (rem <= 0) continue;
      const alloc = Math.min(remainingExcess, rem);
      const willBePaid = Number(nextDebt.amount_paid) + alloc >= Number(nextDebt.amount);
      plan.push({
        id: nextDebt.id,
        description: nextDebt.description,
        allocated: alloc,
        willBeFullyPaid: willBePaid,
      });
      remainingExcess -= alloc;
    }
    return plan;
  }, [debt, excess, subsequentDebts]);

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

    const parsedAmount = parseFloat(amountToPay);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: "Monto inválido",
        description: "Introduce un monto válido mayor a 0.",
        variant: "destructive",
      });
      return;
    }

    if (parsedAmount > totalSupplierRemaining + 0.01) {
      toast({
        title: "Monto excede la deuda total",
        description: `El monto a pagar ($${parsedAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}) supera la deuda total pendiente de este proveedor ($${totalSupplierRemaining.toLocaleString('es-DO', { minimumFractionDigits: 2 })}).`,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      await onPayDebt({
        debtId: debt.id,
        amountToPay: parsedAmount,
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
      <DialogContent className="sm:max-w-[430px] rounded-3xl border border-border/60">
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
          {/* Tarjeta de saldos */}
          <div className="p-3.5 bg-muted/30 rounded-2xl border border-border/40 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Saldo Pendiente {subsequentDebts.length > 0 ? '(Esta Factura)' : ''}
              </span>
              <span className="text-xl font-black text-red-500 font-mono">
                ${currentDebtRemaining.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {subsequentDebts.length > 0 && (
                <span className="text-[11px] text-muted-foreground block">
                  Deuda total proveedor: <strong className="text-foreground font-mono font-bold">${totalSupplierRemaining.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</strong> ({subsequentDebts.length + 1} facturas)
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs font-bold rounded-xl gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                onClick={() => setAmountToPay(currentDebtRemaining.toString())}
              >
                <CheckCircle className="h-3 w-3" /> Pagar Factura
              </Button>
              {subsequentDebts.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] font-bold rounded-lg text-primary hover:bg-primary/10 px-2"
                  onClick={() => setAmountToPay(totalSupplierRemaining.toString())}
                  title="Pagar todas las facturas pendientes de este proveedor"
                >
                  Pagar Deuda Total
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pay-amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Monto a Pagar / Abonar ($) *
              </Label>
              {subsequentDebts.length > 0 && (
                <span className="text-[10px] text-muted-foreground font-medium">
                  Máximo total: <strong className="font-mono text-foreground">${totalSupplierRemaining.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</strong>
                </span>
              )}
            </div>
            <Input
              id="pay-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amountToPay}
              onChange={(e) => setAmountToPay(e.target.value)}
              className="h-10 rounded-xl font-black text-base text-emerald-600 dark:text-emerald-400"
              required
            />
          </div>

          {/* Distribución automática en cascada a facturas siguientes */}
          {excess > 0.001 && (
            subsequentDebts.length > 0 ? (
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/25 text-xs space-y-2 animate-in fade-in-50">
                <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>Distribución automática del pago:</span>
                </div>
                <div className="space-y-1 text-muted-foreground text-[11px] pl-5">
                  <p>
                    • <strong className="text-foreground font-mono">${currentDebtRemaining.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</strong> saldará esta factura ({debt?.description}).
                  </p>
                  <p>
                    • <strong className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">${Math.min(excess, subsequentTotalRemaining).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</strong> se abonará a la(s) siguiente(s) factura(s):
                  </p>
                  <div className="space-y-1.5 mt-1 pt-1.5 border-t border-emerald-500/20">
                    {distributionPlan.map((planItem) => (
                      <div key={planItem.id} className="flex items-center justify-between text-foreground">
                        <span className="truncate max-w-[200px] font-medium">• {planItem.description}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            +${planItem.allocated.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </span>
                          {planItem.willBeFullyPaid ? (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-bold">
                              Liquidada
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-bold">
                              Abono
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {excess > subsequentTotalRemaining && (
                      <p className="text-[10px] text-red-500 font-semibold pt-1">
                        ⚠️ El monto excede la deuda de todas las facturas en ${(excess - subsequentTotalRemaining).toLocaleString('es-DO', { minimumFractionDigits: 2 })}.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400">
                ⚠️ Este proveedor no tiene otras facturas pendientes. El monto máximo para saldar es ${currentDebtRemaining.toLocaleString('es-DO', { minimumFractionDigits: 2 })}.
              </div>
            )
          )}

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
