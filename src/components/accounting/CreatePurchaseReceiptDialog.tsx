import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Trash2, Search, FileText, CheckCircle2, ShieldCheck, Sparkles, Building2, User } from 'lucide-react';
import { usePurchaseReceipts, PurchaseReceiptItem } from '@/hooks/usePurchaseReceipts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { lookupRnc } from '@/lib/rncLookup';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface CreatePurchaseReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const EXPENSE_CATEGORIES = [
  'Inventario',
  'Mantenimiento',
  'Servicios Públicos',
  'Alquiler',
  'Marketing',
  'Otros'
];

export const CreatePurchaseReceiptDialog: React.FC<CreatePurchaseReceiptDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { toast } = useToast();
  const { getNextSequence, createPurchaseReceipt, isCreating, isElectronicActive } = usePurchaseReceipts();
  const { suppliers } = useSuppliers();

  // Mode: E41 or B11
  const [isElectronic, setIsElectronic] = useState<boolean>(isElectronicActive);
  const [ncf, setNcf] = useState<string>('');
  const [loadingSequence, setLoadingSequence] = useState(false);

  // Supplier info
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('custom');
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierRncCedula, setSupplierRncCedula] = useState<string>('');
  const [isLookingUpRnc, setIsLookingUpRnc] = useState<boolean>(false);

  // General fields
  const [issueDate, setIssueDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<string>('Inventario');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [createExpense, setCreateExpense] = useState<boolean>(true);

  // Items
  const [items, setItems] = useState<PurchaseReceiptItem[]>([
    { description: '', quantity: 1, unit_price: 0, subtotal: 0 }
  ]);

  // Tax and Withholding Rates
  const [itbisRate, setItbisRate] = useState<number>(18);
  const [itbisRetentionRate, setItbisRetentionRate] = useState<number>(100); // 100% standard for informal suppliers
  const [isrRetentionRate, setIsrRetentionRate] = useState<number>(2); // 2% for general services / 10% for professional / 0% for goods

  // Refresh sequence when open changes or electronic mode changes
  useEffect(() => {
    if (open) {
      setIsElectronic(isElectronicActive);
      fetchSequence(isElectronicActive);
    }
  }, [open, isElectronicActive]);

  const fetchSequence = async (elec: boolean) => {
    setLoadingSequence(true);
    try {
      const seq = await getNextSequence(elec);
      setNcf(seq.ncf);
    } catch (err) {
      console.error("Error fetching purchase sequence:", err);
    } finally {
      setLoadingSequence(false);
    }
  };

  const handleToggleElectronic = (val: boolean) => {
    setIsElectronic(val);
    fetchSequence(val);
  };

  // Supplier selection change
  const handleSupplierSelect = (id: string) => {
    setSelectedSupplierId(id);
    if (id === 'custom') {
      setSupplierName('');
      setSupplierRncCedula('');
      return;
    }

    const s = suppliers.find(sup => sup.id === id);
    if (s) {
      setSupplierName(s.name);
      setSupplierRncCedula(s.rnc || '');
    }
  };

  // Auto RNC/Cedula lookup
  const handleLookupRnc = async () => {
    const cleanId = supplierRncCedula.replace(/[^\d]/g, '');
    if (cleanId.length !== 9 && cleanId.length !== 11) {
      toast({
        title: "Cédula o RNC inválido",
        description: "Debe contener 9 dígitos (RNC) u 11 dígitos (Cédula).",
        variant: "destructive"
      });
      return;
    }

    setIsLookingUpRnc(true);
    try {
      const info = await lookupRnc(cleanId);
      if (info && info.name) {
        setSupplierName(info.name);
        toast({
          title: "Proveedor identificado",
          description: `Razón social: ${info.name}`
        });
      } else {
        toast({
          title: "No encontrado en padrón",
          description: "Puedes escribir el nombre manualmente.",
        });
      }
    } catch {
      toast({
        title: "Consulta no disponible",
        description: "Ingresa el nombre del proveedor manualmente.",
      });
    } finally {
      setIsLookingUpRnc(false);
    }
  };

  // Item handlers
  const handleItemChange = (index: number, field: keyof PurchaseReceiptItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      
      const qty = field === 'quantity' ? Number(value) : item.quantity;
      const price = field === 'unit_price' ? Number(value) : item.unit_price;
      item.subtotal = Math.max(0, qty * price);

      updated[index] = item;
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0, subtotal: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const calculations = useMemo(() => {
    const subtotal = items.reduce((sum, it) => sum + (it.subtotal || 0), 0);
    const itbisAmount = (subtotal * itbisRate) / 100;
    const itbisRetained = (itbisAmount * itbisRetentionRate) / 100;
    const isrRetained = (subtotal * isrRetentionRate) / 100;
    const totalAmount = subtotal + itbisAmount;
    const totalNetPaid = Math.max(0, totalAmount - itbisRetained - isrRetained);

    return {
      subtotal,
      itbisAmount,
      itbisRetained,
      isrRetained,
      totalAmount,
      totalNetPaid,
    };
  }, [items, itbisRate, itbisRetentionRate, isrRetentionRate]);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierName.trim()) {
      toast({ title: "Campo requerido", description: "Indica el nombre del proveedor.", variant: "destructive" });
      return;
    }

    const cleanId = supplierRncCedula.replace(/[^\d]/g, '');
    if (!cleanId || (cleanId.length !== 9 && cleanId.length !== 11)) {
      toast({
        title: "Cédula / RNC requerida",
        description: "El Comprobante de Compras exige la Cédula (11 dígitos) o RNC (9 dígitos) de la persona física.",
        variant: "destructive"
      });
      return;
    }

    if (!ncf.trim()) {
      toast({ title: "Secuencia NCF requerida", description: "No se ha generado el número de comprobante.", variant: "destructive" });
      return;
    }

    if (calculations.subtotal <= 0) {
      toast({ title: "Monto inválido", description: "El subtotal debe ser mayor a 0.", variant: "destructive" });
      return;
    }

    const receiptDesc = description.trim() || items.map(i => i.description).filter(Boolean).join(', ') || 'Compra con comprobante e-CF 41';

    try {
      await createPurchaseReceipt({
        supplier_id: selectedSupplierId !== 'custom' ? selectedSupplierId : null,
        supplier_name: supplierName.trim(),
        supplier_rnc_cedula: cleanId,
        ncf: ncf.trim(),
        ncf_type: isElectronic ? 'E41' : 'B11',
        issue_date: issueDate ? new Date(issueDate).toISOString() : new Date().toISOString(),
        description: receiptDesc,
        subtotal: calculations.subtotal,
        itbis_rate: itbisRate,
        itbis_amount: calculations.itbisAmount,
        itbis_retained: calculations.itbisRetained,
        itbis_retention_rate: itbisRetentionRate,
        isr_retention_rate: isrRetentionRate,
        isr_retained: calculations.isrRetained,
        total_amount: calculations.totalAmount,
        total_net_paid: calculations.totalNetPaid,
        payment_method: paymentMethod,
        category: category,
        is_electronic: isElectronic,
        items: items,
        create_expense: createExpense,
      });

      onOpenChange(false);
      if (onSuccess) onSuccess();

      // Reset
      setDescription('');
      setItems([{ description: '', quantity: 1, unit_price: 0, subtotal: 0 }]);
      setSelectedSupplierId('custom');
      setSupplierName('');
      setSupplierRncCedula('');
    } catch (err: any) {
      console.error("Error al emitir comprobante de compras:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl bg-card border-border">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Comprobante de Compras
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Emisión fiscal tipo {isElectronic ? 'e-CF 41 (e-NCF E41)' : 'B11'} para compras a personas físicas
                </p>
              </div>
            </div>

            {/* Toggle Electronic / Traditional */}
            <div className="flex items-center gap-2 bg-card p-1.5 rounded-xl border border-border/60 text-xs">
              <span className={`font-semibold px-2 py-0.5 rounded-lg ${isElectronic ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}>
                e-CF 41
              </span>
              <Switch
                checked={isElectronic}
                onCheckedChange={handleToggleElectronic}
                aria-label="Alternar e-CF 41 o B11"
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Fila: NCF, Fecha y Método de Pago */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Secuencia {isElectronic ? 'e-NCF' : 'NCF'}
              </Label>
              <div className="relative mt-1">
                <Input
                  value={ncf}
                  onChange={(e) => setNcf(e.target.value.toUpperCase())}
                  placeholder={isElectronic ? "E410000000001" : "B1100000001"}
                  className="font-mono font-bold text-primary tracking-wider"
                  disabled={loadingSequence}
                  required
                />
                {loadingSequence && (
                  <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Fecha de Emisión
              </Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="mt-1 font-medium"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Forma de Pago
              </Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="transfer">Transferencia Bancaria</SelectItem>
                  <SelectItem value="check">Cheque</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sección Proveedor / Suplidor Informal */}
          <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Proveedor / Persona Física
              </span>

              {suppliers.length > 0 && (
                <Select value={selectedSupplierId} onValueChange={handleSupplierSelect}>
                  <SelectTrigger className="h-7 text-xs w-48 border-border/60">
                    <SelectValue placeholder="Seleccionar suplidor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">-- Escribir nuevo --</SelectItem>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold text-muted-foreground">
                  Cédula o RNC del Vendedor *
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={supplierRncCedula}
                    onChange={(e) => setSupplierRncCedula(e.target.value)}
                    placeholder="Ej. 001-0000000-0 o RNC"
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleLookupRnc}
                    disabled={isLookingUpRnc || !supplierRncCedula.trim()}
                    title="Consultar Padrón DGII"
                    className="shrink-0"
                  >
                    {isLookingUpRnc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-muted-foreground">
                  Nombre Completo / Razón Social *
                </Label>
                <Input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Ej. Juan Pérez (Plomero, Agricultor, etc.)"
                  className="mt-1"
                  required
                />
              </div>
            </div>
          </div>

          {/* Items / Conceptos de Compra */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Conceptos / Bienes o Servicios Adquiridos
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddItem}
                className="h-7 text-xs font-bold text-primary hover:text-primary gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Línea
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={item.description}
                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    placeholder="Descripción del bien o servicio"
                    className="flex-1 text-xs"
                    required
                  />
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                    placeholder="Cant."
                    className="w-20 text-xs text-center"
                    required
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price || ''}
                    onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                    placeholder="Precio RD$"
                    className="w-28 text-xs text-right"
                    required
                  />
                  <span className="w-24 text-right text-xs font-mono font-bold text-foreground shrink-0">
                    RD$ {Number(item.subtotal || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(idx)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Configuración de Retenciones Fiscales DGII */}
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" /> Retenciones Fiscales DGII (Comprobante de Compras)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* ITBIS Facturado */}
              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground">Tasa ITBIS</Label>
                <Select value={String(itbisRate)} onValueChange={(val) => setItbisRate(Number(val))}>
                  <SelectTrigger className="h-8 mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="18">18% (General)</SelectItem>
                    <SelectItem value="16">16% (Reducido)</SelectItem>
                    <SelectItem value="0">0% (Exento)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Retención de ITBIS */}
              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground">Retención ITBIS (Norma 02-05)</Label>
                <Select value={String(itbisRetentionRate)} onValueChange={(val) => setItbisRetentionRate(Number(val))}>
                  <SelectTrigger className="h-8 mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100% (Personas Físicas)</SelectItem>
                    <SelectItem value="30">30% (Comercial)</SelectItem>
                    <SelectItem value="0">0% (Sin Retención)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Retención de ISR */}
              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground">Retención ISR (Norma 07-07)</Label>
                <Select value={String(isrRetentionRate)} onValueChange={(val) => setIsrRetentionRate(Number(val))}>
                  <SelectTrigger className="h-8 mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2% (Servicios Generales / Oficios)</SelectItem>
                    <SelectItem value="10">10% (Honorarios / Profesionales)</SelectItem>
                    <SelectItem value="0">0% (Bienes / No aplica)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Resumen de Valores Financieros */}
          <div className="bg-muted/30 p-4 rounded-xl border border-border/80 space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal Neto:</span>
              <span className="font-mono font-semibold">RD$ {calculations.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>ITBIS Calculado ({itbisRate}%):</span>
              <span className="font-mono font-semibold">+ RD$ {calculations.itbisAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border/40">
              <span>Monto Total Facturado:</span>
              <span className="font-mono">RD$ {calculations.totalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
            </div>

            {calculations.itbisRetained > 0 && (
              <div className="flex justify-between text-amber-500 font-medium">
                <span>(-) Retención ITBIS ({itbisRetentionRate}%):</span>
                <span className="font-mono">- RD$ {calculations.itbisRetained.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            {calculations.isrRetained > 0 && (
              <div className="flex justify-between text-amber-500 font-medium">
                <span>(-) Retención ISR ({isrRetentionRate}%):</span>
                <span className="font-mono">- RD$ {calculations.isrRetained.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            <div className="flex justify-between items-center font-black text-sm text-primary pt-2 border-t border-border">
              <span>Total Neto a Pagar al Proveedor:</span>
              <span className="font-mono text-base">RD$ {calculations.totalNetPaid.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Opciones adicionales: Categoría y Sincronización con Gastos */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="w-full sm:w-60">
              <Label className="text-xs font-bold text-muted-foreground">Categoría del Gasto</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="create-expense-switch"
                checked={createExpense}
                onCheckedChange={setCreateExpense}
              />
              <Label htmlFor="create-expense-switch" className="text-xs font-medium cursor-pointer">
                Registrar automáticamente como Gasto en Contabilidad
              </Label>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="gap-2 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl gap-2 min-w-[170px]"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Emitiendo...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Emitir Comprobante
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
