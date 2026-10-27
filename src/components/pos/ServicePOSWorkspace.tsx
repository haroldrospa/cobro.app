import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
  Package,
  ArrowLeftRight,
  Coins,
  Percent
} from 'lucide-react';
import { CartItem } from '@/types/pos';
import { Customer } from '@/hooks/useCustomers';
import { Product } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useAlanubeConfig } from '@/hooks/useAlanubeConfig';
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
  onOpenQuotes?: () => void;
  quoteCount?: number;
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
    currency?: 'DOP' | 'USD';
    exchangeRate?: number;
  }) => Promise<void>;
  isEmitting?: boolean;
  onLoadToCart: (items: CartItem[], customerId: string, invoiceTypeId: string) => void;
  onSwitchToCatalog?: () => void;
  currencySymbol?: string;
  defaultTaxRate?: number;
  isElectronic?: boolean;
}

export const ServicePOSWorkspace: React.FC<ServicePOSWorkspaceProps> = ({
  onOpenQuotes,
  quoteCount,
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
  isElectronic,
}) => {
  const { toast } = useToast();
  const { settings: storeSettings } = useStoreSettings();
  const { config: alanubeConfig } = useAlanubeConfig();
  const effectiveIsElectronic = isElectronic ?? (Boolean(alanubeConfig?.is_active) || (typeof window !== 'undefined' && localStorage.getItem('alanube_billing_mode') === 'e-ncf'));

  const mappedInvoiceTypes = useMemo(() => {
    const rawTypes = invoiceTypes.filter(t => t.id !== 'FAC' && t.code !== 'FAC');
    if (!effectiveIsElectronic) return rawTypes;

    const eMap: Record<string, { code: string; name: string }> = {
      'B01': { code: 'E31', name: 'Crédito Fiscal Electrónico' },
      'B02': { code: 'E32', name: 'Consumidor Final Electrónico' },
      'B11': { code: 'E41', name: 'Compras Electrónico' },
      'B13': { code: 'E43', name: 'Gastos Menores Electrónico' },
      'B14': { code: 'E44', name: 'Regímenes Especiales Electrónico' },
      'B15': { code: 'E45', name: 'Gubernamental Electrónico' },
      'B16': { code: 'E46', name: 'Exportaciones Electrónico' },
      'B17': { code: 'E47', name: 'Pagos al Exterior Electrónico' },
      'E31': { code: 'E31', name: 'Crédito Fiscal Electrónico' },
      'E32': { code: 'E32', name: 'Consumidor Final Electrónico' },
      'E41': { code: 'E41', name: 'Compras Electrónico' },
      'E43': { code: 'E43', name: 'Gastos Menores Electrónico' },
      'E44': { code: 'E44', name: 'Regímenes Especiales Electrónico' },
      'E45': { code: 'E45', name: 'Gubernamental Electrónico' },
      'E46': { code: 'E46', name: 'Exportaciones Electrónico' },
      'E47': { code: 'E47', name: 'Pagos al Exterior Electrónico' },
    };

    const allowedECodes = ['E31', 'E32', 'E41', 'E43', 'E44', 'E45', 'E46', 'E47'];
    const result: any[] = [];
    const seenCodes = new Set<string>();

    for (const t of rawTypes) {
      const mapped = eMap[t.code];
      if (mapped && !seenCodes.has(mapped.code)) {
        seenCodes.add(mapped.code);
        result.push({ ...t, id: mapped.code, code: mapped.code, name: mapped.name });
      }
    }

    for (const code of allowedECodes) {
      if (!seenCodes.has(code)) {
        seenCodes.add(code);
        result.push({ id: code, code, name: eMap[code].name });
      }
    }

    return result.sort((a, b) => a.code.localeCompare(b.code));
  }, [invoiceTypes, effectiveIsElectronic]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false);

  // Moneda de la Factura y Tasa de Cambio
  const [currency, setCurrency] = useState<'DOP' | 'USD'>(() => {
    return (storeSettings?.currency === 'USD' ? 'USD' : 'DOP');
  });

  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    const saved = localStorage.getItem('cobro_pos_exchange_rate');
    const parsed = saved ? parseFloat(saved) : 60.0;
    return isNaN(parsed) || parsed <= 0 ? 60.0 : parsed;
  });

  const activeCurrencySymbol = currency === 'USD' ? 'US$' : 'RD$';

  // Control de Impuesto (ITBIS): Aplicar o Eximir, y si está incluido
  const [applyTax, setApplyTax] = useState<boolean>(true);
  const [priceIncludesTax, setPriceIncludesTax] = useState<boolean>(false);

  const handleToggleApplyTax = (enabled: boolean) => {
    setApplyTax(enabled);
    setServiceLines(prev => prev.map(line => ({
      ...line,
      taxRate: enabled ? defaultTaxRate : 0
    })));
  };

  const handleCurrencyChange = (newCurrency: 'DOP' | 'USD') => {
    if (newCurrency === currency) return;
    const rate = exchangeRate > 0 ? exchangeRate : 60;
    
    // Si ya hay líneas con precios mayores a 0, convertimos automáticamente los precios
    const hasPrices = serviceLines.some(l => (Number(l.unitPrice) || 0) > 0);
    if (hasPrices) {
      setServiceLines(prev => prev.map(line => {
        const p = Number(line.unitPrice) || 0;
        if (p <= 0) return line;
        const converted = newCurrency === 'USD'
          ? Math.round((p / rate) * 100) / 100
          : Math.round((p * rate) * 100) / 100;
        return { ...line, unitPrice: converted };
      }));
      toast({
        title: `Moneda cambiada a ${newCurrency}`,
        description: `Montos convertidos ${currency} ➔ ${newCurrency} con tasa de RD$ ${rate.toFixed(2)}.`,
      });
    } else {
      toast({
        title: `Moneda cambiada a ${newCurrency}`,
        description: `Ahora los nuevos conceptos se facturarán en ${newCurrency}.`,
      });
    }

    setCurrency(newCurrency);
  };

  const handleConvertPrices = () => {
    const rate = exchangeRate > 0 ? exchangeRate : 60;
    const hasPrices = serviceLines.some(l => (Number(l.unitPrice) || 0) > 0);
    if (!hasPrices) {
      toast({
        title: "Sin montos para convertir",
        description: "Ingresa montos en los conceptos primero.",
      });
      return;
    }

    setServiceLines(prev => prev.map(line => {
      const p = Number(line.unitPrice) || 0;
      if (p <= 0) return line;
      const converted = currency === 'USD'
        ? Math.round((p / rate) * 100) / 100
        : Math.round((p * rate) * 100) / 100;
      return { ...line, unitPrice: converted };
    }));

    toast({
      title: "Montos recalculados",
      description: `Precios adaptados según la tasa de RD$ ${rate.toFixed(2)}.`,
    });
  };

  const [selectedInvoiceTypeId, setSelectedInvoiceTypeId] = useState<string>(() => {
    if (effectiveIsElectronic) return 'FAC';
    const b01 = invoiceTypes.find(t => t.code === 'B01');
    const b02 = invoiceTypes.find(t => t.code === 'B02');
    return b01?.id || b02?.id || invoiceTypes[0]?.id || '';
  });

  useEffect(() => {
    if (effectiveIsElectronic) {
      setSelectedInvoiceTypeId(prev => {
        if (prev === 'FAC' || prev === 'COT' || prev.startsWith('E')) return prev;
        return 'FAC';
      });
    } else {
      setSelectedInvoiceTypeId(prev => {
        if (prev === 'FAC' || prev === 'COT') return prev;
        if (prev.startsWith('E')) {
          const b01 = invoiceTypes.find(t => t.code === 'B01');
          const b02 = invoiceTypes.find(t => t.code === 'B02');
          return b01?.id || b02?.id || invoiceTypes[0]?.id || 'FAC';
        }
        return prev;
      });
    }
  }, [effectiveIsElectronic, invoiceTypes]);
  (() => {
  });

  const [paymentCondition, setPaymentCondition] = useState<'contado' | 'credito'>('contado');
  const [paymentMethod, setPaymentMethod] = useState<string>('transfer');
  const [creditDays, setCreditDays] = useState<number>(() => {
    return parseInt(localStorage.getItem('cobro_quote_validity_days') || '30', 10) || 30;
  });
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
    if (selectedInvoiceTypeId === 'FAC') {
      return { id: 'FAC', code: 'FAC', name: 'Factura Interna' };
    }
    return mappedInvoiceTypes.find(t => t.id === selectedInvoiceTypeId) || invoiceTypes.find(t => t.id === selectedInvoiceTypeId);
  }, [mappedInvoiceTypes, invoiceTypes, selectedInvoiceTypeId]);


  const isQuote = selectedInvoiceTypeId === 'COT';

  const todayDateStr = useMemo(() => {
    return new Date().toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  const dueDateStr = useMemo(() => {
    if (isQuote) {
      return `Válida por ${creditDays || 30} días`;
    }
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
  }, [isQuote, paymentCondition, creditDays]);

  // Cálculos de totales (Soporta sin impuesto, con impuesto adicional y con impuesto incluido)
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;

    serviceLines.forEach(line => {
      const lineQty = Number(line.quantity) || 0;
      const linePrice = Number(line.unitPrice) || 0;
      const effectiveTaxRate = applyTax ? (Number(line.taxRate) || 0) : 0;
      const lineGross = lineQty * linePrice;

      if (applyTax && priceIncludesTax) {
        // Precio digitado ya incluye el impuesto
        const lineSub = effectiveTaxRate > 0 ? (lineGross / (1 + effectiveTaxRate / 100)) : lineGross;
        const lineTax = lineGross - lineSub;
        subtotal += lineSub;
        taxTotal += lineTax;
      } else {
        // Precio digitado es antes de impuesto
        const lineTax = lineGross * (effectiveTaxRate / 100);
        subtotal += lineGross;
        taxTotal += lineTax;
      }
    });

    const total = applyTax && priceIncludesTax
      ? serviceLines.reduce((acc, l) => acc + ((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)), 0)
      : subtotal + taxTotal;

    return {
      subtotal,
      taxTotal,
      total
    };
  }, [serviceLines, applyTax, priceIncludesTax]);

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
      .map(line => {
        const effectiveTaxRate = applyTax ? (Number(line.taxRate) || 0) : 0;
        return {
          id: `srv-${crypto.randomUUID().slice(0, 8)}`,
          name: line.description.trim(),
          price: Number(line.unitPrice),
          quantity: Number(line.quantity) || 1,
          tax: effectiveTaxRate / 100,
          cost_includes_tax: applyTax && priceIncludesTax,
        };
      });
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

    let finalNotes = notes.trim();
    if (currency === 'USD') {
      const rateNote = `Factura emitida en USD • Tasa de Cambio: 1 USD = RD$ ${exchangeRate.toFixed(2)}`;
      if (!finalNotes.includes('Tasa de Cambio') && !finalNotes.includes('USD')) {
        finalNotes = finalNotes ? `${finalNotes} | ${rateNote}` : rateNote;
      }
    }

    await onDirectEmit({
      customerId: selectedCustomerId,
      invoiceTypeId: selectedInvoiceTypeId,
      items: validItems,
      paymentMethod: paymentCondition === 'credito' ? 'credit' : paymentMethod,
      creditDays: isQuote ? (creditDays || 30) : (paymentCondition === 'credito' ? creditDays : undefined),
      notes: finalNotes,
      currency,
      exchangeRate,
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
            title="Limpiar formulario"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="hidden sm:inline">Limpiar</span>
          </Button>

          {onOpenQuotes && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenQuotes}
              className={cn(
                "h-7 px-2 text-xs font-bold gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 rounded-lg cursor-pointer shadow-xs",
                actionButton ? "sm:hidden" : "flex"
              )}
              title="Ver cotizaciones guardadas en el POS"
            >
              <FileText className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">Cotizaciones</span>
              <span className="sm:hidden text-[11px]">Cotiz.</span>
              {Boolean(quoteCount && quoteCount > 0) && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-600 text-white ml-0.5">
                  {quoteCount}
                </span>
              )}
            </Button>
          )}

          <div className="hidden sm:flex items-center gap-1.5">
            {actionButton}
          </div>
        </div>
      </header>

      {/* Main Content: On desktop fixed 2-column, on mobile fluid vertical scrolling */}
      <div className="flex-1 min-h-0 p-2 sm:p-3 overflow-y-auto lg:overflow-hidden flex flex-col lg:grid lg:grid-cols-12 gap-2.5 sm:gap-3 pb-24 lg:pb-2.5">
        
        {/* Left Column: Customer & Service Line Items */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-0 lg:h-full gap-2 shrink-0 lg:shrink lg:overflow-hidden">
          
          {/* Top Bar: Customer Selector & Preset Service Pills */}
          <div className="p-2 sm:p-2.5 rounded-xl bg-card/60 border border-border/50 shrink-0 space-y-2 shadow-xs">
            {/* Customer selector row */}
            <div className="space-y-1.5">
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

              {isQuote && (
                <p className="text-[10px] text-muted-foreground pt-0.5">
                  Se guardará por {creditDays || 30} días en la pestaña <strong>Cotizaciones</strong> para cargarla y facturarla luego.
                </p>
              )}
            </div>
          </div>

          {/* Service Items Table Container */}
          <div className="flex flex-col rounded-xl border border-border/50 bg-card/40 overflow-hidden shadow-xs shrink-0 lg:shrink lg:flex-1 lg:min-h-0">
            {/* Table Header (hidden on mobile, visible on desktop/tablet) */}
            <div className="hidden sm:grid shrink-0 border-b border-border/40 bg-muted/30 px-3 py-1.5 grid-cols-12 gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-5">Descripción del Servicio</div>
              <div className="col-span-2 text-center">Cant. / Horas</div>
              <div className="col-span-2 text-right">Precio ({activeCurrencySymbol})</div>
              <div className="col-span-2 text-center">ITBIS</div>
              <div className="col-span-1 text-center"></div>
            </div>

            {/* Table Rows / Cards */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/20 p-1 sm:p-1.5 space-y-2 sm:space-y-0">
              {serviceLines.map(line => {
                return (
                  <div
                    key={line.id}
                    className="p-2 sm:px-2 sm:py-1 hover:bg-muted/10 transition-colors rounded-lg group bg-card/50 sm:bg-transparent border sm:border-0 border-border/50 shadow-2xs sm:shadow-none"
                  >
                    {/* MOBILE CARD VIEW (< sm) */}
                    <div className="sm:hidden space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Concepto o servicio (ej. Asesoría)..."
                          value={line.description}
                          onChange={e => handleUpdateLine(line.id, 'description', e.target.value)}
                          className="h-8.5 rounded-lg text-xs bg-background/80 border-border/50 placeholder:text-muted-foreground/50 focus-visible:border-emerald-500 font-medium flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.id)}
                          className="h-8.5 w-8.5 flex items-center justify-center rounded-lg text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                          title="Eliminar fila"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">Cant./Horas</label>
                          <Input
                            type="number"
                            min="1"
                            step="any"
                            value={line.quantity}
                            onChange={e => handleUpdateLine(line.id, 'quantity', parseFloat(e.target.value) || 1)}
                            className="h-8 w-full text-center font-mono font-bold rounded-lg text-xs bg-background/80 border-border/50"
                          />
                        </div>

                        <div className="col-span-5">
                          <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">Precio ({activeCurrencySymbol})</label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={line.unitPrice || ''}
                            onChange={e => handleUpdateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="h-8 w-full text-right font-mono font-bold text-emerald-400 rounded-lg text-xs bg-background/80 border-border/50"
                          />
                        </div>

                        <div className="col-span-3">
                          <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">ITBIS</label>
                          <Select
                            value={line.taxRate.toString()}
                            onValueChange={val => handleUpdateLine(line.id, 'taxRate', parseFloat(val))}
                          >
                            <SelectTrigger className="h-8 w-full text-xs bg-background/80 border-border/50 px-1 text-center font-bold">
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
                    </div>

                    {/* DESKTOP TABLE ROW (>= sm) */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                      {/* Description */}
                      <div className="col-span-5">
                        <Input
                          placeholder="Concepto o servicio (ej. Asesoría fiscal)..."
                          value={line.description}
                          onChange={e => handleUpdateLine(line.id, 'description', e.target.value)}
                          className="h-8 rounded-lg text-xs bg-background/60 border-border/40 placeholder:text-muted-foreground/50 focus-visible:border-emerald-500 font-medium"
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
                          className="h-8 w-full text-center font-mono font-bold rounded-lg text-xs bg-background/60 border-border/40"
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
                          className="h-8 w-full text-right font-mono font-bold text-emerald-400 rounded-lg text-xs bg-background/60 border-border/40"
                        />
                      </div>

                      {/* Tax */}
                      <div className="col-span-2">
                        <Select
                          value={line.taxRate.toString()}
                          onValueChange={val => handleUpdateLine(line.id, 'taxRate', parseFloat(val))}
                        >
                          <SelectTrigger className="h-8 w-full text-xs bg-background/60 border-border/40 px-2 text-center font-semibold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="18">18% ITBIS</SelectItem>
                            <SelectItem value="16">16% ITBIS</SelectItem>
                            <SelectItem value="0">0% (Exento)</SelectItem>
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

        {/* Right Column: Invoicing Config, Notes, Totals & Emit Button */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col min-h-0 lg:h-full justify-between gap-2.5 p-2.5 sm:p-3 rounded-xl border border-border/60 bg-card/60 shadow-xs shrink-0 lg:shrink lg:overflow-hidden">
          
          {/* Top Form Controls: Scrollable internally on laptops so Totals & Action buttons are ALWAYS visible! */}
          <div className="space-y-2 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1.5">
            {/* Selector de Moneda & Tasa de Cambio */}
            <div className="p-2 rounded-xl bg-background/80 border border-border/70 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-emerald-400" />
                  Moneda de la Factura
                </label>
                <span className={cn(
                  "text-[10px] font-extrabold px-2 py-0.5 rounded-full border tracking-wide uppercase",
                  currency === 'USD' 
                    ? "bg-blue-500/15 text-blue-400 border-blue-500/30" 
                    : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                )}>
                  {currency === 'USD' ? 'US$ Dólares' : 'RD$ Pesos'}
                </span>
              </div>

              {/* Botones de Moneda DOP / USD */}
              <div className="grid grid-cols-2 p-0.5 bg-muted/40 rounded-lg border border-border/60 gap-1">
                <button
                  type="button"
                  onClick={() => handleCurrencyChange('DOP')}
                  className={cn(
                    "py-1 text-xs font-bold rounded transition-all cursor-pointer flex items-center justify-center gap-1.5",
                    currency === 'DOP'
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>DOP (RD$)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCurrencyChange('USD')}
                  className={cn(
                    "py-1 text-xs font-bold rounded transition-all cursor-pointer flex items-center justify-center gap-1.5",
                    currency === 'USD'
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>USD (US$)</span>
                </button>
              </div>

              {/* Tasa y botón para recalcular montos */}
              <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-border/40 text-[11px]">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="text-muted-foreground text-[10px] font-medium shrink-0">1 USD = RD$</span>
                  <input
                    type="number"
                    step="0.05"
                    min="1"
                    value={exchangeRate}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setExchangeRate(val);
                      if (val > 0) localStorage.setItem('cobro_pos_exchange_rate', val.toString());
                    }}
                    className="h-6 w-16 px-1.5 text-center font-mono font-bold text-xs bg-background/80 border border-border/70 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="60.00"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleConvertPrices}
                  title="Recalcular precios de los conceptos con la tasa actual"
                  className="px-2 py-0.5 text-[10px] font-semibold rounded bg-muted/60 hover:bg-muted text-foreground border border-border/60 flex items-center gap-1 transition-all cursor-pointer hover:border-emerald-500/40 shrink-0"
                >
                  <ArrowLeftRight className="h-2.5 w-2.5 text-emerald-400" />
                  <span>Convertir montos</span>
                </button>
              </div>
            </div>

            {/* Control de Impuesto (ITBIS): Incluir o no incluir */}
            <div className="p-2 rounded-xl bg-background/80 border border-border/70 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-emerald-400" />
                  Impuesto (ITBIS)
                </label>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase transition-colors",
                    applyTax
                      ? (priceIncludesTax
                          ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                          : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30")
                      : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                  )}>
                    {applyTax ? (priceIncludesTax ? 'ITBIS Incluido' : '+ 18% ITBIS') : 'Sin ITBIS (0%)'}
                  </span>
                  <Switch
                    checked={applyTax}
                    onCheckedChange={handleToggleApplyTax}
                  />
                </div>
              </div>

              {applyTax && (
                <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-[11px]">
                  <div
                    onClick={() => setPriceIncludesTax(!priceIncludesTax)}
                    className="flex items-center gap-2 cursor-pointer select-none group"
                  >
                    <Checkbox
                      id="price-includes-tax"
                      checked={priceIncludesTax}
                      onCheckedChange={(checked) => setPriceIncludesTax(Boolean(checked))}
                      className="h-4 w-4 rounded data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 cursor-pointer"
                    />
                    <span className="text-[10.5px] font-medium text-foreground/90 group-hover:text-foreground transition-colors cursor-pointer">
                      El precio ya incluye el ITBIS
                    </span>
                  </div>
                  <span className="text-[9.5px] font-mono text-muted-foreground">
                    {priceIncludesTax ? 'Total = Precio' : 'Total = Precio + 18%'}
                  </span>
                </div>
              )}
            </div>

            {/* Comprobante Fiscal (NCF) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Building className="h-3 w-3 text-emerald-400" />
                {effectiveIsElectronic ? 'Comprobante (e-NCF)' : 'Comprobante (NCF)'}
              </label>
              <Select value={selectedInvoiceTypeId} onValueChange={setSelectedInvoiceTypeId}>
                <SelectTrigger className="h-8 rounded-lg bg-background/60 border-border/50 text-xs font-medium">
                  <SelectValue placeholder="Seleccionar NCF" />
                </SelectTrigger>
                  <SelectContent className="max-h-56">
                  <SelectItem value="FAC">
                    <span className="font-bold text-sky-400 font-mono mr-1.5">FAC</span>
                    <span>Factura Interna</span>
                  </SelectItem>
                  <SelectItem value="COT">
                    <span className="font-bold text-amber-400 font-mono mr-1.5">COT</span>
                    <span>Cotización</span>
                  </SelectItem>
                  {mappedInvoiceTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="font-bold text-emerald-400 font-mono mr-1.5">{t.code}</span>
                      <span>{t.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Condición de Pago o Vigencia de Cotización */}
            {isQuote ? (
              <div className="space-y-1.5 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Vigencia de la Cotización
                  </label>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold font-mono">
                    {creditDays || 30} días
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[15, 30, 45, 60].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setCreditDays(d);
                        localStorage.setItem('cobro_quote_validity_days', String(d));
                      }}
                      className={cn(
                        "py-1 text-[11px] font-bold rounded transition-all cursor-pointer border",
                        creditDays === d
                          ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                          : "bg-background/80 text-muted-foreground border-border/60 hover:text-foreground"
                      )}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-muted-foreground">Personalizado:</span>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={creditDays || ''}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 1));
                      setCreditDays(v);
                      localStorage.setItem('cobro_quote_validity_days', String(v));
                    }}
                    className="h-7 text-xs w-20 text-center font-bold bg-background/80"
                  />
                  <span className="text-[10px] text-muted-foreground">días</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Se guardará en Cuentas por {creditDays || 30} días para cargarla al POS y facturarla luego.
                </p>
              </div>
            ) : (
              <>
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

              </>
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

          {/* Bottom Summary & Actions (Pinned at bottom) */}
          <div className="shrink-0 space-y-2 pt-2 border-t border-border/40 mt-auto">
            {/* Totals Box */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5 space-y-1 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span className="font-mono text-foreground font-medium">
                  {activeCurrencySymbol} {totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>
                  {applyTax
                    ? (priceIncludesTax ? 'ITBIS (18% incluido):' : 'ITBIS (18%):')
                    : 'ITBIS (0% exento):'}
                </span>
                <span className={cn(
                  "font-mono font-medium",
                  applyTax ? "text-foreground" : "text-muted-foreground line-through"
                )}>
                  {activeCurrencySymbol} {totals.taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pt-1.5 border-t border-border/40 flex items-baseline justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">Total a Cobrar:</span>
                <span className={cn(
                  "text-xl font-bold font-mono",
                  currency === 'USD' ? "text-blue-400" : "text-emerald-400"
                )}>
                  {activeCurrencySymbol} {totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Conversión aproximada reflejada */}
              <div className="pt-1.5 border-t border-border/30 flex items-center justify-between text-[10.5px] text-muted-foreground">
                <span>Equivalente:</span>
                <span className="font-mono font-bold text-foreground/90">
                  {currency === 'USD'
                    ? `RD$ ${(totals.total * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `US$ ${(exchangeRate > 0 ? totals.total / exchangeRate : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  }
                  <span className="text-[9.5px] text-muted-foreground font-normal ml-1">(@ {exchangeRate.toFixed(2)})</span>
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
                className={cn(
                  "h-10 w-full font-bold text-xs sm:text-sm text-white rounded-xl shadow-md gap-2 transition-all cursor-pointer active:scale-95",
                  isQuote 
                    ? "bg-amber-600 hover:bg-amber-500 shadow-amber-900/20" 
                    : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20"
                )}
              >
                {isEmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{isQuote ? 'Generando Cotización...' : 'Emitiendo Factura Carta...'}</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    <span>{isQuote ? 'Guardar Cotización en POS' : 'Emitir Factura (Carta)'}</span>
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
