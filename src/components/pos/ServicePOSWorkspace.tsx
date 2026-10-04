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
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-muted/20 text-foreground">
      {/* Top Header Bar */}
      <header className="px-4 py-2.5 border-b border-border/50 bg-card/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          {menuButton}

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Facturación de Servicios</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Formato Carta
              </span>
            </div>
          </div>

          {onSwitchToCatalog && (
            <div className="hidden sm:flex items-center bg-muted/50 p-0.5 rounded-lg border border-border/40 ml-2">
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-600 text-white shadow-xs cursor-default flex items-center gap-1.5"
              >
                <Briefcase className="h-3 w-3" />
                <span>Servicios</span>
              </button>
              <button
                type="button"
                onClick={onSwitchToCatalog}
                className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Package className="h-3 w-3" />
                <span>Catálogo</span>
              </button>
            </div>
          )}
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hidden sm:flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Limpiar</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadToCartClick}
            className="h-8 px-2.5 text-xs font-medium border-border/60 hover:bg-muted/50 hidden md:flex items-center gap-1.5"
          >
            <ShoppingCart className="h-3 w-3 text-muted-foreground" />
            <span>Al Carrito</span>
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isEmitting}
            onClick={handleEmitDirect}
            className="h-8 px-3.5 font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            {isEmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Emitiendo...</span>
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                <span>Emitir Factura</span>
              </>
            )}
          </Button>

          {actionButton}
        </div>
      </header>

      {/* Main Canvas Document Area (Letter Paper Sheet) */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-5 lg:p-8">
        <div className="max-w-4xl mx-auto bg-card border border-border/70 rounded-2xl shadow-xl overflow-hidden p-4 sm:p-8 lg:p-10 space-y-6 sm:space-y-8 animate-in fade-in duration-200">
          
          {/* 1. Header: Branding & Invoice Title */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-border/60">
            {/* Business info */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                    {storeSettings?.store_name || 'Servicios Profesionales'}
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    {storeSettings?.rnc ? `RNC: ${storeSettings.rnc}` : 'Comprobante Fiscal Digital'}
                  </p>
                </div>
              </div>
              {(storeSettings?.phone || storeSettings?.email || storeSettings?.address) && (
                <div className="text-[11px] text-muted-foreground/80 pl-9 pt-0.5 space-y-0.5">
                  {storeSettings?.address && <p>{storeSettings.address}</p>}
                  <p>
                    {storeSettings?.phone && <span>Tel: {storeSettings.phone} </span>}
                    {storeSettings?.email && <span>• {storeSettings.email}</span>}
                  </p>
                </div>
              )}
            </div>

            {/* Document Metadata (Right) */}
            <div className="sm:text-right space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                <FileText className="h-3.5 w-3.5" />
                Factura de Servicios
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center sm:justify-end gap-2">
                  <span className="text-muted-foreground text-[11px]">Tipo NCF:</span>
                  <Select value={selectedInvoiceTypeId} onValueChange={setSelectedInvoiceTypeId}>
                    <SelectTrigger className="h-7 w-44 sm:w-48 rounded-lg bg-background border-border/60 text-xs font-medium">
                      <SelectValue placeholder="Seleccionar NCF" />
                    </SelectTrigger>
                    <SelectContent align="end" className="max-h-60">
                      {invoiceTypes.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="font-bold text-emerald-400 font-mono mr-1.5">{t.code}</span>
                          <span>{t.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center sm:justify-end gap-2 text-muted-foreground">
                  <span className="text-[11px]">Fecha de Emisión:</span>
                  <span className="font-medium text-foreground">{todayDateStr}</span>
                </div>

                <div className="flex items-center sm:justify-end gap-2 text-muted-foreground">
                  <span className="text-[11px]">Vencimiento:</span>
                  <span className={cn(
                    "font-medium",
                    paymentCondition === 'credito' ? "text-amber-400 font-semibold" : "text-foreground"
                  )}>
                    {dueDateStr}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Bill to & Payment Terms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 p-4 rounded-xl bg-muted/20 border border-border/50">
            {/* Left: Facturar a */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-emerald-400" />
                  Facturar a (Cliente)
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerDialog(true)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer flex items-center gap-1 hover:underline"
                >
                  <UserPlus className="h-3 w-3" />
                  Nuevo Cliente
                </button>
              </div>

              <Select
                value={selectedCustomerId || 'none'}
                onValueChange={val => setSelectedCustomerId(val === 'none' ? '' : val)}
              >
                <SelectTrigger className="h-9 rounded-lg bg-background border-border/60 text-xs font-medium shadow-xs">
                  <SelectValue placeholder="Seleccionar cliente..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
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

              {selectedCustomer ? (
                <div className="p-2.5 rounded-lg bg-background/60 border border-border/40 text-xs space-y-1">
                  <div className="font-semibold text-foreground">{selectedCustomer.name}</div>
                  {selectedCustomer.rnc && (
                    <p className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                      <span className="text-muted-foreground">RNC / Cédula:</span> {selectedCustomer.rnc}
                    </p>
                  )}
                  {selectedCustomer.phone && (
                    <p className="text-[11px] text-muted-foreground">
                      Teléfono: {selectedCustomer.phone}
                    </p>
                  )}
                  {selectedCustomer.address && (
                    <p className="text-[11px] text-muted-foreground">
                      Dirección: {selectedCustomer.address}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground/70 italic pl-1">
                  Factura emitida a Consumidor Final. Para crédito fiscal B01 seleccione un cliente con RNC.
                </p>
              )}
            </div>

            {/* Right: Condiciones de Pago */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-emerald-400" />
                Condición y Método de Pago
              </span>

              {/* Contado vs Crédito Segmented Control */}
              <div className="grid grid-cols-2 p-1 bg-background rounded-lg border border-border/60">
                <button
                  type="button"
                  onClick={() => setPaymentCondition('contado')}
                  className={cn(
                    "py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5",
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
                    "py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5",
                    paymentCondition === 'credito'
                      ? "bg-amber-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  Crédito
                </button>
              </div>

              {paymentCondition === 'contado' ? (
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Método de Cobro:</label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-9 rounded-lg bg-background border-border/60 text-xs font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transfer">🏦 Transferencia Bancaria</SelectItem>
                      <SelectItem value="cash">💵 Efectivo</SelectItem>
                      <SelectItem value="card">💳 Tarjeta de Débito / Crédito</SelectItem>
                      <SelectItem value="check">📑 Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Plazo de Vencimiento:</label>
                  <Select
                    value={creditDays.toString()}
                    onValueChange={val => setCreditDays(Number(val))}
                  >
                    <SelectTrigger className="h-9 rounded-lg bg-background border-border/60 text-xs font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 Días netos</SelectItem>
                      <SelectItem value="30">30 Días netos (Estándar)</SelectItem>
                      <SelectItem value="45">45 Días netos</SelectItem>
                      <SelectItem value="60">60 Días netos</SelectItem>
                      <SelectItem value="90">90 Días netos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* 3. Preset Quick Services (Minimalist Chips) */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              Añadir Servicio Rápido:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar flex-wrap">
              {PRESET_SERVICES.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddLine(preset)}
                  className="px-3 py-1.5 rounded-lg bg-background hover:bg-emerald-500/10 hover:border-emerald-500/40 border border-border/60 text-xs text-foreground transition-all cursor-pointer flex items-center gap-2 group shadow-xs active:scale-95"
                >
                  <span className="group-hover:text-emerald-400 font-medium">+ {preset.title}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground group-hover:text-emerald-400">
                    {currencySymbol} {preset.defaultPrice.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Service Lines Table (Clean Carta Spreadsheet) */}
          <div className="border border-border/60 rounded-xl overflow-hidden shadow-xs bg-background/50">
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-2.5 px-3 font-medium">Descripción del Servicio</th>
                    <th className="py-2.5 px-2 text-center font-medium w-24">Cant. / Horas</th>
                    <th className="py-2.5 px-2 text-right font-medium w-32">Precio Unit. ({currencySymbol})</th>
                    <th className="py-2.5 px-2 text-center font-medium w-24">ITBIS</th>
                    <th className="py-2.5 px-3 text-right font-medium w-32">Subtotal ({currencySymbol})</th>
                    <th className="py-2.5 px-2 text-center font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-xs">
                  {serviceLines.map(line => {
                    const lineSubtotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                    const lineTax = lineSubtotal * ((Number(line.taxRate) || 0) / 100);
                    const lineTotal = lineSubtotal + lineTax;

                    return (
                      <tr key={line.id} className="hover:bg-muted/10 transition-colors group">
                        <td className="py-2 px-3 align-top">
                          <Input
                            placeholder="Detalle o concepto del servicio a facturar..."
                            value={line.description}
                            onChange={e => handleUpdateLine(line.id, 'description', e.target.value)}
                            className="h-8 rounded-lg text-xs bg-background border-border/50 focus-visible:border-emerald-500"
                          />
                        </td>
                        <td className="py-2 px-2 align-top text-center">
                          <Input
                            type="number"
                            min="1"
                            step="any"
                            value={line.quantity}
                            onChange={e => handleUpdateLine(line.id, 'quantity', parseFloat(e.target.value) || 1)}
                            className="h-8 w-20 mx-auto rounded-lg text-xs text-center font-mono bg-background border-border/50"
                          />
                        </td>
                        <td className="py-2 px-2 align-top text-right">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={line.unitPrice || ''}
                            onChange={e => handleUpdateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="h-8 w-28 ml-auto rounded-lg text-xs text-right font-mono font-semibold text-emerald-400 bg-background border-border/50"
                          />
                        </td>
                        <td className="py-2 px-2 align-top text-center">
                          <Select
                            value={line.taxRate.toString()}
                            onValueChange={val => handleUpdateLine(line.id, 'taxRate', parseFloat(val))}
                          >
                            <SelectTrigger className="h-8 w-20 mx-auto rounded-lg text-xs bg-background border-border/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="18">18%</SelectItem>
                              <SelectItem value="16">16%</SelectItem>
                              <SelectItem value="0">0% (Exento)</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-3 align-middle text-right font-mono font-medium text-foreground">
                          {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-2 align-middle text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            className="p-1 rounded-md text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Eliminar fila"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="sm:hidden divide-y divide-border/40 p-2">
              {serviceLines.map(line => {
                const lineSubtotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                const lineTax = lineSubtotal * ((Number(line.taxRate) || 0) / 100);
                const lineTotal = lineSubtotal + lineTax;

                return (
                  <div key={line.id} className="py-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        placeholder="Descripción del servicio..."
                        value={line.description}
                        onChange={e => handleUpdateLine(line.id, 'description', e.target.value)}
                        className="h-8 rounded-lg text-xs bg-background"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.id)}
                        className="p-1.5 text-muted-foreground/60 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Cant:</span>
                        <Input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={e => handleUpdateLine(line.id, 'quantity', parseFloat(e.target.value) || 1)}
                          className="h-7 text-xs font-mono text-center"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Precio:</span>
                        <Input
                          type="number"
                          min="0"
                          value={line.unitPrice || ''}
                          onChange={e => handleUpdateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="h-7 text-xs font-mono text-right text-emerald-400"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">ITBIS:</span>
                        <Select
                          value={line.taxRate.toString()}
                          onValueChange={val => handleUpdateLine(line.id, 'taxRate', parseFloat(val))}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="18">18%</SelectItem>
                            <SelectItem value="16">16%</SelectItem>
                            <SelectItem value="0">0%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="text-right text-xs font-mono font-semibold text-foreground pt-1">
                      Total: {currencySymbol} {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Table Footer Action */}
            <div className="p-2.5 bg-muted/20 border-t border-border/50 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleAddLine()}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-8 gap-1.5 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar otra línea de servicio
              </Button>
              <span className="text-[11px] font-mono text-muted-foreground pr-2">
                {serviceLines.length} {serviceLines.length === 1 ? 'concepto' : 'conceptos'}
              </span>
            </div>
          </div>

          {/* 5. Notes & Financial Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/60">
            {/* Left: Notes & Bank Instructions */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Notas / Instrucciones de Pago:
              </span>
              <Textarea
                rows={3}
                placeholder="Ej: Favor realizar transferencia bancaria a Banco BHD León, Cuenta Corriente No. 123456789 a nombre de... Gracias por su confianza."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="text-xs rounded-xl bg-background border-border/60 placeholder:text-muted-foreground/50 resize-none"
              />
              <p className="text-[10px] text-muted-foreground">
                Este texto se imprimirá al pie de la factura en la hoja tamaño Carta.
              </p>
            </div>

            {/* Right: Summary Box */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Subtotal de Servicios:</span>
                <span className="font-mono text-foreground font-medium">
                  {currencySymbol} {totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>ITBIS Facturado:</span>
                <span className="font-mono text-foreground font-medium">
                  {currencySymbol} {totals.taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-baseline justify-between">
                <span className="text-sm font-bold text-foreground">TOTAL A COBRAR:</span>
                <span className="text-2xl font-bold font-mono text-emerald-400">
                  {currencySymbol} {totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* 6. Document Bottom Action Bar */}
          <div className="pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-foreground h-9 gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpiar Formulario
            </Button>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={handleLoadToCartClick}
                className="text-xs font-semibold h-10 px-4 rounded-xl border-border/60 gap-2 hover:bg-muted/50 cursor-pointer"
              >
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                Al Carrito del POS
              </Button>

              <Button
                type="button"
                size="default"
                disabled={isEmitting}
                onClick={handleEmitDirect}
                className="text-xs font-bold h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md gap-2 transition-all cursor-pointer active:scale-95"
              >
                {isEmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generando Factura Carta...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    <span>Emitir Factura (Carta)</span>
                  </>
                )}
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
