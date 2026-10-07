import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  FileText,
  Briefcase,
  User,
  Calendar,
  CreditCard,
  Building,
  CheckCircle2,
  ShoppingCart,
  Loader2,
  ArrowRight,
  DollarSign,
  Percent
} from 'lucide-react';
import { CartItem } from '@/types/pos';
import { Customer } from '@/hooks/useCustomers';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface ServiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number; // e.g. 18, 16, 0
}

interface GenerateServiceInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  invoiceTypes: any[];
  onLoadToCart: (items: CartItem[], customerId: string, invoiceTypeId: string) => void;
  onDirectEmit: (data: {
    customerId: string;
    invoiceTypeId: string;
    items: CartItem[];
    paymentMethod: string;
    creditDays?: number;
    notes?: string;
  }) => Promise<void>;
  isEmitting?: boolean;
  currencySymbol?: string;
  defaultTaxRate?: number;
}

export const GenerateServiceInvoiceDialog: React.FC<GenerateServiceInvoiceDialogProps> = ({
  isOpen,
  onClose,
  customers = [],
  invoiceTypes = [],
  onLoadToCart,
  onDirectEmit,
  isEmitting = false,
  currencySymbol = 'RD$',
  defaultTaxRate = 18,
}) => {
  const { toast } = useToast();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedInvoiceTypeId, setSelectedInvoiceTypeId] = useState<string>(() => {
    const b01 = invoiceTypes.find(t => t.code === 'B01');
    const b02 = invoiceTypes.find(t => t.code === 'B02');
    return b01?.id || b02?.id || invoiceTypes[0]?.id || '';
  });

  const [paymentCondition, setPaymentCondition] = useState<'contado' | 'credito'>('contado');
  const [paymentMethod, setPaymentMethod] = useState<string>('transfer');
  const [creditDays, setCreditDays] = useState<number>(30);
  const [notes, setNotes] = useState<string>('');

  const [serviceLines, setServiceLines] = useState<ServiceLineItem[]>([
    {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: defaultTaxRate,
    }
  ]);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const selectedInvoiceType = useMemo(() => {
    if (selectedInvoiceTypeId === 'COT') {
      return { id: 'COT', code: 'COT', name: 'Cotización' };
    }
    return invoiceTypes.find(t => t.id === selectedInvoiceTypeId);
  }, [invoiceTypes, selectedInvoiceTypeId]);

  // Manejo de líneas
  const handleAddLine = () => {
    setServiceLines(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: defaultTaxRate,
      }
    ]);
  };

  const handleRemoveLine = (id: string) => {
    if (serviceLines.length <= 1) {
      toast({
        title: "Atención",
        description: "Debe haber al menos una línea de servicio.",
        variant: "destructive"
      });
      return;
    }
    setServiceLines(prev => prev.filter(l => l.id !== id));
  };

  const handleUpdateLine = (id: string, field: keyof ServiceLineItem, value: any) => {
    setServiceLines(prev => prev.map(line => {
      if (line.id !== id) return line;
      return { ...line, [field]: value };
    }));
  };

  // Cálculos de totales
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;

    serviceLines.forEach(line => {
      const lineSub = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
      const lineTax = lineSub * ((Number(line.taxRate) || 0) / 100);
      subtotal += lineSub;
      taxTotal += lineTax;
    });

    const grandTotal = subtotal + taxTotal;

    return {
      subtotal,
      taxTotal,
      grandTotal,
    };
  }, [serviceLines]);

  // Convertir líneas de servicios a CartItems compatibles con el POS
  const buildCartItems = (): CartItem[] => {
    return serviceLines.map((line, index) => {
      const lineSub = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
      const taxRateDec = (Number(line.taxRate) || 0) / 100;
      return {
        id: `service-${index + 1}-${Date.now()}`,
        cartItemId: line.id,
        name: line.description.trim() || `Servicio Profesional ${index + 1}`,
        price: Number(line.unitPrice) || 0,
        quantity: Number(line.quantity) || 1,
        tax: taxRateDec,
        cost_includes_tax: false,
        comment: 'Servicio facturado en formato Carta'
      };
    });
  };

  // Validaciones
  const validateInvoice = (): boolean => {
    const emptyDesc = serviceLines.some(l => !l.description.trim());
    if (emptyDesc) {
      toast({
        title: "Descripción requerida",
        description: "Por favor describe el concepto en cada línea de servicio.",
        variant: "destructive"
      });
      return false;
    }

    const invalidPrice = serviceLines.some(l => Number(l.unitPrice) <= 0 || Number(l.quantity) <= 0);
    if (invalidPrice) {
      toast({
        title: "Monto inválido",
        description: "El precio y la cantidad deben ser mayores a cero en cada servicio.",
        variant: "destructive"
      });
      return false;
    }

    // Si es crédito fiscal (B01 / E31), requiere cliente con RNC
    const code = selectedInvoiceType?.code || '';
    if (['B01', 'E31', 'B14', 'B15'].includes(code)) {
      if (!selectedCustomerId) {
        toast({
          title: "Cliente requerido",
          description: `El comprobante ${code} requiere seleccionar un cliente con RNC/Cédula.`,
          variant: "destructive"
        });
        return false;
      }
    }

    return true;
  };

  const handleLoadToCartClick = () => {
    if (!validateInvoice()) return;
    const items = buildCartItems();
    onLoadToCart(items, selectedCustomerId, selectedInvoiceTypeId);
    toast({
      title: "Servicios cargados",
      description: "Los conceptos de servicios han sido añadidos al carrito del POS."
    });
    onClose();
  };

  const handleDirectEmitClick = async () => {
    if (!validateInvoice()) return;
    const items = buildCartItems();
    const finalMethod = paymentCondition === 'credito' ? 'credit' : paymentMethod;

    await onDirectEmit({
      customerId: selectedCustomerId,
      invoiceTypeId: selectedInvoiceTypeId,
      items,
      paymentMethod: finalMethod,
      creditDays: paymentCondition === 'credito' ? creditDays : undefined,
      notes: notes.trim() || undefined
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[96vw] md:max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl md:rounded-[2rem]">
        {/* Cabecera */}
        <div className="p-4 sm:p-6 border-b border-border bg-muted/20 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
              <Briefcase className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-xl font-black uppercase tracking-wider flex items-center gap-2">
                Generar Factura de Servicios
                <span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Formato Carta
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Emisión de comprobantes para contabilidad, consultoría y servicios profesionales
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Cuerpo del formulario con Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Fila 1: Cliente y Tipo de Factura (NCF) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-xl border border-border/60">
            {/* Cliente */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-foreground">
                <User className="h-3.5 w-3.5 text-emerald-500" />
                Cliente / Empresa
              </Label>
              <Select
                value={selectedCustomerId || 'none'}
                onValueChange={(val) => setSelectedCustomerId(val === 'none' ? '' : val)}
              >
                <SelectTrigger className="h-11 rounded-xl bg-background border-border text-sm">
                  <SelectValue placeholder="Seleccione un cliente (opcional para B02)" />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-xl">
                  <SelectItem value="none">
                    <span className="text-muted-foreground italic">Cliente General / Ocasional</span>
                  </SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-semibold">{c.name}</span>
                      {c.rnc ? ` - RNC: ${c.rnc}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCustomer && (
                <div className="text-[11px] text-muted-foreground flex gap-3 pt-1">
                  <span>RNC/Cédula: <strong>{selectedCustomer.rnc || 'Sin RNC'}</strong></span>
                  {selectedCustomer.phone && <span>Tel: <strong>{selectedCustomer.phone}</strong></span>}
                </div>
              )}
            </div>

            {/* Comprobante Fiscal */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-foreground">
                <Building className="h-3.5 w-3.5 text-emerald-500" />
                Tipo de Comprobante (NCF)
              </Label>
              <Select
                value={selectedInvoiceTypeId}
                onValueChange={setSelectedInvoiceTypeId}
              >
                <SelectTrigger className="h-11 rounded-xl bg-background border-border text-sm">
                  <SelectValue placeholder="Seleccione tipo de comprobante" />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-xl">
                  <SelectItem value="COT">
                    <span className="font-bold text-amber-500 mr-2">COT</span>
                    <span>Cotización</span>
                  </SelectItem>
                  {invoiceTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <span className="font-bold text-emerald-500 mr-2">{type.code}</span>
                      <span>{type.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground pt-1">
                La numeración fiscal se genera de forma secuencial y automática.
              </p>
            </div>
          </div>

          {/* Fila 2: Condiciones de Pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-card p-4 rounded-xl border border-border/60">
            {/* Condición: Contado o Crédito */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-foreground">
                <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
                Condición
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentCondition('contado')}
                  className={cn(
                    "h-10 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all",
                    paymentCondition === 'contado'
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                      : "bg-background border-border text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  Contado
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentCondition('credito')}
                  className={cn(
                    "h-10 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all",
                    paymentCondition === 'credito'
                      ? "bg-amber-500/10 border-amber-500 text-amber-400"
                      : "bg-background border-border text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  A Crédito
                </button>
              </div>
            </div>

            {/* Si es Contado: Método de pago */}
            {paymentCondition === 'contado' ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Método de Pago
                </Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-10 rounded-xl bg-background border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="transfer">Transferencia Bancaria</SelectItem>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="card">Tarjeta de Crédito / Débito</SelectItem>
                    <SelectItem value="check">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 text-foreground">
                  <Calendar className="h-3.5 w-3.5 text-amber-500" />
                  Días de Crédito
                </Label>
                <Select value={String(creditDays)} onValueChange={(val) => setCreditDays(Number(val))}>
                  <SelectTrigger className="h-10 rounded-xl bg-background border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="15">15 Días</SelectItem>
                    <SelectItem value="30">30 Días (Estándar)</SelectItem>
                    <SelectItem value="45">45 Días</SelectItem>
                    <SelectItem value="60">60 Días</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Observaciones / Referencia */}
            <div className="space-y-1.5 sm:col-span-2 md:col-span-1">
              <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
                Nota / Referencia
              </Label>
              <Input
                placeholder="Ej. Contrato #2026-B, Proyecto Web..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-10 rounded-xl bg-background border-border text-xs"
              />
            </div>
          </div>

          {/* Fila 3: Líneas de Servicios */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-500" />
                Conceptos y Servicios a Facturar
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLine}
                className="h-8 px-3 rounded-xl border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs font-bold gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar Servicio
              </Button>
            </div>

            <div className="space-y-3">
              {serviceLines.map((line, idx) => {
                const lineSubtotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                const lineTax = lineSubtotal * ((Number(line.taxRate) || 0) / 100);
                const lineTotal = lineSubtotal + lineTax;

                return (
                  <div
                    key={line.id}
                    className="p-3.5 rounded-xl border border-border/60 bg-card hover:border-emerald-500/30 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        Línea #{idx + 1}
                      </span>
                      {serviceLines.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveLine(line.id)}
                          className="h-7 w-7 text-red-400 hover:bg-red-500/10 hover:text-red-500 rounded-lg"
                          title="Eliminar línea"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      {/* Descripción del Servicio */}
                      <div className="md:col-span-6 space-y-1">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Descripción detallada del servicio
                        </Label>
                        <Textarea
                          placeholder="Ej. Honorarios por servicios contables y declaraciones fiscales del mes de Octubre 2026..."
                          value={line.description}
                          onChange={(e) => handleUpdateLine(line.id, 'description', e.target.value)}
                          className="min-h-[58px] text-xs rounded-xl bg-background border-border resize-none"
                        />
                      </div>

                      {/* Cantidad */}
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Cant.
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={line.quantity || ''}
                          onChange={(e) => handleUpdateLine(line.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-10 text-xs font-semibold rounded-xl bg-background border-border text-center"
                        />
                      </div>

                      {/* Precio Unitario */}
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Precio Unitario ({currencySymbol})
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={line.unitPrice || ''}
                          onChange={(e) => handleUpdateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="h-10 text-xs font-bold rounded-xl bg-background border-border text-right"
                        />
                      </div>

                      {/* ITBIS / Tasa */}
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          ITBIS / Tasa
                        </Label>
                        <Select
                          value={String(line.taxRate)}
                          onValueChange={(val) => handleUpdateLine(line.id, 'taxRate', parseFloat(val))}
                        >
                          <SelectTrigger className="h-10 text-xs rounded-xl bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="18">18% (General)</SelectItem>
                            <SelectItem value="16">16%</SelectItem>
                            <SelectItem value="0">0% (Exento)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40 text-muted-foreground">
                      <span>Subtotal: {currencySymbol} {lineSubtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                      <span>ITBIS ({line.taxRate}%): {currencySymbol} {lineTax.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                      <span className="font-bold text-foreground">
                        Total Línea: {currencySymbol} {lineTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pie de diálogo: Resumen y Acciones */}
        <div className="p-4 sm:p-6 border-t border-border bg-muted/20 flex-shrink-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-3 rounded-xl border border-border">
            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
              <div>
                <span className="text-muted-foreground uppercase text-[10px] font-bold block">Subtotal</span>
                <span className="font-semibold text-foreground">
                  {currencySymbol} {totals.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-6 w-px bg-border hidden sm:block" />
              <div>
                <span className="text-muted-foreground uppercase text-[10px] font-bold block">ITBIS Total</span>
                <span className="font-semibold text-emerald-500">
                  {currencySymbol} {totals.taxTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-muted-foreground uppercase text-[10px] font-black tracking-widest block">Total General</span>
              <span className="text-lg sm:text-2xl font-black text-emerald-400">
                {currencySymbol} {totals.grandTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-11 px-5 rounded-xl border-border text-xs font-bold"
              disabled={isEmitting}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleLoadToCartClick}
              className="h-11 px-5 rounded-xl border-border hover:bg-muted text-xs font-bold gap-2"
              disabled={isEmitting}
            >
              <ShoppingCart className="h-4 w-4" />
              Cargar al Carrito POS
            </Button>

            <Button
              type="button"
              onClick={handleDirectEmitClick}
              className={cn(
                "h-11 px-6 rounded-xl text-white font-bold text-xs gap-2 shadow-lg",
                selectedInvoiceTypeId === 'COT'
                  ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/20"
                  : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
              )}
              disabled={isEmitting}
            >
              {isEmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {selectedInvoiceTypeId === 'COT' ? 'Generando Cotización...' : 'Emitiendo Comprobante...'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {selectedInvoiceTypeId === 'COT' ? 'Generar Cotización (Carta)' : 'Emitir y Facturar Ahora (Carta)'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
