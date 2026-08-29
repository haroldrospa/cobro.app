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
          className="max-w-[430px] w-[calc(100%-1.5rem)] sm:w-full p-0 overflow-hidden bg-zinc-950/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl max-h-[94dvh] sm:max-h-[90vh] flex flex-col [@media(max-height:580px)]:max-h-[98dvh]"
        >
          {/* Header & Total Area */}
          <div className="p-5 pb-2 sm:p-6 sm:pb-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <DollarSign className="h-4.5 w-4.5 text-emerald-400" />
                </div>
                <DialogTitle className="text-lg font-black tracking-tight text-white">
                  Cobrar
                </DialogTitle>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Total a Pagar Card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-white/[0.05] to-white/[0.02] border border-white/10 p-4 text-center shadow-inner">
              <div className="absolute inset-0 bg-emerald-500/[0.03] pointer-events-none" />
              <span className="text-[10px] uppercase font-black tracking-[0.2em] text-emerald-400/80 block mb-1">
                Total a Pagar
              </span>
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-lg font-bold text-emerald-400">RD$</span>
                <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {parseFloat(fullTotals.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {surchargeAmount > 0 && (
                <span className="inline-block text-destructive text-[9px] font-bold uppercase tracking-wider mt-1 bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
                  + RD$ {surchargeAmount.toLocaleString()} recargo
                </span>
              )}
            </div>
          </div>

          {/* Body Section */}
          <div className="px-5 sm:px-6 pb-2 space-y-4 flex-1 min-h-0 flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {/* Cliente */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                Cliente
              </label>
              <div className="flex gap-2">
                <Popover open={openCustomerPopover} onOpenChange={setOpenCustomerPopover}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 h-10 bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.06] rounded-xl text-xs font-semibold justify-between px-3 text-white transition-all",
                        (paymentMethod === 'credit' && !selectedCustomer) || (requiresCustomer && (!selectedCustomer || !selectedCustomerData?.rnc))
                          ? "border-destructive/50 ring-1 ring-destructive/30 bg-destructive/5"
                          : ""
                      )}
                    >
                      <div className="flex items-center gap-2 overflow-hidden text-left min-w-0">
                        <User className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate text-xs font-medium text-zinc-200">
                          {selectedCustomer ? selectedCustomerLabel : "Consumidor Final"}
                        </span>
                        {selectedCustomer && selectedCustomerData?.rnc && (
                          <span className="text-[10px] font-mono text-emerald-400 font-bold shrink-0 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            RNC: {selectedCustomerData?.rnc}
                          </span>
                        )}
                      </div>
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-40 shrink-0 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    side="bottom" 
                    sideOffset={6} 
                    collisionPadding={12} 
                    className="w-[calc(100vw-2.5rem)] sm:w-[340px] p-0 bg-zinc-950/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-[150] overflow-hidden" 
                    align="start"
                  >
                    <Command className="bg-transparent border-none">
                      <CommandInput 
                        placeholder="Buscar por nombre, RNC o teléfono..." 
                        className="h-10 text-xs font-medium text-white placeholder:text-zinc-500 bg-zinc-900/80 border-b border-white/10" 
                      />
                      <CommandList className="max-h-[220px] overflow-y-auto p-1.5 scrollbar-thin">
                        <CommandEmpty className="p-4 text-xs text-zinc-400 font-bold uppercase tracking-widest text-center">
                          No se encontraron clientes
                        </CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="general-consumidor-final"
                            onSelect={() => { onCustomerChange?.(""); setOpenCustomerPopover(false); }}
                            className={cn(
                              "p-2.5 cursor-pointer rounded-xl mx-0.5 my-1 text-xs transition-all flex items-center justify-between",
                              !selectedCustomer 
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold" 
                                : "hover:bg-white/5 text-zinc-200"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 shrink-0 opacity-70" />
                              <span className="truncate">Consumidor Final</span>
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
                                  isSelected 
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold" 
                                    : "hover:bg-white/5 text-zinc-200"
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

                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 bg-white/[0.03] border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400 rounded-xl transition-colors shrink-0"
                  onClick={() => setIsAddCustomerOpen(true)}
                  title="Nuevo cliente"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {previousDebt > 0 && (
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-400 shrink-0" />
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-blue-400">Deuda Pendiente</p>
                      <p className="text-xs font-black text-white">RD$ {previousDebt.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-zinc-900/80 px-2 py-1 rounded-lg border border-blue-500/20">
                    <label htmlFor="include-debt" className="text-[9px] font-bold uppercase text-zinc-300 cursor-pointer">Incluir</label>
                    <input
                      type="checkbox"
                      id="include-debt"
                      checked={includeDebt}
                      onChange={(e) => setIncludeDebt(e.target.checked)}
                      className="h-3.5 w-3.5 rounded bg-zinc-800 border-white/20 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Método de Pago */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                Método de Pago
              </label>
              <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap">
                {(availableMethods.length > 0 ? availableMethods.filter(m => m.enabled) : [
                  { id: 'cash', name: 'Efectivo' },
                  { id: 'card', name: 'Tarjeta' },
                  { id: 'transfer', name: 'Transferencia' },
                  { id: 'credit', name: 'Crédito' }
                ]).map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => handlePaymentMethodChange(method.id)}
                    className={cn(
                      "h-9 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 min-w-[30%] active:scale-95 select-none",
                      paymentMethod === method.id 
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20 border border-emerald-400/30" 
                        : "bg-white/[0.04] border border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.08]"
                    )}
                  >
                    {getMethodIcon(method.id)}
                    <span className="truncate">{method.name}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handlePaymentMethodChange('split')}
                  className={cn(
                    "h-9 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 min-w-[30%] active:scale-95 select-none",
                    paymentMethod === 'split' 
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 border border-blue-400/30" 
                      : "bg-white/[0.04] border border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.08]"
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Mixto</span>
                </button>
              </div>
            </div>

            {paymentMethod === 'credit' && (
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/10">
                <CreditInfo
                  selectedCustomer={selectedCustomer}
                  creditDays={creditDays}
                  onCreditDaysChange={onCreditDaysChange}
                />
              </div>
            )}

            {(paymentMethod === 'cash' || paymentMethod === 'split') && (
              <div className="space-y-3 pt-1">
                {paymentMethod === 'split' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Restante en</label>
                      <select
                        value={splitMethod}
                        onChange={e => setSplitMethod(e.target.value)}
                        className="w-full h-9 bg-white/[0.04] border border-white/10 rounded-xl text-xs font-semibold px-2 text-white outline-none focus:border-emerald-500/40"
                      >
                        <option value="card" className="bg-zinc-900">Tarjeta</option>
                        <option value="transfer" className="bg-zinc-900">Transferencia</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Monto Restante</label>
                      <div className="h-9 w-full bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center px-3 font-bold text-blue-400 text-xs">
                        RD$ {Math.max(0, fullTotal - received).toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Monto Recibido Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                      {paymentMethod === 'split' ? 'Efectivo Recibido' : 'Monto Recibido'}
                    </label>
                    {webChangeInfo && (
                      <div className="bg-amber-500/10 text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-amber-500/20">
                        {webChangeInfo.type === 'exact' ? 'Exacto' : `+RD$ ${webChangeInfo.amount}`}
                      </div>
                    )}
                  </div>
                  
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <span className="text-base font-black text-emerald-400/60 group-focus-within:text-emerald-400 transition-colors">RD$</span>
                    </div>
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
                      className="h-12 pl-14 text-2xl font-black bg-white/[0.03] border border-white/10 focus-visible:bg-zinc-900 focus-visible:border-emerald-500/50 focus-visible:ring-0 rounded-2xl text-white transition-all shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  {/* Sugerencias Rápidas de Billetes */}
                  {paymentMethod === 'cash' && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        className="h-8 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 text-[10px] font-black uppercase text-zinc-300 flex-1 transition-all active:scale-95"
                        onClick={() => onAmountReceivedChange(fullTotal.toString())}
                      >
                        Exacto
                      </button>
                      {suggestedAmounts.map(amt => (
                        <button
                          key={amt}
                          type="button"
                          className="h-8 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 text-[10px] font-black uppercase text-zinc-300 flex-1 transition-all active:scale-95"
                          onClick={() => onAmountReceivedChange(amt.toString())}
                        >
                          {amt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Cambio a Devolver */}
                  {paymentMethod === 'cash' && received >= 0 && (() => {
                    const actualChange = received - fullTotal;
                    return (
                      <AnimatePresence mode="wait">
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "py-3 px-4 rounded-2xl border transition-all flex items-center justify-between shadow-sm w-full mt-2",
                            actualChange >= 0 
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                              : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          )}
                        >
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                            {actualChange >= 0 ? "Cambio a devolver" : "Falta por Recibir"}
                          </span>
                          <span className="text-xl sm:text-2xl font-black tracking-tight flex items-baseline">
                            <span className="text-xs mr-1 opacity-70">RD$</span>
                            {Math.abs(actualChange).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </span>
                        </motion.div>
                      </AnimatePresence>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 pt-3 border-t border-white/10 flex gap-2.5 flex-shrink-0">
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-12 px-5 rounded-2xl text-zinc-400 hover:text-white hover:bg-white/5 font-bold text-xs"
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => onProcessPayment(includeDebt, splitMethod)}
              className={cn(
                "h-12 flex-1 rounded-2xl font-black text-sm uppercase tracking-wider transition-all active:scale-[0.98] shadow-lg",
                isProcessing 
                  ? "bg-zinc-800 text-zinc-500" 
                  : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-500/20"
              )}
              disabled={(paymentMethod === 'cash' && received < fullTotal) || (paymentMethod === 'split' && received <= 0) || (paymentMethod === 'split' && received >= fullTotal) || (paymentMethod === 'credit' && !selectedCustomer) || (requiresCustomer && (!selectedCustomer || !selectedCustomerData?.rnc)) || isProcessing}
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Cargando...</span>
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

