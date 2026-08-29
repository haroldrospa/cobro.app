import React, { useEffect, useRef, useState } from 'react';
import { DollarSign, CreditCard, Printer, Loader2, FileText, Plus, Check, ChevronsUpDown, Search, User, X, ChevronRight, Wallet, Banknote, ArrowRightLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import CreditInfo from './CreditInfo';
import AddCustomerDialog from './AddCustomerDialog';
import { useCustomerBalance } from '@/hooks/useCustomerBalance';
import { motion, AnimatePresence } from 'framer-motion';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  totals: {
    total: string;
  };
  paymentMethod: string;
  amountReceived: string;
  change: number;
  received: number;
  total: number;
  surchargeAmount?: number;
  selectedCustomer: string;
  creditDays: number;
  isProcessing?: boolean;
  onPaymentMethodChange: (method: string) => void;
  onAmountReceivedChange: (amount: string) => void;
  onCreditDaysChange: (days: number) => void;
  onProcessPayment: (includeDebt?: boolean, splitMethod?: string) => void;
  availableMethods?: { id: string; name: string; enabled: boolean }[];
  customers?: any[];
  onCustomerChange?: (customerId: string) => void;
  webOrderNotes?: string;
  requiresCustomer?: boolean;
}

const PaymentDialog: React.FC<PaymentDialogProps> = ({
  isOpen,
  onClose,
  totals,
  paymentMethod,
  amountReceived,
  change,
  received,
  total,
  surchargeAmount = 0,
  selectedCustomer,
  creditDays,
  isProcessing = false,
  onPaymentMethodChange,
  onAmountReceivedChange,
  onCreditDaysChange,
  onProcessPayment,
  availableMethods = [],
  customers = [],
  onCustomerChange,
  webOrderNotes,
  requiresCustomer = false,
}) => {
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const { data: balance } = useCustomerBalance(selectedCustomer);
  const [includeDebt, setIncludeDebt] = useState(false);
  const [openCustomerPopover, setOpenCustomerPopover] = useState(false);
  const [splitMethod, setSplitMethod] = useState('card');

  const previousDebt = selectedCustomer && selectedCustomer !== 'general' && balance ? (balance.totalDebt || 0) : 0;
  const fullTotal = total + (includeDebt ? previousDebt : 0);
  const fullTotals = {
    total: fullTotal.toFixed(2)
  };

  const selectedCustomerData = React.useMemo(() => {
    if (!selectedCustomer) return null;
    return customers.find(c => c.id === selectedCustomer) || null;
  }, [selectedCustomer, customers]);

  const selectedCustomerLabel = React.useMemo(() => {
    if (!selectedCustomer) return "Consumidor Final";
    return selectedCustomerData ? selectedCustomerData.name : "Cargando...";
  }, [selectedCustomer, selectedCustomerData]);

  const webChangeInfo = React.useMemo(() => {
    if (!webOrderNotes) return null;
    const changeMatch = webOrderNotes.match(/\[CAMBIO DE: ([\d.]+)\]/);
    if (changeMatch && changeMatch[1]) return { type: 'change', amount: changeMatch[1] };
    if (webOrderNotes.includes('[EFECTIVO EXACTO]')) return { type: 'exact' };
    return null;
  }, [webOrderNotes]);

  const suggestedAmounts = React.useMemo(() => {
    const amounts = new Set<number>();
    const tolerance = 0.01;
    [50, 100, 500, 1000].forEach(denom => {
      const next = Math.ceil((fullTotal + tolerance) / denom) * denom;
      if (next > fullTotal) amounts.add(next);
    });
    [200, 500, 1000, 2000].forEach(bill => {
      if (bill > fullTotal) amounts.add(bill);
    });
    return Array.from(amounts).sort((a, b) => a - b).slice(0, 4);
  }, [fullTotal]);

  const handlePaymentMethodChange = (method: string) => {
    onPaymentMethodChange(method);
    if (method === 'credit') {
      setOpenCustomerPopover(true);
    }
  };

  useEffect(() => {
    if (isOpen && paymentMethod === 'cash') {
      const focusInput = () => {
        if (amountInputRef.current) {
          amountInputRef.current.focus();
          amountInputRef.current.select();
        }
      };
      focusInput();
      const timer = setTimeout(focusInput, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, paymentMethod]);

  const handleCustomerAdded = (newCustomerId: string) => {
    if (onCustomerChange) {
      onCustomerChange(newCustomerId);
    }
  };

  const getMethodIcon = (id: string) => {
    switch (id) {
      case 'cash': return <Wallet className="h-4 w-4" />;
      case 'card': return <CreditCard className="h-4 w-4" />;
      case 'transfer': case 'bank': return <ArrowRightLeft className="h-4 w-4" />;
      case 'check': case 'cheque': return <FileText className="h-4 w-4" />;
      case 'credit': return <Banknote className="h-4 w-4" />;
      default: return <CreditCard className="h-4 w-4" />;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          hideCloseButton
          className="max-w-[420px] w-[calc(100%-1.5rem)] sm:w-full p-0 overflow-hidden bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl max-h-[92dvh] flex flex-col"
        >
          {/* Header con Total Hero tipo Apple / Stripe */}
          <div className="pt-6 px-6 pb-4 text-center relative">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="absolute top-4 right-4 h-8 w-8 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </Button>
            
            <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400">
              Total a cobrar
            </span>
            <div className="flex items-baseline justify-center gap-1.5 mt-1">
              <span className="text-xl font-bold text-emerald-400">RD$</span>
              <span className="text-4xl font-extrabold tracking-tight text-white">
                {parseFloat(fullTotals.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {surchargeAmount > 0 && (
              <span className="inline-block text-destructive text-[10px] font-semibold mt-1">
                + RD$ {surchargeAmount.toLocaleString()} recargo
              </span>
            )}
          </div>

          {/* Body Section */}
          <div className="px-6 pb-4 space-y-4 flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {/* Selector de Método (Segmented Bar Minimalista) */}
            <div className="bg-zinc-900/90 p-1 rounded-2xl border border-white/5 grid grid-cols-5 gap-1">
              {(availableMethods.length > 0 ? availableMethods.filter(m => m.enabled) : [
                { id: 'cash', name: 'Efectivo' },
                { id: 'card', name: 'Tarjeta' },
                { id: 'transfer', name: 'Transf.' },
                { id: 'credit', name: 'Crédito' }
              ]).map((method) => {
                const isSelected = paymentMethod === method.id;
                const displayName = method.name === 'Transferencia' ? 'Transf.' : method.name;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => handlePaymentMethodChange(method.id)}
                    className={cn(
                      "py-2 px-1 rounded-xl text-xs font-semibold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 active:scale-95 select-none",
                      isSelected 
                        ? "bg-white/10 text-white shadow-sm font-bold border border-white/10" 
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]"
                    )}
                  >
                    <span className={cn(isSelected ? "text-emerald-400" : "text-zinc-500")}>
                      {getMethodIcon(method.id)}
                    </span>
                    <span className="truncate text-[11px]">{displayName}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => handlePaymentMethodChange('split')}
                className={cn(
                  "py-2 px-1 rounded-xl text-xs font-semibold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 active:scale-95 select-none",
                  paymentMethod === 'split' 
                    ? "bg-blue-500/20 text-blue-300 shadow-sm font-bold border border-blue-400/20" 
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]"
                )}
              >
                <Plus className={cn("h-3.5 w-3.5", paymentMethod === 'split' ? "text-blue-400" : "text-zinc-500")} />
                <span className="text-[11px]">Mixto</span>
              </button>
            </div>

            {/* Cliente */}
            <div className="flex items-center gap-2">
              <Popover open={openCustomerPopover} onOpenChange={setOpenCustomerPopover}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex-1 h-10 px-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] text-left flex items-center justify-between text-xs transition-colors",
                      (paymentMethod === 'credit' && !selectedCustomer) || (requiresCustomer && (!selectedCustomer || !selectedCustomerData?.rnc))
                        ? "border-destructive/50 text-destructive"
                        : "text-zinc-300"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <User className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate font-medium">
                        {selectedCustomer ? selectedCustomerLabel : "Consumidor Final"}
                      </span>
                      {selectedCustomer && selectedCustomerData?.rnc && (
                        <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
                          {selectedCustomerData.rnc}
                        </span>
                      )}
                    </div>
                    <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-500 shrink-0 ml-1" />
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  side="bottom" 
                  sideOffset={6} 
                  collisionPadding={12} 
                  className="w-[calc(100vw-2.5rem)] sm:w-[340px] p-0 bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl z-[150] overflow-hidden" 
                  align="start"
                >
                  <Command className="bg-transparent border-none">
                    <CommandInput 
                      placeholder="Buscar por nombre o RNC..." 
                      className="h-10 text-xs font-medium text-white placeholder:text-zinc-500 bg-zinc-900 border-b border-white/10" 
                    />
                    <CommandList className="max-h-[220px] overflow-y-auto p-1.5 scrollbar-thin">
                      <CommandEmpty className="p-4 text-xs text-zinc-400 text-center">
                        No se encontraron clientes
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="general-consumidor-final"
                          onSelect={() => { onCustomerChange?.(""); setOpenCustomerPopover(false); }}
                          className={cn(
                            "p-2.5 cursor-pointer rounded-xl mx-0.5 my-1 text-xs transition-all flex items-center justify-between",
                            !selectedCustomer ? "bg-emerald-500/20 text-emerald-400 font-bold" : "text-zinc-300 hover:bg-white/5"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 opacity-70" />
                            <span>Consumidor Final</span>
                          </div>
                          {!selectedCustomer && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
                        </CommandItem>

                        {customers.map((customer) => {
                          const isSelected = selectedCustomer === customer.id;
                          return (
                            <CommandItem
                              key={customer.id}
                              value={`${customer.name} ${customer.rnc || ''} ${customer.phone || ''} ${customer.id}`}
                              onSelect={() => { onCustomerChange?.(customer.id); setOpenCustomerPopover(false); }}
                              className={cn(
                                "p-2.5 cursor-pointer rounded-xl mx-0.5 my-1 text-xs transition-all flex items-center justify-between",
                                isSelected ? "bg-emerald-500/20 text-emerald-400 font-bold" : "text-zinc-300 hover:bg-white/5"
                              )}
                            >
                              <div className="flex flex-col min-w-0 flex-1 pr-2 text-left">
                                <span className="truncate text-xs font-semibold">{customer.name}</span>
                                {customer.rnc && (
                                  <span className="text-[10px] font-mono text-zinc-400 mt-0.5">
                                    RNC: {customer.rnc}
                                  </span>
                                )}
                              </div>
                              {isSelected && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <button
                type="button"
                className="h-10 w-10 bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] text-zinc-400 hover:text-white rounded-xl transition-colors flex items-center justify-center shrink-0"
                onClick={() => setIsAddCustomerOpen(true)}
                title="Nuevo cliente"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Alertas de RNC o Deuda */}
            {previousDebt > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span className="text-zinc-300">Deuda: <strong className="text-white">RD$ {previousDebt.toLocaleString()}</strong></span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-blue-400 font-semibold text-[11px]">
                  <input
                    type="checkbox"
                    checked={includeDebt}
                    onChange={(e) => setIncludeDebt(e.target.checked)}
                    className="h-3.5 w-3.5 rounded bg-zinc-800 border-white/20 text-emerald-500 focus:ring-0"
                  />
                  <span>Incluir</span>
                </label>
              </div>
            )}

            {paymentMethod === 'credit' && (
              <div className="p-3 bg-zinc-900/60 rounded-2xl border border-white/5">
                <CreditInfo
                  selectedCustomer={selectedCustomer}
                  creditDays={creditDays}
                  onCreditDaysChange={onCreditDaysChange}
                />
              </div>
            )}

            {/* Efectivo / Mixto Inputs */}
            {(paymentMethod === 'cash' || paymentMethod === 'split') && (
              <div className="space-y-3 pt-1">
                {paymentMethod === 'split' && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase">Restante por</span>
                      <select
                        value={splitMethod}
                        onChange={e => setSplitMethod(e.target.value)}
                        className="w-full h-9 bg-zinc-900 border border-white/10 rounded-xl px-2.5 text-white outline-none focus:border-white/20"
                      >
                        <option value="card">Tarjeta</option>
                        <option value="transfer">Transferencia</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase">Monto restante</span>
                      <div className="h-9 w-full bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center px-3 font-bold text-blue-400">
                        RD$ {Math.max(0, fullTotal - received).toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Input Monto Recibido - Minimalista */}
                <div className="bg-zinc-900/70 p-3.5 rounded-2xl border border-white/10 focus-within:border-emerald-500/40 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      {paymentMethod === 'split' ? 'Efectivo recibido' : 'Monto recibido'}
                    </span>
                    {webChangeInfo && (
                      <span className="text-[10px] font-bold text-amber-400">
                        {webChangeInfo.type === 'exact' ? 'Exacto' : `+RD$ ${webChangeInfo.amount}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center">
                    <span className="text-lg font-bold text-emerald-400 mr-2">RD$</span>
                    <Input
                      ref={amountInputRef}
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amountReceived}
                      onChange={(e) => onAmountReceivedChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && ((received >= fullTotal || paymentMethod === 'split') && !isProcessing)) {
                          onProcessPayment(includeDebt, splitMethod);
                        }
                      }}
                      className="text-2xl font-bold bg-transparent border-0 p-0 h-auto focus-visible:ring-0 text-white placeholder:text-zinc-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-none"
                    />
                  </div>
                </div>

                {/* Billetes Sugeridos (Pills minimalistas) */}
                {paymentMethod === 'cash' && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      className="h-7 px-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/10 text-xs font-semibold text-zinc-300 flex-1 transition-all active:scale-95"
                      onClick={() => onAmountReceivedChange(fullTotal.toString())}
                    >
                      Exacto
                    </button>
                    {suggestedAmounts.map(amt => (
                      <button
                        key={amt}
                        type="button"
                        className="h-7 px-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/10 text-xs font-semibold text-zinc-300 flex-1 transition-all active:scale-95"
                        onClick={() => onAmountReceivedChange(amt.toString())}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Cambio a Devolver - Fila limpia sin caja pesada */}
                {paymentMethod === 'cash' && received >= 0 && (() => {
                  const actualChange = received - fullTotal;
                  return (
                    <div className="flex items-center justify-between px-1 py-1 text-sm border-t border-white/5 pt-2">
                      <span className="text-zinc-400 font-medium text-xs">
                        {actualChange >= 0 ? "Cambio a devolver" : "Falta por recibir"}
                      </span>
                      <span className={cn("text-base font-bold tracking-tight", actualChange >= 0 ? "text-emerald-400" : "text-amber-400")}>
                        RD$ {Math.abs(actualChange).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Botón Principal de Pago */}
          <div className="p-6 pt-2 pb-6">
            <Button
              onClick={() => onProcessPayment(includeDebt, splitMethod)}
              className={cn(
                "w-full h-12 rounded-2xl font-bold text-sm transition-all active:scale-[0.99] shadow-lg",
                isProcessing 
                  ? "bg-zinc-800 text-zinc-500" 
                  : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold shadow-emerald-500/20"
              )}
              disabled={(paymentMethod === 'cash' && received < fullTotal) || (paymentMethod === 'split' && received <= 0) || (paymentMethod === 'split' && received >= fullTotal) || (paymentMethod === 'credit' && !selectedCustomer) || (requiresCustomer && (!selectedCustomer || !selectedCustomerData?.rnc)) || isProcessing}
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Procesando...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Printer className="h-4.5 w-4.5" />
                  <span>Facturar Pago</span>
                </div>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddCustomerDialog
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onCustomerAdded={handleCustomerAdded}
      />
    </>
  );
};

export default PaymentDialog;

