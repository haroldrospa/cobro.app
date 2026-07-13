import React, { useState } from 'react';
import {
  Calculator,
  User,
  FileText,
  DollarSign,
  CreditCard,
  UserPlus,
  ChevronUp,
  Tag,
  ArrowRight,
  ChevronDown,
  Search,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useCustomerBalance } from '@/hooks/useCustomerBalance';
import AddCustomerDialog from './AddCustomerDialog';
import { motion, AnimatePresence } from 'framer-motion';

interface Totals {
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
}

interface GlobalDiscount {
  type: 'percentage' | 'amount';
  value: number;
}

interface Customer {
  id: string;
  name: string;
  rnc?: string | null;
  credit_used?: number | null;
}

interface InvoiceType {
  id: string;
  name: string;
  code: string;
}

interface MobilePaymentViewProps {
  onCustomerAdded?: (customerId: string) => void;
  totals: Totals;
  selectedCustomer: string;
  selectedInvoiceType: string;
  cartLength: number;
  customers: Customer[];
  invoiceTypes: InvoiceType[];
  globalDiscount: GlobalDiscount;
  onCustomerChange: (customerId: string) => void;
  onInvoiceTypeChange: (typeId: string) => void;
  onDiscountChange: (discount: GlobalDiscount) => void;
  onCheckout: () => void;
  isInvoiceLimitReached?: boolean;
  isElectronic?: boolean;
}

