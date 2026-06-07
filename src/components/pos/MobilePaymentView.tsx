import React, { useState } from 'react';
import {
  Calculator,
  User,
  FileText,
  DollarSign,
  CreditCard,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Tag,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);

  const { data: customerBalance } = useCustomerBalance(selectedCustomer);

  const mappedInvoiceTypes = React.useMemo(() => {
    return invoiceTypes.map(type => {
      if (isElectronic) {
        if (type.code === 'B01') {
          return { ...type, code: 'E31', name: 'Crédito Fiscal Electrónico' };
        } else if (type.code === 'B02') {
          return { ...type, code: 'E32', name: 'Consumidor Final Electrónico' };
        }
      }
      return type;
    });
  }, [invoiceTypes, isElectronic]);

  const selectedType = mappedInvoiceTypes.find(t => t.id === selectedInvoiceType);
  const requiresCustomer = selectedType?.code === 'B01' || selectedType?.code === 'E31' || selectedType?.name?.toLowerCase().includes('crédito fiscal');
  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);
  const canCheckout = cartLength > 0 && (!requiresCustomer || selectedCustomer);

  React.useEffect(() => {
    if (requiresCustomer && !selectedCustomer) {
      setIsCustomerOpen(true);
    }
  }, [requiresCustomer, selectedCustomer]);

  const handleDiscountValueChange = (value: number) => {
    onDiscountChange({ ...globalDiscount, value });
  };

  const displayDebt = customerBalance?.totalDebt || 0;

  return (
    <div className="min-h-full flex flex-col bg-zinc-950 p-4 pb-20 gap-4 overflow-x-hidden">
      {/* ── TOTALS CARD (Modern Glassmorphism) ── */}
      <Card className="bg-gradient-to-br from-zinc-900 to-black border-white/5 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-[60px] rounded-full -mr-16 -mt-16" />
        <CardContent className="p-6 relative z-10">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between opacity-60">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Resumen de Cargo</span>
              <Calculator className="h-4 w-4 text-green-500" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-zinc-400">
                <span className="text-sm font-medium">Subtotal Bruto</span>
                <span className="text-sm font-black">${totals.subtotal}</span>
              </div>
              
              <div className="flex justify-between items-center group">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-400">Descuento Global</span>
                  <div className="flex items-center bg-zinc-800/50 rounded-lg p-0.5 border border-white/5">
                    <button 
                      onClick={() => onDiscountChange({ ...globalDiscount, type: 'percentage', value: 0 })}
                      className={cn("px-2 py-1 rounded-md text-[9px] font-black transition-all", globalDiscount.type === 'percentage' ? "bg-green-600 text-white" : "text-zinc-600")}
                    >
                      %
                    </button>
                    <button 
                      onClick={() => onDiscountChange({ ...globalDiscount, type: 'amount', value: 0 })}
                      className={cn("px-2 py-1 rounded-md text-[9px] font-black transition-all", globalDiscount.type === 'amount' ? "bg-green-600 text-white" : "text-zinc-600")}
                    >
                      $
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={globalDiscount.value || ''}
                    onChange={(e) => handleDiscountValueChange(parseFloat(e.target.value) || 0)}
                    className="w-16 h-8 text-xs bg-zinc-800/50 border-white/5 text-right font-black text-green-500 focus:ring-green-500/20"
                    placeholder="0"
                  />
                  <span className="text-sm font-black text-green-500">-${totals.discount}</span>
                </div>
              </div>

              <div className="flex justify-between text-zinc-400">
                <span className="text-sm font-medium">ITBIS Aplicado (18%)</span>
                <span className="text-sm font-black">${totals.tax}</span>
              </div>
            </div>

            <div className="h-px bg-white/5 my-2" />

            <div className="flex justify-between items-end">
              <span className="text-lg font-black text-zinc-500 uppercase tracking-tighter">Total Final</span>
              <span className="text-4xl font-black text-white tracking-tighter">
                ${totals.total}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── CUSTOMER & SETTINGS (Clean Accordions) ── */}
      <div className="grid gap-3">
        {/* ── INVOICE TYPE (Tipo de Comprobante) ── */}
        <Collapsible open={isInvoiceOpen} onOpenChange={setIsInvoiceOpen}>
          <CollapsibleTrigger asChild>
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-green-500/10 text-green-500">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Tipo de Comprobante</span>
                  <span className="text-sm font-black text-white">
                    {selectedType ? `${selectedType.name} (${selectedType.code})` : 'Crédito Fiscal'}
                  </span>
                </div>
              </div>
              {isInvoiceOpen ? <ChevronUp className="h-4 w-4 text-zinc-600" /> : <ChevronDown className="h-4 w-4 text-zinc-600" />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 animate-in slide-in-from-top-2 duration-200">
            <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-3">
              <Select value={selectedInvoiceType} onValueChange={onInvoiceTypeChange}>
                <SelectTrigger className="h-12 bg-zinc-900 border-white/5 rounded-xl font-bold">
                  <SelectValue placeholder="Tipo de NCF" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 rounded-xl">
                  {mappedInvoiceTypes
                    .filter(type => ['B01', 'E31', 'B02', 'E32'].includes(type.code))
                    .map((type) => (
                      <SelectItem key={type.id} value={type.id} className="font-bold">
                        {type.name} ({type.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ── CUSTOMER (Comprobante para) ── */}
        <Collapsible open={isCustomerOpen} onOpenChange={setIsCustomerOpen}>
          <CollapsibleTrigger asChild>
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl transition-colors", selectedCustomer ? "bg-green-500/10 text-green-500" : "bg-zinc-800 text-zinc-500")}>
                  <User className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Comprobante para</span>
                  <span className="text-sm font-black text-white truncate max-w-[150px]">
                    {selectedCustomerData?.name || 'Vendedor Final'}
                  </span>
                  {selectedCustomerData?.rnc && (
                    <span className="text-[9px] font-mono text-green-500 leading-none mt-0.5 font-bold">
                      RNC: {selectedCustomerData.rnc}
                    </span>
                  )}
                </div>
              </div>
              {isCustomerOpen ? <ChevronUp className="h-4 w-4 text-zinc-600" /> : <ChevronDown className="h-4 w-4 text-zinc-600" />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 animate-in slide-in-from-top-2 duration-200">
            <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-3 space-y-3">
              <Select value={selectedCustomer || "none"} onValueChange={(value) => onCustomerChange(value === "none" ? "" : value)}>
                <SelectTrigger className="h-12 bg-zinc-900 border-white/5 rounded-xl font-bold">
                  <SelectValue placeholder="Busca un cliente..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 rounded-xl">
                  <SelectItem value="none" className="font-bold">Clientes Varios</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="font-bold">
                      {c.name} {c.rnc ? `(RNC: ${c.rnc})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedCustomerData && (
                <div className="bg-zinc-900/80 border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                  <span className="text-[9px] uppercase font-black text-zinc-500 tracking-widest">Información de Facturación</span>
                  <span className="text-xs font-bold text-white">{selectedCustomerData.name}</span>
                  {selectedCustomerData.rnc ? (
                    <span className="text-[11px] font-mono font-bold text-green-500">RNC: {selectedCustomerData.rnc}</span>
                  ) : (
                    <span className="text-[11px] font-bold text-red-500">⚠️ Sin RNC registrado (Requerido para Crédito Fiscal)</span>
                  )}
                </div>
              )}

              {selectedCustomerData && displayDebt > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-black text-red-500 tracking-widest">Saldo Pendiente</span>
                    <span className="text-lg font-black text-white">${displayDebt.toFixed(2)}</span>
                  </div>
                  <Tag className="h-4 w-4 text-red-500" />
                </div>
              )}

              <Button 
                variant="ghost" 
                className="w-full h-12 rounded-xl border border-dashed border-white/10 text-zinc-400 font-bold gap-2 hover:bg-white/5"
                onClick={() => setShowAddCustomer(true)}
              >
                <UserPlus className="h-4 w-4" />
                Registrar Nuevo Cliente
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* ── CHECKOUT BUTTON (Impact) ── */}
      <AnimatePresence>
        {!canCheckout && requiresCustomer && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 justify-center py-2"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] uppercase font-black text-red-500/70 tracking-widest">Selecciona un cliente para {selectedType?.code || 'B01'}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto">
        <Button
          onClick={onCheckout}
          disabled={!canCheckout || isInvoiceLimitReached}
          className={cn(
            "w-full h-16 rounded-2xl text-lg font-black group transition-all relative overflow-hidden",
            canCheckout 
              ? "bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 shadow-[0_0_40px_rgba(34,197,94,0.3)]" 
              : "bg-zinc-800 text-zinc-600 border border-white/5"
          )}
        >
          <div className="flex items-center justify-between w-full px-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6" />
              <span>FINALIZAR VENTA</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">${totals.total}</span>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
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
