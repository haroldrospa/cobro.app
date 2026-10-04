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
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background text-foreground">
      {/* Top Header Bar */}
      <header className="px-3 py-2 border-b border-border/40 bg-card/40 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {menuButton}

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Facturación de Servicios</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                Carta
              </span>
            </div>
          </div>

          {onSwitchToCatalog && (
            <div className="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border/40 ml-2">
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

        <div className="flex items-center gap-1.5 shrink-0">
          {actionButton}
        </div>
      </header>

      {/* Main Form Body */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 max-w-6xl mx-auto w-full space-y-4">
        {/* Sleek Metadata Toolbar */}
        <div className="p-3 rounded-xl bg-card/40 border border-border/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Customer */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium flex items-center gap-1">
                <User className="h-3 w-3 text-emerald-400" />
                Cliente
              </span>
              <button
                type="button"
                onClick={() => setShowAddCustomerDialog(true)}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
              >
                + Nuevo
              </button>
            </div>
            <Select
              value={selectedCustomerId || 'none'}
              onValueChange={val => setSelectedCustomerId(val === 'none' ? '' : val)}
            >
              <SelectTrigger className="h-8 rounded-lg bg-background/50 border-border/50 text-xs">
                <SelectValue placeholder="Cliente final / ocasional" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="none">
                  <span className="text-muted-foreground italic">Consumidor Final</span>
                </SelectItem>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <span>{c.name}</span>
                    {c.rnc ? ` (${c.rnc})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCustomer?.rnc && (
              <p className="text-[10px] text-emerald-400/90 font-mono">
                RNC: {selectedCustomer.rnc}
              </p>
            )}
          </div>

          {/* Comprobante Fiscal */}
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Building className="h-3 w-3 text-emerald-400" />
              Comprobante (NCF)
            </span>
            <Select
              value={selectedInvoiceTypeId}
              onValueChange={setSelectedInvoiceTypeId}
            >
              <SelectTrigger className="h-8 rounded-lg bg-background/50 border-border/50 text-xs">
                <SelectValue placeholder="Tipo de NCF" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {invoiceTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    <span className="font-bold text-emerald-400 font-mono mr-1.5">{type.code}</span>
                    <span>{type.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Condición de Pago & Método */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium flex items-center gap-1">
                <CreditCard className="h-3 w-3 text-emerald-400" />
                Pago
              </span>
              <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md">
                <button
                  type="button"
                  onClick={() => setPaymentCondition('contado')}
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] font-semibold rounded transition-colors cursor-pointer",
                    paymentCondition === 'contado'
                      ? "bg-emerald-600 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Contado
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentCondition('credito')}
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] font-semibold rounded transition-colors cursor-pointer",
                    paymentCondition === 'credito'
                      ? "bg-amber-600 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Crédito
                </button>
              </div>
            </div>

            {paymentCondition === 'contado' ? (
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-8 rounded-lg bg-background/50 border-border/50 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Transferencia Bancaria</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="check">Cheque</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={creditDays.toString()}
                onValueChange={val => setCreditDays(Number(val))}
              >
                <SelectTrigger className="h-8 rounded-lg bg-background/50 border-border/50 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 Días</SelectItem>
                  <SelectItem value="30">30 Días (Estándar)</SelectItem>
                  <SelectItem value="45">45 Días</SelectItem>
                  <SelectItem value="60">60 Días</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Nota / Cta. Banco */}
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              Nota o Cta. Bancaria
            </span>
            <Input
              placeholder="Opcional: ref. o cta..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="h-8 rounded-lg text-xs bg-background/50 border-border/50 placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Quick Service Badges (Minimalist) */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
          <span className="text-[11px] text-muted-foreground shrink-0 mr-1">Rápidos:</span>
          {PRESET_SERVICES.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAddLine(preset)}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-muted/30 hover:bg-emerald-500/10 hover:text-emerald-400 border border-border/40 hover:border-emerald-500/30 text-xs text-muted-foreground transition-all cursor-pointer flex items-center gap-1 active:scale-95"
            >
              <span>+ {preset.title}</span>
              <span className="opacity-60 text-[10px] font-mono">
                ${preset.defaultPrice.toLocaleString()}
              </span>
            </button>
          ))}
        </div>

        {/* Service Lines Table (Clean Spreadsheet Style) */}
        <div className="rounded-xl border border-border/40 bg-card/30 overflow-hidden shadow-xs">
          {/* Table Header */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-3 py-2 border-b border-border/40 text-[11px] font-medium text-muted-foreground">
            <div className="col-span-6">Descripción del Servicio</div>
            <div className="col-span-2 text-center">Cant. / Horas</div>
            <div className="col-span-2 text-right">Precio ({currencySymbol})</div>
            <div className="col-span-1 text-center">ITBIS</div>
            <div className="col-span-1 text-right">Acción</div>
          </div>

          {/* Lines */}
          <div className="divide-y divide-border/30">
            {serviceLines.map((line, index) => {
              const lineSubtotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
              const lineTax = lineSubtotal * ((Number(line.taxRate) || 0) / 100);
              const lineTotal = lineSubtotal + lineTax;

              return (
                <div
                  key={line.id}
                  className="p-3 sm:px-3 sm:py-2.5 hover:bg-muted/10 transition-colors"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    {/* Concept */}
                    <div className="sm:col-span-6">
                      <Input
                        placeholder="Descripción del servicio (ej. Honorarios mensuales)..."
                        value={line.description}
                        onChange={e => handleUpdateLine(line.id, 'description', e.target.value)}
                        className="h-8 rounded-lg text-xs bg-background/50 border-border/40 placeholder:text-muted-foreground/50"
                      />
                    </div>

                    {/* Quantity */}
                    <div className="sm:col-span-2 flex items-center justify-between sm:justify-center gap-2">
                      <span className="text-[11px] text-muted-foreground sm:hidden">Cant:</span>
                      <Input
                        type="number"
                        min="1"
                        step="any"
                        value={line.quantity}
                        onChange={e => handleUpdateLine(line.id, 'quantity', parseFloat(e.target.value) || 1)}
                        className="h-8 w-24 sm:w-full rounded-lg text-xs bg-background/50 border-border/40 font-mono text-center"
                      />
                    </div>

                    {/* Price */}
                    <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
                      <span className="text-[11px] text-muted-foreground sm:hidden">Precio:</span>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={line.unitPrice || ''}
                        onChange={e => handleUpdateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="h-8 w-28 sm:w-full rounded-lg text-xs bg-background/50 border-border/40 font-mono text-right text-emerald-400 font-semibold"
                      />
                    </div>

                    {/* Tax */}
                    <div className="sm:col-span-1 flex items-center justify-between sm:justify-center gap-2">
                      <span className="text-[11px] text-muted-foreground sm:hidden">ITBIS:</span>
                      <Select
                        value={line.taxRate.toString()}
                        onValueChange={val => handleUpdateLine(line.id, 'taxRate', parseFloat(val))}
                      >
                        <SelectTrigger className="h-8 rounded-lg text-xs bg-background/50 border-border/40 px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="18">18%</SelectItem>
                          <SelectItem value="16">16%</SelectItem>
                          <SelectItem value="0">0%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Delete and line total preview */}
                    <div className="sm:col-span-1 flex items-center justify-between sm:justify-end gap-2">
                      <span className="text-[11px] font-mono text-muted-foreground sm:hidden">
                        Total: {currencySymbol} {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.id)}
                        className="text-muted-foreground/60 hover:text-red-400 p-1.5 rounded-md hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Line Action */}
          <div className="px-3 py-2 bg-muted/10 border-t border-border/30 flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleAddLine()}
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer py-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Agregar línea</span>
            </button>
            <span className="text-[11px] text-muted-foreground font-mono">
              {serviceLines.length} {serviceLines.length === 1 ? 'concepto' : 'conceptos'}
            </span>
          </div>
        </div>
      </div>

      {/* Clean Minimalist Bottom Bar */}
      <footer className="px-4 py-2.5 border-t border-border/40 bg-card/60 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
        {/* Totals */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-muted-foreground">
            Subtotal: <span className="text-foreground">{currencySymbol} {totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="text-muted-foreground">
            ITBIS: <span className="text-foreground">{currencySymbol} {totals.taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="text-sm font-bold text-emerald-400 pl-2 border-l border-border/50">
            Total: {currencySymbol} {totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Limpiar
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadToCartClick}
            className="h-8 px-3 text-xs font-medium rounded-lg border-border/60 hover:bg-muted/50 gap-1.5"
          >
            <ShoppingCart className="h-3 w-3 text-muted-foreground" />
            Al Carrito
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isEmitting}
            onClick={handleEmitDirect}
            className="h-8 px-4 font-semibold text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm gap-1.5 transition-all cursor-pointer"
          >
            {isEmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Emitiendo...
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                Emitir Factura (Carta)
              </>
            )}
          </Button>
        </div>
      </footer>

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