const MobilePaymentView: React.FC<MobilePaymentViewProps> = ({
  totals,
  selectedCustomer,
  selectedInvoiceType,
  cartLength,
  customers,
  invoiceTypes,
  globalDiscount,
  onCustomerChange,
  onInvoiceTypeChange,
  onDiscountChange,
  onCheckout,
  isInvoiceLimitReached = false,
  isElectronic = false,
}) => {
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const filteredCustomers = React.useMemo(() => {
    const query = customerSearchQuery.toLowerCase().trim();
    if (!query) return customers;
    return customers.filter(c => 
      c.name.toLowerCase().includes(query) || 
      (c.rnc && c.rnc.toLowerCase().includes(query))
    );
  }, [customers, customerSearchQuery]);

  const { data: customerBalance } = useCustomerBalance(selectedCustomer);

  const mappedInvoiceTypes = React.useMemo(() => {
    return invoiceTypes.map(type => {
      if (isElectronic) {
        let electronicCode = type.code;
        let electronicName = type.name;
        
        if (type.code === 'B01') { electronicCode = 'E31'; electronicName = 'Crédito Fiscal Electrónico'; }
        else if (type.code === 'B02') { electronicCode = 'E32'; electronicName = 'Consumidor Final Electrónico'; }
        else if (type.code === 'B03') { electronicCode = 'E33'; electronicName = 'Nota de Débito Electrónica'; }
        else if (type.code === 'B04') { electronicCode = 'E34'; electronicName = 'Nota de Crédito Electrónica'; }
        else if (type.code === 'B11') { electronicCode = 'E41'; electronicName = 'Proveedores Informales Electrónico'; }
        else if (type.code === 'B12') { electronicCode = 'E43'; electronicName = 'Registro Único de Ingresos Electrónico'; }
        else if (type.code === 'B13') { electronicCode = 'E44'; electronicName = 'Gastos Menores Electrónico'; }
        else if (type.code === 'B14') { electronicCode = 'E45'; electronicName = 'Regímenes Especiales Electrónico'; }
        else if (type.code === 'B15') { electronicCode = 'E46'; electronicName = 'Comprobante Gubernamental Electrónico'; }
        else if (type.code === 'B16') { electronicCode = 'E47'; electronicName = 'Comprobante de Exportación Electrónico'; }
        else if (type.code.startsWith('B')) {
          electronicCode = 'E' + type.code.substring(1);
          electronicName = type.name + ' Electrónico';
        }
        
        return { ...type, code: electronicCode, name: electronicName };
      }
      return type;
    });
  }, [invoiceTypes, isElectronic]);

  const selectedType = mappedInvoiceTypes.find(t => t.id === selectedInvoiceType);
  const requiresCustomer = React.useMemo(() => {
    if (!selectedType?.code) return false;
    const code = selectedType.code;
    if (['B02', 'E32', 'B12', 'E43', 'B13', 'E44'].includes(code)) return false;
    return true;
  }, [selectedType]);
  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);
  const canCheckout = cartLength > 0 && (!requiresCustomer || selectedCustomer);

  const handleDiscountValueChange = (value: number) => {
    onDiscountChange({ ...globalDiscount, value });
  };

  const displayDebt = customerBalance?.totalDebt || 0;

  return (
    <div className="min-h-full flex flex-col bg-background p-3 sm:p-4 pb-4 sm:pb-6 gap-3 sm:gap-4 overflow-x-hidden">
      {/* ── TOTALS CARD (Modern Glassmorphism - More Compact) ── */}
      <Card className="bg-card border border-border relative overflow-hidden shadow-md rounded-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-[60px] rounded-full -mr-16 -mt-16" />
        <CardContent className="p-3.5 sm:p-5 relative z-10">
          <div className="flex flex-col gap-2.5 sm:gap-3.5">
            <div className="flex items-center justify-between opacity-60">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Resumen de Cargo</span>
              <Calculator className="h-4 w-4 text-green-500" />
            </div>
            
            <div className="space-y-1.5 sm:space-y-2.5">
              <div className="flex justify-between text-muted-foreground">
                <span className="text-xs sm:text-sm font-medium">Subtotal Bruto</span>
                <span className="text-xs sm:text-sm font-black text-foreground">${totals.subtotal}</span>
              </div>
              
              <div className="flex justify-between items-center text-muted-foreground">
                <span className="text-xs sm:text-sm font-medium">Descuento Global</span>
                <span className="text-xs sm:text-sm font-black text-green-500">-${totals.discount}</span>
              </div>

              <div className="flex justify-between text-muted-foreground">
                <span className="text-xs sm:text-sm font-medium">ITBIS Aplicado (18%)</span>
                <span className="text-xs sm:text-sm font-black text-foreground">${totals.tax}</span>
              </div>
            </div>

            {/* Dedicated Discount Editor Bar - Compact */}
            <div className="flex items-center gap-2 bg-muted p-2 rounded-xl border border-border shadow-inner">
              <Tag className="h-3.5 w-3.5 text-green-500" />
              <span className="text-[11px] font-bold text-muted-foreground">Aplicar Descuento</span>
              <div className="flex items-center bg-background rounded-lg p-0.5 border border-border ml-auto">
                <button 
                  onClick={() => onDiscountChange({ ...globalDiscount, type: 'percentage', value: 0 })}
                  className={cn("px-1.5 py-0.5 rounded text-[9px] font-black transition-all", globalDiscount.type === 'percentage' ? "bg-green-600 text-white" : "text-muted-foreground")}
                >
                  %
                </button>
                <button 
                  onClick={() => onDiscountChange({ ...globalDiscount, type: 'amount', value: 0 })}
                  className={cn("px-1.5 py-0.5 rounded text-[9px] font-black transition-all", globalDiscount.type === 'amount' ? "bg-green-600 text-white" : "text-muted-foreground")}
                >
                  $
                </button>
              </div>
              <Input
                type="number"
                value={globalDiscount.value || ''}
                onChange={(e) => handleDiscountValueChange(parseFloat(e.target.value) || 0)}
                className="w-14 h-7 text-xs bg-background border-border text-right font-black text-green-500 focus-visible:ring-1 focus-visible:ring-green-500/30 rounded-lg"
                placeholder="0"
              />
            </div>

            <div className="h-px bg-border my-0.5" />

            <div className="flex justify-between items-end">
              <span className="text-xs font-black text-muted-foreground uppercase tracking-wide pb-0.5">Total Final</span>
              <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tighter">
                ${totals.total}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── CUSTOMER & SETTINGS (Compact Direct Selects) ── */}
      <div className="flex flex-col gap-3 sm:gap-4">
        {/* ── INVOICE TYPE (Tipo de Comprobante) ── */}
        <div className="flex flex-col gap-1">
          <span className="text-[9px] uppercase font-black tracking-widest text-muted-foreground px-1">Comprobante Fiscal</span>
          <Select value={selectedInvoiceType} onValueChange={onInvoiceTypeChange}>
            <SelectTrigger className="w-full h-auto bg-card border border-border hover:bg-accent/10 rounded-2xl p-3 sm:p-4 flex items-center justify-between font-bold text-left focus:ring-1 focus:ring-green-500/20 active:scale-[0.99] transition-all">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 sm:p-2 rounded-xl bg-green-500/10 text-green-500">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm font-black text-foreground">
                    {selectedType ? `${selectedType.name} (${selectedType.code})` : 'Consumidor Final (B02)'}
                  </span>
                </div>
              </div>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border rounded-xl">
              {mappedInvoiceTypes
                .filter(type => !['B03', 'E33', 'B04', 'E34'].includes(type.code))
                .map((type) => (
                  <SelectItem key={type.id} value={type.id} className="font-bold">
                    {type.name} ({type.code})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── CUSTOMER (Comprobante para) ── */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center px-1">
            <span className="text-[9px] uppercase font-black tracking-widest text-muted-foreground">Cliente</span>
            <button 
              onClick={() => setShowAddCustomer(true)}
              className="text-[9px] uppercase font-black tracking-widest text-green-500 hover:text-green-400 flex items-center gap-1 active:scale-95 transition-transform"
            >
              <UserPlus className="h-3 w-3" />
              Nuevo Cliente
            </button>
          </div>

          <button
            onClick={() => {
              setCustomerSearchQuery('');
              setIsCustomerSelectOpen(true);
            }}
            className="w-full h-auto bg-card border border-border hover:bg-accent/10 rounded-2xl p-3 sm:p-4 flex items-center justify-between font-bold text-left focus:ring-1 focus:ring-green-500/20 active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className={cn("p-1.5 sm:p-2 rounded-xl transition-colors", selectedCustomer ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground")}>
                <User className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-black text-foreground truncate max-w-[200px]">
                  {selectedCustomerData?.name || 'Clientes Varios'}
                </span>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>

          <Dialog open={isCustomerSelectOpen} onOpenChange={setIsCustomerSelectOpen}>
            <DialogContent className="max-w-md bg-card border-border p-6 rounded-[2rem] max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader className="mb-2 shrink-0">
                <DialogTitle className="text-lg font-black text-foreground tracking-tight uppercase">
                  Buscar Cliente
                </DialogTitle>
              </DialogHeader>

              {/* Search Input */}
              <div className="relative mb-4 shrink-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre o RNC..."
                  className="pl-9 bg-background border-border focus:border-green-500 text-xs font-bold h-10 rounded-xl text-foreground"
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
              </div>

              {/* Customer List */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                {/* Clientes Varios (Público General) Option */}
                <button
                  onClick={() => {
                    onCustomerChange('');
                    setIsCustomerSelectOpen(false);
                  }}
                  className={cn(
                    "w-full text-left p-3 rounded-xl transition-colors flex items-center justify-between border border-transparent",
                    !selectedCustomer
                      ? "bg-green-500/10 border-green-500/20 text-foreground"
                      : "hover:bg-muted hover:border-border text-foreground"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">Clientes Varios (Público General)</span>
                  </div>
                  {!selectedCustomer && <Check className="h-4 w-4 text-green-500" />}
                </button>

                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        onCustomerChange(c.id);
                        setIsCustomerSelectOpen(false);
                      }}
                      className={cn(
                        "w-full text-left p-3 rounded-xl transition-colors flex items-center justify-between border border-transparent",
                        selectedCustomer === c.id
                          ? "bg-green-500/10 border-green-500/20 text-foreground"
                          : "hover:bg-muted hover:border-border text-foreground"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{c.name}</span>
                        {c.rnc && <span className="text-[10px] text-muted-foreground font-mono mt-0.5">RNC: {c.rnc}</span>}
                      </div>
                      {selectedCustomer === c.id && <Check className="h-4 w-4 text-green-500" />}
                    </button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <span className="text-xs font-bold text-muted-foreground mb-3">No se encontraron clientes</span>
                    <Button
                      size="sm"
                      onClick={() => {
                        setIsCustomerSelectOpen(false);
                        setShowAddCustomer(true);
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs"
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1" />
                      Nuevo Cliente
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Customer info badges below the selector */}
          {selectedCustomerData && (
            <div className="flex flex-wrap items-center gap-1.5 px-1 mt-0.5 animate-fade-in">
              {selectedCustomerData.rnc ? (
                <span className="text-[9px] sm:text-[10px] font-mono font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-md border border-green-500/15">
                  RNC: {selectedCustomerData.rnc}
                </span>
              ) : (
                <span className="text-[9px] sm:text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/15">
                  ⚠️ Sin RNC (Crédito Fiscal requiere RNC)
                </span>
              )}
              
              {displayDebt > 0 && (
                <span className="text-[9px] sm:text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/15">
                  Deuda: ${displayDebt.toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CHECKOUT BUTTON (Impact) ── */}
      <AnimatePresence>
        {!canCheckout && requiresCustomer && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 justify-center py-1.5"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] uppercase font-black text-red-500/75 tracking-widest">
              Selecciona un cliente para {selectedType?.code || 'B01'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto pt-1">
        <Button
          onClick={onCheckout}
          disabled={!canCheckout || isInvoiceLimitReached}
          className={cn(
            "w-full h-14 sm:h-16 rounded-2xl text-base sm:text-lg font-black group transition-all relative overflow-hidden",
            canCheckout 
              ? "bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 shadow-[0_0_40px_rgba(34,197,94,0.3)]" 
              : "bg-muted text-muted-foreground border border-border"
          )}
        >
          <div className="flex items-center justify-between w-full px-4">
            <div className="flex items-center gap-2.5">
              <CreditCard className="h-5.5 w-5.5" />
              <span>FINALIZAR VENTA</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl">${totals.total}</span>
              <ArrowRight className="h-4.5 w-4.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Button>
      </div>

      <AddCustomerDialog
        isOpen={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        onCustomerAdded={(customerId) => {
          onCustomerChange(customerId);
          setShowAddCustomer(false);
        }}
      />
    </div>
  );
};

export default MobilePaymentView;
