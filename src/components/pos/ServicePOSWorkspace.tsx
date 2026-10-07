import React, { useState, useMemo } from 'react';
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
  CreditCard,
  Building,
  Loader2,
  ShoppingCart,
  UserPlus,
  Calendar,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  Package
} from 'lucide-react';
import { CartItem } from '@/types/pos';
import { Customer } from '@/hooks/useCustomers';
import { Product } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { cn } from '@/lib/utils';
import AddCustomerDialog from './AddCustomerDialog';

export interface ServiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number; // e.g. 18, 16, 0
}

interface ServicePOSWorkspaceProps {
  customers: Customer[];
  invoiceTypes: any[];
  products?: Product[];
  menuButton?: React.ReactNode;
  actionButton?: React.ReactNode;
  onDirectEmit: (data: {
    customerId: string;
    invoiceTypeId: string;
    items: CartItem[];
    paymentMethod: string;
    creditDays?: number;
    notes?: string;
  }) => Promise<void>;
  isEmitting?: boolean;
  onLoadToCart: (items: CartItem[], customerId: string, invoiceTypeId: string) => void;
  onSwitchToCatalog?: () => void;
  currencySymbol?: string;
  defaultTaxRate?: number;
}

export const ServicePOSWorkspace: React.FC<ServicePOSWorkspaceProps> = ({
  customers = [],
  invoiceTypes = [],
  products = [],
  menuButton,
  actionButton,
  onDirectEmit,
  isEmitting = false,
  onLoadToCart,
  onSwitchToCatalog,
  currencySymbol = 'RD$',
  defaultTaxRate = 18,
}) => {
  const { toast } = useToast();
  const { settings: storeSettings } = useStoreSettings();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false);

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
    return invoiceTypes.find(t => t.id === selectedInvoiceTypeId);
  }, [invoiceTypes, selectedInvoiceTypeId]);

  const todayDateStr = useMemo(() => {
    return new Date().toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  const dueDateStr = useMemo(() => {
    if (paymentCondition === 'contado') {
      return 'Al Contado (Inmediato)';
    }
    const due = new Date();
    due.setDate(due.getDate() + (creditDays || 30));
    return due.toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, [paymentCondition, creditDays]);

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

    return {
      subtotal,
      taxTotal,
      total: subtotal + taxTotal
    };
  }, [serviceLines]);

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
      setServiceLines([{
        id: crypto.randomUUID(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: defaultTaxRate
      }]);
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

  const handleReset = () => {
    setSelectedCustomerId('');
    setNotes('');
    setPaymentCondition('contado');
    setPaymentMethod('transfer');
    setServiceLines([
      {
        id: crypto.randomUUID(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: defaultTaxRate,
      }
    ]);
  };

  // Convertir líneas de servicio a CartItem compatible con POS
  const getCartItemsFromLines = (): CartItem[] => {
    return serviceLines
      .filter(line => line.description.trim() !== '' && line.unitPrice > 0)
      .map(line => ({
        id: `srv-${crypto.randomUUID().slice(0, 8)}`,
        name: line.description.trim(),
        price: Number(line.unitPrice),
        quantity: Number(line.quantity) || 1,
        tax: (Number(line.taxRate) || 0) / 100,
        cost_includes_tax: false,
      }));
  };

  const validateBeforeEmit = (): CartItem[] | null => {
    const validItems = getCartItemsFromLines();
    if (validItems.length === 0) {
      toast({
        title: "Líneas de servicio vacías",
        description: "Debe ingresar al menos un servicio con concepto y precio mayor a 0.",
        variant: "destructive"
      });
      return null;
    }

    const isB01 = selectedInvoiceType?.code === 'B01';
    if (isB01 && (!selectedCustomer || !selectedCustomer.rnc)) {
      toast({
        title: "RNC Requerido para Crédito Fiscal",
        description: "Para facturas con valor fiscal (B01), debe seleccionar un cliente con RNC/Cédula.",
        variant: "destructive"
      });
      return null;
    }

    return validItems;
  };

  const handleEmitDirect = async () => {
    const validItems = validateBeforeEmit();
    if (!validItems) return;

    await onDirectEmit({
      customerId: selectedCustomerId,
      invoiceTypeId: selectedInvoiceTypeId,
      items: validItems,
      paymentMethod: paymentCondition === 'credito' ? 'credit' : paymentMethod,
      creditDays: paymentCondition === 'credito' ? creditDays : undefined,
      notes,
    });
  };

  const handleLoadToCartClick = () => {
    const validItems = validateBeforeEmit();
    if (!validItems) return;

    onLoadToCart(validItems, selectedCustomerId, selectedInvoiceTypeId);
    toast({
      title: "Servicios cargados al carrito",
      description: "Los servicios se han cargado en la caja para procesar el cobro regular.",
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full overflow-hidden bg-background text-foreground">
      {/* Top Header Bar */}
      <header className="h-11 px-3 sm:px-4 border-b border-border/50 bg-card/70 backdrop-blur-md flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {menuButton}

          <div className="flex items-center gap-1.5">
            <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Briefcase className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold text-xs sm:text-sm truncate">Facturación de Servicios</span>
            <span className="hidden sm:inline-block text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Carta
            </span>
          </div>

          {onSwitchToCatalog && (
            <div className="hidden md:flex items-center bg-muted/50 p-0.5 rounded-lg border border-border/40 ml-2">
              <button
                type="button"
                className="px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-600 text-white shadow-xs cursor-default flex items-center gap-1"
              >
                <Briefcase className="h-3 w-3" />
                <span>Servicios</span>
              </button>
              <button
                type="button"
                onClick={onSwitchToCatalog}
                className="px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors cursor-pointer flex items-center gap-1"
              >
                <Package className="h-3 w-3" />
                <span>Catálogo</span>
              </button>
            </div>
          )}
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="hidden sm:inline">Limpiar</span>
          </Button>

          {actionButton}
        </div>
      </header>

      {/* Main 2-Column Content (100% Viewport Height, Zero Page Scroll) */}
      <div className="flex-1 min-h-0 p-2 sm:p-2.5 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-2.5">
        
        {/* Left Column: Customer, Preset Chips & Service Line Items (8 cols on xl, 7 on lg) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-0 h-full gap-2 overflow-hidden">
          
          {/* Top Bar: Customer Selector & Preset Service Pills */}
          <div className="p-2 sm:p-2.5 rounded-xl bg-card/60 border border-border/50 shrink-0 space-y-2 shadow-xs">
            {/* Customer selector row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <User className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <Select
                  value={selectedCustomerId || 'none'}
                  onValueChange={val => setSelectedCustomerId(val === 'none' ? '' : val)}
                >
                  <SelectTrigger className="h-8 rounded-lg bg-background/60 border-border/50 text-xs font-medium flex-1">
                    <SelectValue placeholder="Cliente (Consumidor Final)..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="none">
                      <span className="text-muted-foreground italic">Consumidor Final (Ocasional)</span>
                    </SelectItem>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="font-semibold text-foreground">{c.name}</span>
                        {c.rnc && <span className="ml-1.5 text-muted-foreground font-mono">({c.rnc})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddCustomerDialog(true)}
                className="h-8 px-2 text-xs text-emerald-400 hover:text-emerald-300 border-border/50 hover:bg-emerald-500/10 shrink-0 gap-1"
              >
                <UserPlus className="h-3 w-3" />
                <span className="hidden sm:inline">Nuevo Cliente</span>
              </Button>
            </div>
          </div>

          {/* Service Items Table Container (Fills rest of height, scroll ONLY inside table) */}
          <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border/50 bg-card/40 overflow-hidden shadow-xs">
            {/* Table Header */}
            <div className="shrink-0 border-b border-border/40 bg-muted/30 px-3 py-1.5 grid grid-cols-12 gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-6">Descripción del Servicio</div>
              <div className="col-span-2 text-center">Cant. / Horas</div>
              <div className="col-span-2 text-right">Precio ({currencySymbol})</div>
              <div className="col-span-1 text-center">ITBIS</div>
              <div className="col-span-1 text-center"></div>
            </div>

            {/* Table Rows (Scrolls internally if > 3 lines) */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/20 p-1">
              {serviceLines.map(line => {
                const lineSubtotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                const lineTax = lineSubtotal * ((Number(line.taxRate) || 0) / 100);
                const lineTotal = lineSubtotal + lineTax;

                return (
                  <div
                    key={line.id}
                    className="p-1.5 sm:px-2 sm:py-1 hover:bg-muted/10 transition-colors rounded-lg group"
                  >
                    <div className="grid grid-cols-12 gap-2 items-center">
                      {/* Description */}
                      <div className="col-span-6">
                        <Input
                          placeholder="Concepto o servicio (ej. Asesoría fiscal)..."
                          value={line.description}
                          onChange={e => handleUpdateLine(line.id, 'description', e.target.value)}
                          className="h-8 rounded-lg text-xs bg-background/60 border-border/40 placeholder:text-muted-foreground/50 focus-visible:border-emerald-500"
                        />
                      </div>

                      {/* Quantity */}
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="1"
                          step="any"
                          value={line.quantity}
                          onChange={e => handleUpdateLine(line.id, 'quantity', parseFloat(e.target.value) || 1)}
                          className="h-8 w-full text-center font-mono rounded-lg text-xs bg-background/60 border-border/40"
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={line.unitPrice || ''}
                          onChange={e => handleUpdateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="h-8 w-full text-right font-mono font-semibold text-emerald-400 rounded-lg text-xs bg-background/60 border-border/40"
                        />
                      </div>

                      {/* Tax */}
                      <div className="col-span-1">
                        <Select
                          value={line.taxRate.toString()}
                          onValueChange={val => handleUpdateLine(line.id, 'taxRate', parseFloat(val))}
                        >
                          <SelectTrigger className="h-8 w-full text-xs bg-background/60 border-border/40 px-1 text-center">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="18">18%</SelectItem>
                            <SelectItem value="16">16%</SelectItem>
                            <SelectItem value="0">0%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Delete Action */}
                      <div className="col-span-1 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.id)}
                          className="p-1 rounded-md text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Eliminar fila"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Table Footer: Add Line Button */}
            <div className="shrink-0 px-3 py-1.5 bg-muted/20 border-t border-border/40 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAddLine()}
                className="h-7 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1.5 cursor-pointer px-2"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar concepto
              </Button>
              <span className="text-[10px] font-mono text-muted-foreground">
                {serviceLines.length} {serviceLines.length === 1 ? 'concepto' : 'conceptos'}
              </span>
            </div>
          </div>

        </div>

        {/* Right Column: Invoicing Config, Notes, Totals & Emit Button (5 cols on xl, 5 on lg) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col min-h-0 h-full justify-between gap-2 p-3 rounded-xl border border-border/60 bg-card/60 overflow-hidden shadow-xs">
          
          {/* Top Form Controls */}
          <div className="shrink-0 space-y-2">
            {/* Comprobante Fiscal (NCF) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Building className="h-3 w-3 text-emerald-400" />
                Comprobante (NCF)
              </label>
              <Select value={selectedInvoiceTypeId} onValueChange={setSelectedInvoiceTypeId}>
                <SelectTrigger className="h-8 rounded-lg bg-background/60 border-border/50 text-xs font-medium">
                  <SelectValue placeholder="Seleccionar NCF" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {invoiceTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="font-bold text-emerald-400 font-mono mr-1.5">{t.code}</span>
                      <span>{t.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Condición de Pago: Contado / Crédito */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <CreditCard className="h-3 w-3 text-emerald-400" />
                  Condición de Pago
                </label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {dueDateStr}
                </span>
              </div>

              <div className="grid grid-cols-2 p-0.5 bg-background/80 rounded-lg border border-border/60 gap-1">
                <button
                  type="button"
                  onClick={() => setPaymentCondition('contado')}
                  className={cn(
                    "py-1 text-xs font-semibold rounded transition-all cursor-pointer flex items-center justify-center gap-1",
                    paymentCondition === 'contado'
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Contado
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentCondition('credito')}
                  className={cn(
                    "py-1 text-xs font-semibold rounded transition-all cursor-pointer flex items-center justify-center gap-1",
                    paymentCondition === 'credito'
                      ? "bg-amber-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  Crédito
                </button>
              </div>
            </div>

            {/* Payment Method / Credit Days Select */}
            {paymentCondition === 'contado' ? (
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Método de Cobro:</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-8 rounded-lg bg-background/60 border-border/50 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Transferencia Bancaria</SelectItem>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="card">Tarjeta Débito / Crédito</SelectItem>
                    <SelectItem value="check">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Plazo de Vencimiento:</label>
                <Select
                  value={creditDays.toString()}
                  onValueChange={val => setCreditDays(Number(val))}
                >
                  <SelectTrigger className="h-8 rounded-lg bg-background/60 border-border/50 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 Días netos</SelectItem>
                    <SelectItem value="30">30 Días netos (Estándar)</SelectItem>
                    <SelectItem value="45">45 Días netos</SelectItem>
                    <SelectItem value="60">60 Días netos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notes / Bank Info */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                Notas / Cta. Bancaria (Carta)
              </label>
              <Textarea
                rows={2}
                placeholder="Cta. banco o nota para la factura impresa..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="text-xs rounded-lg bg-background/60 border-border/50 placeholder:text-muted-foreground/50 resize-none h-14"
              />
            </div>
          </div>

          {/* Bottom Summary & Actions */}
          <div className="shrink-0 space-y-2 pt-2 border-t border-border/40">
            {/* Totals Box */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5 space-y-1 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span className="font-mono text-foreground font-medium">
                  {currencySymbol} {totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>ITBIS (18%):</span>
                <span className="font-mono text-foreground font-medium">
                  {currencySymbol} {totals.taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pt-1.5 border-t border-border/40 flex items-baseline justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">Total a Cobrar:</span>
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {currencySymbol} {totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-1.5">
              <Button
                type="button"
                size="default"
                disabled={isEmitting}
                onClick={handleEmitDirect}
                className="h-10 w-full font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md gap-2 transition-all cursor-pointer active:scale-95"
              >
                {isEmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Emitiendo Factura Carta...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    <span>Emitir Factura (Carta)</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLoadToCartClick}
                className="h-8 w-full text-xs font-medium rounded-lg border-border/50 hover:bg-muted/40 text-muted-foreground hover:text-foreground gap-1.5"
              >
                <ShoppingCart className="h-3 w-3" />
                <span>Al Carrito del POS</span>
              </Button>
            </div>
          </div>

        </div>

      </div>

      {/* Customer Dialog */}
      {showAddCustomerDialog && (
        <AddCustomerDialog
          isOpen={showAddCustomerDialog}
          onClose={() => setShowAddCustomerDialog(false)}
          onCustomerAdded={id => {
            setSelectedCustomerId(id);
            setShowAddCustomerDialog(false);
          }}
        />
      )}
    </div>
  );
};
