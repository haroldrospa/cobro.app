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
  Sparkles,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  Package
} from 'lucide-react';
import { CartItem } from '@/types/pos';
import { Customer } from '@/hooks/useCustomers';
import { Product } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
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

const PRESET_SERVICES = [
  { title: 'Honorarios Profesionales', defaultPrice: 15000, taxRate: 18 },
  { title: 'Asesoría Contable / Fiscal', defaultPrice: 10000, taxRate: 18 },
  { title: 'Consultoría / Soporte TI', defaultPrice: 8000, taxRate: 18 },
  { title: 'Mantenimiento y Reparación', defaultPrice: 5000, taxRate: 18 },
  { title: 'Mano de Obra Especializada', defaultPrice: 3500, taxRate: 18 },
  { title: 'Servicios de Diseño / Marketing', defaultPrice: 12000, taxRate: 18 },
];

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

  const handleAddLine = (preset?: { title: string; defaultPrice: number; taxRate: number }) => {
    setServiceLines(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: preset ? preset.title : '',
        quantity: 1,
        unitPrice: preset ? preset.defaultPrice : 0,
        taxRate: preset ? preset.taxRate : defaultTaxRate,
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
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
      {/* Top Header Bar */}
      <div className="p-2 sm:p-2.5 border-b border-border bg-card/60 backdrop-blur-md flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {menuButton}

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">Facturación de Servicios</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Formato Carta
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">Emisión ágil para contabilidad, consultoría y honorarios</p>
            </div>
          </div>

          {onSwitchToCatalog && (
            <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border/50 ml-1 sm:ml-3">
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white shadow-xs cursor-default flex items-center gap-1.5"
              >
                <Briefcase className="h-3 w-3" />
                <span className="hidden xs:inline">Servicios</span>
              </button>
              <button
                type="button"
                onClick={onSwitchToCatalog}
                className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Package className="h-3 w-3" />
                <span className="hidden xs:inline">Catálogo</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {actionButton}
        </div>
      </div>

      {/* Main Workspace Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5 space-y-4">
        {/* Section 1: Customer & Invoice Details */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Customer select */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-emerald-500" />
                  Cliente / Razón Social
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddCustomerDialog(true)}
                  className="h-6 px-2 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-md"
                >
                  <Plus className="h-3 w-3 mr-0.5" />
                  Nuevo Cliente
                </Button>
              </div>

              <Select
                value={selectedCustomerId || 'none'}
                onValueChange={val => setSelectedCustomerId(val === 'none' ? '' : val)}
              >
                <SelectTrigger className="h-10 rounded-xl bg-background border-border text-xs">
                  <SelectValue placeholder="Seleccionar cliente (o consumidor final)" />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-xl">
                  <SelectItem value="none">
                    <span className="text-muted-foreground italic">Cliente General / Consumidor Final</span>
                  </SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-semibold">{c.name}</span>
                      {c.rnc ? ` • RNC: ${c.rnc}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedCustomer && (
                <div className="text-[10px] text-muted-foreground flex items-center gap-2 pt-0.5">
                  <span>RNC/Cédula: <strong className="text-emerald-400 font-mono">{selectedCustomer.rnc || 'Sin RNC'}</strong></span>
                  {selectedCustomer.phone && <span>• Tel: <strong>{selectedCustomer.phone}</strong></span>}
                </div>
              )}
            </div>

            {/* NCF Invoice Type */}
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Building className="h-3.5 w-3.5 text-emerald-500" />
                Tipo de Comprobante Fiscal (NCF)
              </Label>
              <Select
                value={selectedInvoiceTypeId}
                onValueChange={setSelectedInvoiceTypeId}
              >
                <SelectTrigger className="h-10 rounded-xl bg-background border-border text-xs font-medium">
                  <SelectValue placeholder="Tipo de NCF" />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-xl">
                  {invoiceTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      <span className="font-bold text-emerald-400 font-mono mr-1.5">{type.code}</span>
                      <span>{type.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">La secuencia fiscal se emite de manera oficial y automática.</p>
            </div>
          </div>

          {/* Payment condition & method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-border/40">
            {/* Condition: Contado vs Crédito */}
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Condición de Pago
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentCondition('contado')}
                  className={cn(
                    "h-9 rounded-xl font-bold text-xs transition-all cursor-pointer",
                    paymentCondition === 'contado'
                      ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shadow-xs"
                      : "bg-muted/40 border border-transparent text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  Contado
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentCondition('credito')}
                  className={cn(
                    "h-9 rounded-xl font-bold text-xs transition-all cursor-pointer",
                    paymentCondition === 'credito'
                      ? "bg-amber-500/15 border border-amber-500/40 text-amber-400 shadow-xs"
                      : "bg-muted/40 border border-transparent text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  A Crédito
                </button>
              </div>
            </div>

            {/* If Contado: Payment Method */}
            {paymentCondition === 'contado' ? (
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Método de Cobro
                </Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-9 rounded-xl bg-background border-border text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="transfer">🏦 Transferencia Bancaria</SelectItem>
                    <SelectItem value="cash">💵 Efectivo</SelectItem>
                    <SelectItem value="card">💳 Tarjeta de Débito/Crédito</SelectItem>
                    <SelectItem value="check">📜 Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Plazo del Crédito
                </Label>
                <Select
                  value={creditDays.toString()}
                  onValueChange={val => setCreditDays(Number(val))}
                >
                  <SelectTrigger className="h-9 rounded-xl bg-background border-border text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="15">15 Días</SelectItem>
                    <SelectItem value="30">30 Días (Estándar)</SelectItem>
                    <SelectItem value="45">45 Días</SelectItem>
                    <SelectItem value="60">60 Días</SelectItem>
                    <SelectItem value="90">90 Días</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notes / Bank wire comment */}
            <div className="space-y-1 sm:col-span-2 md:col-span-1">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Observaciones / Cta. Banco
              </Label>
              <Input
                placeholder="Ej. Transferir a Cta. Banco Popular..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="h-9 rounded-xl text-xs bg-background border-border"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Quick Service Preset Chips (1-Click) */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            Servicios Rápidos (1 Clic para agregar)
          </Label>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {PRESET_SERVICES.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAddLine(preset)}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-card border border-border/80 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-xs font-semibold text-foreground transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
              >
                <Plus className="h-3 w-3 text-emerald-400" />
                <span>{preset.title}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ${preset.defaultPrice.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Service Lines Table */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-emerald-500" />
              Líneas de Servicios a Facturar ({serviceLines.length})
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddLine()}
              className="h-7 text-xs font-bold border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 rounded-lg gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar Servicio
            </Button>
          </div>

          <div className="space-y-2.5">
            {serviceLines.map((line, index) => {
              const lineSubtotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
              const lineTax = lineSubtotal * ((Number(line.taxRate) || 0) / 100);
              const lineTotal = lineSubtotal + lineTax;

              return (
                <div
                  key={line.id}
                  className="p-3 rounded-xl bg-background border border-border/70 hover:border-border transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold text-muted-foreground">
                      #{index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(line.id)}
                      className="text-muted-foreground hover:text-red-400 p-1 rounded-md hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Eliminar línea"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    {/* Concept / Description */}
                    <div className="sm:col-span-6 space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                        Concepto / Descripción del Servicio
                      </Label>
                      <Input
                        placeholder="Ej. Honorarios por iguala contable mensual..."
                        value={line.description}
                        onChange={e => handleUpdateLine(line.id, 'description', e.target.value)}
                        className="h-9 rounded-lg text-xs bg-muted/20 border-border"
                      />
                    </div>

                    {/* Quantity / Hours */}
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                        Cant. / Horas
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        step="any"
                        value={line.quantity}
                        onChange={e => handleUpdateLine(line.id, 'quantity', parseFloat(e.target.value) || 1)}
                        className="h-9 rounded-lg text-xs bg-muted/20 border-border font-mono text-center"
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                        Tarifa / Precio ({currencySymbol})
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={line.unitPrice || ''}
                        onChange={e => handleUpdateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="h-9 rounded-lg text-xs bg-muted/20 border-border font-mono font-bold text-emerald-400"
                      />
                    </div>

                    {/* ITBIS Tax */}
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">
                        ITBIS
                      </Label>
                      <Select
                        value={line.taxRate.toString()}
                        onValueChange={val => handleUpdateLine(line.id, 'taxRate', parseFloat(val))}
                      >
                        <SelectTrigger className="h-9 rounded-lg text-xs bg-muted/20 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="18">18%</SelectItem>
                          <SelectItem value="16">16%</SelectItem>
                          <SelectItem value="0">0% (Exento)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40 text-muted-foreground font-mono">
                    <span>Subtotal: {currencySymbol} {lineSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span>Total con ITBIS: <strong className="text-foreground">{currencySymbol} {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 4: Totals & Direct Emit Actions */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Factura de Servicios</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                  {currencySymbol} {totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  (Subtotal: {currencySymbol}{totals.subtotal.toLocaleString()} + ITBIS: {currencySymbol}{totals.taxTotal.toLocaleString()})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-10 px-3 text-xs text-muted-foreground hover:text-foreground rounded-xl"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Limpiar
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLoadToCartClick}
                className="h-10 px-3.5 text-xs font-semibold rounded-xl border-border hover:bg-muted/70 gap-1.5"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Cargar al Carrito
              </Button>

              <Button
                type="button"
                size="lg"
                disabled={isEmitting}
                onClick={handleEmitDirect}
                className="flex-1 sm:flex-initial h-11 px-6 font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/20 gap-2 transition-all active:scale-95 cursor-pointer"
              >
                {isEmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Emitiendo...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Emitir Factura (Formato Carta)
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dialog to create customer on the fly */}
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
