import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Receipt, Loader2, Calendar } from 'lucide-react';
import { Supplier } from '@/hooks/useSuppliers';
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

interface SupplierDebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  onSaveDebt: (data: {
    supplier_id: string;
    amount: number;
    description: string;
    category: string;
    due_date?: string | null;
  }) => Promise<any>;
}

export const SupplierDebtDialog: React.FC<SupplierDebtDialogProps> = ({
  open,
  onOpenChange,
  supplier,
  onSaveDebt,
}) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Inventario',
    due_date: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) return;

    if (!formData.description.trim()) {
      toast({
        title: "Concepto requerido",
        description: "Ingresa el concepto de la compra o factura a crédito.",
        variant: "destructive",
      });
      return;
    }

    const numAmount = parseFloat(formData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: "Monto inválido",
        description: "El monto debe ser un valor mayor a cero.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      await onSaveDebt({
        supplier_id: supplier.id,
        amount: numAmount,
        description: formData.description.trim(),
        category: formData.category,
        due_date: formData.due_date ? formData.due_date : null,
      });

      setFormData({
        description: '',
        amount: '',
        category: 'Inventario',
        due_date: '',
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error al registrar deuda",
        description: error.message || "No se pudo registrar la cuenta por pagar.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] rounded-3xl border border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black tracking-tight">
            <Receipt className="h-5 w-5 text-red-500" />
            Registrar Deuda / Compra a Crédito
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {supplier
              ? `Registra una cuenta por pagar con el proveedor ${supplier.name}.`
              : 'Agrega una nueva cuenta por pagar.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="debt-desc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Concepto / Factura *
            </Label>
            <Input
              id="debt-desc"
              placeholder="Ej. Factura #B010000045, Mercancía a crédito"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="h-10 rounded-xl text-sm font-semibold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="debt-amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Monto ($) *
              </Label>
              <Input
                id="debt-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="h-10 rounded-xl text-sm font-black text-red-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="debt-due" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Vencimiento
              </Label>
              <Input
                id="debt-due"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="h-10 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Categoría
            </Label>
            <Select
              value={formData.category}
              onValueChange={(val) => setFormData({ ...formData, category: val })}
            >
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
              className="bg-red-600 hover:bg-red-500 text-white rounded-xl h-10 px-6 font-bold text-xs shadow-md shadow-red-500/20 gap-2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar Cuenta por Pagar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
