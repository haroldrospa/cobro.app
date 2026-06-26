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

  const selectedCustomerLabel = customers.find(c => c.id === selectedCustomer)?.name || "Consumidor Final";
  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);

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
        <DialogContent className="max-w-[420px] w-[calc(100%-1.5rem)] sm:w-full p-0 overflow-hidden bg-background border border-border/40 rounded-2xl shadow-2xl max-h-[95dvh] sm:max-h-[90vh] flex flex-col [@media(max-height:580px)]:max-h-[98dvh]">
          {/* Header & Total Area - Hyper Compact */}
          <div className="bg-gradient-to-b from-primary/10 to-transparent p-3 pb-0 border-b border-border/10 flex-shrink-0 [@media(max-height:580px)]:pb-2 [@media(max-height:580px)]:pt-2">
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-2">
                <div className="bg-primary/20 p-1.5 rounded-full [@media(max-height:580px)]:p-1">
                  <DollarSign className="h-4 w-4 text-primary [@media(max-height:580px)]:h-3.5 [@media(max-height:580px)]:w-3.5" />
                </div>
                <DialogTitle className="text-base font-bold tracking-tight text-foreground flex items-center gap-2 [@media(max-height:580px)]:text-sm">
                  Cobrar
                  <span className="hidden [@media(max-height:580px)]:inline-block text-xs font-normal text-muted-foreground">| Total:</span>
                  <span className="hidden [@media(max-height:580px)]:inline-block text-lg font-black text-primary tracking-tight">
                    RD$ {parseFloat(fullTotals.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </DialogTitle>
              </div>
            </div>
            
            <div className="mt-2 flex flex-col items-center justify-center bg-card border-x border-b border-t-2 border-border/50 border-t-primary py-3 px-3 rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] shadow-primary/5 relative overflow-hidden [@media(max-height:580px)]:hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
              <span className="text-muted-foreground text-[9px] uppercase font-bold tracking-widest relative mb-1">Total a Pagar</span>
              <div className="flex flex-col items-center relative">
                <span className="text-4xl font-black text-foreground tracking-tighter flex items-center leading-none">
                  <span className="text-lg text-primary mr-1.5 opacity-80">RD$</span>
                  {parseFloat(fullTotals.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
                {surchargeAmount > 0 && (
                  <span className="text-destructive text-[8px] font-bold uppercase tracking-wider mt-1 bg-destructive/10 px-2 py-0.5 rounded-full">
                    + {surchargeAmount.toLocaleString()} recargo
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-3 space-y-3 flex-1 min-h-0 flex flex-col overflow-y-auto [@media(max-height:580px)]:p-2.5 [@media(max-height:580px)]:space-y-1.5">
            {/* Customer Section */}
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block ml-1 [@media(max-height:580px)]:hidden">Cliente</label>
              <div className="flex gap-2">
                <Popover open={openCustomerPopover} onOpenChange={setOpenCustomerPopover}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full bg-card border-border/50 rounded-lg text-sm font-semibold justify-between shadow-sm px-3 transition-all",
                        selectedCustomerData?.rnc ? "h-11 py-1 [@media(max-height:580px)]:h-8 [@media(max-height:580px)]:py-0.5" : "h-9 [@media(max-height:580px)]:h-8",
                        (paymentMethod === 'credit' && !selectedCustomer) || (requiresCustomer && (!selectedCustomer || !selectedCustomerData?.rnc))
                          ? "border-destructive/50 ring-1 ring-destructive/20 bg-destructive/5 hover:bg-destructive/10"
                          : "hover:bg-accent/50"
                      )}
                    >
                      <div className="flex items-center gap-2 overflow-hidden text-left">
                        <User className={cn(
                          "h-3.5 w-3.5 flex-shrink-0 [@media(max-height:580px)]:h-3 [@media(max-height:580px)]:w-3",
                          requiresCustomer && (!selectedCustomer || !selectedCustomerData?.rnc) ? "text-destructive" : "text-muted-foreground"
                        )} />
                        <div className="flex flex-col items-start leading-none overflow-hidden">
                          <span className="truncate text-xs font-semibold text-foreground [@media(max-height:580px)]:text-[11px]">
                            {selectedCustomer ? selectedCustomerLabel : "Consumidor Final"}
                          </span>
                          {selectedCustomer && selectedCustomerData?.rnc && (
                            <span className="text-[9px] font-mono text-primary font-bold mt-0.5 [@media(max-height:580px)]:text-[8px] [@media(max-height:580px)]:mt-0">
                              RNC: {selectedCustomerData.rnc}
                            </span>
                          )}
                          {requiresCustomer && selectedCustomer && !selectedCustomerData?.rnc && (
                            <span className="text-[8px] text-destructive font-black uppercase tracking-wider mt-0.5 animate-pulse [@media(max-height:580px)]:mt-0 [@media(max-height:580px)]:text-[7px]">
                              ⚠️ Requiere RNC
                            </span>
                          )}
                          {requiresCustomer && !selectedCustomer && (
                            <span className="text-[8px] text-destructive font-black uppercase tracking-wider mt-0.5 animate-pulse [@media(max-height:580px)]:mt-0 [@media(max-height:580px)]:text-[7px]">
                              ⚠️ Cliente Requerido
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-30 flex-shrink-0 [@media(max-height:580px)]:h-3 [@media(max-height:580px)]:w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0 bg-popover border-border rounded-xl shadow-lg" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." className="h-8 text-xs" />
                      <CommandList className="max-h-[160px]">
                        <CommandEmpty className="p-2 text-xs text-muted-foreground font-bold uppercase tracking-widest text-center">No encontrado</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="general-consumidor-final"
                            onSelect={() => { onCustomerChange?.(""); setOpenCustomerPopover(false); }}
                            className="p-1.5 cursor-pointer rounded-lg mx-1 my-0.5 text-xs"
                          >
                            <Check className={cn("mr-2 h-3.5 w-3.5 text-primary", !selectedCustomer ? "opacity-100" : "opacity-0")} />
                            <span className="font-semibold">Consumidor Final</span>
                          </CommandItem>
                          {customers.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={`${customer.name} ${customer.rnc || ''} ${customer.phone || ''} ${customer.id}`}
                              onSelect={() => { onCustomerChange?.(customer.id); setOpenCustomerPopover(false); }}
                              className="p-1.5 cursor-pointer rounded-lg mx-1 my-0.5 text-xs"
                            >
                              <Check className={cn("mr-2 h-3.5 w-3.5 text-primary", selectedCustomer === customer.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="font-semibold truncate">{customer.name}</span>
                                {customer.rnc && <span className="text-[8px] text-muted-foreground">RNC: {customer.rnc}</span>}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 bg-card border-border/50 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors flex-shrink-0 [@media(max-height:580px)]:h-8 [@media(max-height:580px)]:w-8"
                  onClick={() => setIsAddCustomerOpen(true)}
                >
                  <Plus className="h-4 w-4 [@media(max-height:580px)]:h-3.5 [@media(max-height:580px)]:w-3.5" />
                </Button>
              </div>

              {requiresCustomer && (
                <div className={cn(
                  "mt-1.5 p-2 rounded-lg border text-[10px] flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-200 [@media(max-height:580px)]:mt-1 [@media(max-height:580px)]:p-1 [@media(max-height:580px)]:text-[9px]",
                  !selectedCustomer || !selectedCustomerData?.rnc
                    ? "bg-destructive/10 border-destructive/20 text-destructive-foreground"
                    : "bg-primary/5 border-primary/20 text-foreground"
                )}>
                  {!selectedCustomer ? (
                    <div className="flex items-start gap-1.5 [@media(max-height:580px)]:items-center">
                      <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5 [@media(max-height:580px)]:mt-0 [@media(max-height:580px)]:h-3 [@media(max-height:580px)]:w-3" />
                      <div>
                        <p className="font-bold uppercase tracking-wider text-[8px] text-destructive">Crédito Fiscal Electrónico (E31)</p>
                        <p className="text-muted-foreground [@media(max-height:580px)]:hidden">Debe seleccionar un cliente registrado con su RNC para poder facturar Crédito Fiscal.</p>
                      </div>
                    </div>
                  ) : !selectedCustomerData?.rnc ? (
                    <div className="flex items-start gap-1.5 [@media(max-height:580px)]:items-center">
                      <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5 [@media(max-height:580px)]:mt-0 [@media(max-height:580px)]:h-3 [@media(max-height:580px)]:w-3" />
                      <div>
                        <p className="font-bold uppercase tracking-wider text-[8px] text-destructive">RNC Faltante</p>
                        <p className="text-muted-foreground [@media(max-height:580px)]:hidden">El cliente <strong className="text-foreground">{selectedCustomerData.name}</strong> no tiene un RNC. Para Crédito Fiscal, el RNC es obligatorio.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-primary flex-shrink-0 [@media(max-height:580px)]:h-3 [@media(max-height:580px)]:w-3" />
                      <div>
                        <p className="font-bold uppercase tracking-wider text-[8px] text-primary">Datos Correctos</p>
                        <p className="text-muted-foreground [@media(max-height:580px)]:hidden">Cliente <strong className="text-foreground">{selectedCustomerData.name}</strong> con RNC <strong className="text-primary font-mono">{selectedCustomerData.rnc}</strong> listo.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {previousDebt > 0 && (
                <div className="mt-1.5 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-between [@media(max-height:580px)]:mt-1 [@media(max-height:580px)]:p-1 [@media(max-height:580px)]:py-0.5">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-blue-500 flex-shrink-0 [@media(max-height:580px)]:h-3 [@media(max-height:580px)]:w-3" />
                    <div>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-blue-500/90 [@media(max-height:580px)]:hidden">Deuda Pendiente</p>
                      <p className="text-xs font-black text-foreground leading-none [@media(max-height:580px)]:text-[10px]">RD$ {previousDebt.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-background/50 px-1.5 py-0.5 rounded border border-blue-500/20 [@media(max-height:580px)]:px-1 [@media(max-height:580px)]:py-0">
                    <label htmlFor="include-debt" className="text-[8px] font-bold uppercase text-muted-foreground cursor-pointer [@media(max-height:580px)]:text-[7px]">Incluir</label>
                    <input
                      type="checkbox"
                      id="include-debt"
                      checked={includeDebt}
                      onChange={(e) => setIncludeDebt(e.target.checked)}
                      className="h-3 w-3 rounded-sm bg-background border-border text-primary focus:ring-0 cursor-pointer [@media(max-height:580px)]:h-2.5 [@media(max-height:580px)]:w-2.5"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Payment Methods */}
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block ml-1 [@media(max-height:580px)]:hidden">Método</label>
              <div className="flex flex-wrap gap-1.5 [@media(max-height:580px)]:gap-1">
                {(availableMethods.length > 0 ? availableMethods.filter(m => m.enabled) : [
                  { id: 'cash', name: 'Efectivo' },
                  { id: 'card', name: 'Tarjeta' },
                  { id: 'transfer', name: 'Banco' },
                  { id: 'credit', name: 'Crédito' }
                ]).map((method) => (
                   <Button
                    key={method.id}
                    variant={paymentMethod === method.id ? "default" : "outline"}
                    className={cn(
                      "h-8 px-2 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1 flex-1 min-w-[28%] [@media(max-height:580px)]:h-7 [@media(max-height:580px)]:text-[9px]",
                      paymentMethod === method.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border-border/50 text-muted-foreground hover:bg-muted"
                    )}
                    onClick={() => handlePaymentMethodChange(method.id)}
                  >
                    {getMethodIcon(method.id)}
                    <span className="truncate">{method.name}</span>
                  </Button>
                ))}
                <Button
                  variant={paymentMethod === 'split' ? "default" : "outline"}
                  className={cn(
                    "h-8 px-2 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1 flex-1 min-w-[28%] [@media(max-height:580px)]:h-7 [@media(max-height:580px)]:text-[9px]",
                    paymentMethod === 'split' ? "bg-blue-600 text-white shadow-sm" : "bg-card border-border/50 text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => handlePaymentMethodChange('split')}
                >
                  <Plus className="h-3 w-3" />
                  Mixto
                </Button>
              </div>
            </div>

            {paymentMethod === 'credit' && (
              <div className="p-2 bg-muted/30 rounded-lg border border-border/50 [@media(max-height:580px)]:p-1 [@media(max-height:580px)]:p-1.5">
                <CreditInfo
                  selectedCustomer={selectedCustomer}
                  creditDays={creditDays}
                  onCreditDaysChange={onCreditDaysChange}
                />
              </div>
            )}

            {(paymentMethod === 'cash' || paymentMethod === 'split') && (
              <div className="space-y-2.5 animate-in fade-in slide-in-from-top-1 flex flex-col justify-end flex-1 [@media(max-height:580px)]:space-y-1.5">
                {paymentMethod === 'split' && (
                  <div className="grid grid-cols-2 gap-2 [@media(max-height:580px)]:gap-1.5">
                    <div className="space-y-0.5">
                      <label className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground ml-1 [@media(max-height:580px)]:hidden">Restante en</label>
                      <select
                        value={splitMethod}
                        onChange={e => setSplitMethod(e.target.value)}
                        className="w-full h-8 bg-card border border-border/50 rounded-md text-xs font-semibold px-2 outline-none focus:border-primary/50 [@media(max-height:580px)]:h-7"
                      >
                        <option value="card">Tarjeta</option>
                        <option value="transfer">Transferencia</option>
                      </select>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground ml-1 [@media(max-height:580px)]:hidden">Monto Mixto</label>
                      <div className="h-8 w-full bg-blue-500/10 border border-blue-500/20 rounded-md flex items-center px-2 font-bold text-blue-600 text-xs [@media(max-height:580px)]:h-7">
                        RD$ {Math.max(0, fullTotal - received).toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 [@media(max-height:580px)]:space-y-1">
                  <div className="flex items-center justify-between px-1 [@media(max-height:580px)]:hidden">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                      {paymentMethod === 'split' ? 'Efe. recibido' : 'Monto Recibido'}
                    </label>
                    {webChangeInfo && (
                      <div className="bg-orange-500/10 text-orange-600 text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                        {webChangeInfo.type === 'exact' ? 'Exacto' : `+RD$ ${webChangeInfo.amount}`}
                      </div>
                    )}
                  </div>
                  
                  <div className="relative group mt-1 [@media(max-height:580px)]:mt-0">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none [@media(max-height:580px)]:pl-2.5">
                      <span className="text-sm font-black text-muted-foreground/50 group-focus-within:text-primary transition-colors [@media(max-height:580px)]:text-xs [@media(max-height:580px)]:font-bold">RD$</span>
                    </div>
                    <Input
                      ref={amountInputRef}
                      type="number"
                      placeholder="0.00"
                      value={amountReceived}
                      onChange={(e) => onAmountReceivedChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && ((received >= fullTotal || paymentMethod === 'split') && !isProcessing)) {
                          onProcessPayment(includeDebt, splitMethod);
                        }
                      }}
                      className="h-12 pl-12 text-2xl font-black bg-muted/20 border-2 border-border/40 focus-visible:bg-background focus-visible:border-primary/50 focus-visible:ring-0 rounded-xl transition-all shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [@media(max-height:580px)]:h-9 [@media(max-height:580px)]:pl-11 [@media(max-height:580px)]:text-lg [@media(max-height:580px)]:font-black [@media(max-height:580px)]:rounded-lg"
                    />
                  </div>

                  {paymentMethod === 'cash' && (
                    <div className="flex flex-wrap gap-1.5 justify-center [@media(max-height:580px)]:hidden">
                       <Button
                        variant="outline"
                        className="h-7 px-2 rounded border-border/50 bg-card hover:bg-muted text-[9px] font-bold uppercase flex-1 min-w-[15%]"
                        onClick={() => onAmountReceivedChange(fullTotal.toString())}
                      >
                        Exacto
                      </Button>
                      {suggestedAmounts.map(amt => (
                        <Button
                          key={amt}
                          variant="outline"
                          className="h-7 px-2 rounded border-border/50 bg-card hover:bg-muted text-[9px] font-bold uppercase flex-1 min-w-[15%]"
                          onClick={() => onAmountReceivedChange(amt.toString())}
                        >
                           {amt}
                        </Button>
                      ))}
                    </div>
                  )}

                  {paymentMethod === 'cash' && received >= 0 && (() => {
                    const actualChange = received - fullTotal;
                    return (
                      <AnimatePresence mode="wait">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={cn(
                            "py-2.5 px-3 rounded-lg border transition-all flex flex-col items-center justify-center shadow-sm w-full",
                            "[@media(max-height:580px)]:flex-row [@media(max-height:580px)]:justify-between [@media(max-height:580px)]:py-1 [@media(max-height:580px)]:px-2.5 [@media(max-height:580px)]:rounded-md",
                            actualChange >= 0 ? "bg-primary/10 border-primary/20" : "bg-card border-border/50"
                          )}
                        >
                          <span className={cn(
                            "text-[9px] font-bold uppercase tracking-widest mb-0.5",
                            "[@media(max-height:580px)]:mb-0 [@media(max-height:580px)]:text-[8px]",
                            actualChange >= 0 ? "text-primary/70" : "text-muted-foreground"
                          )}>
                            {actualChange >= 0 ? "Cambio a devolver" : "Falta por Recibir"}
                          </span>
                          <span className={cn(
                            "text-2xl font-black tracking-tighter flex items-center leading-none",
                            "[@media(max-height:580px)]:text-base [@media(max-height:580px)]:font-black",
                            actualChange >= 0 ? "text-primary" : "text-muted-foreground/50"
                          )}>
                            <span className="text-xs mr-1 text-inherit [@media(max-height:580px)]:text-[10px] [@media(max-height:580px)]:mr-0.5">RD$</span>
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

          {/* Actions */}
          <div className="flex gap-2 p-3 border-t border-border/10 bg-background flex-shrink-0 [@media(max-height:580px)]:p-2 [@media(max-height:580px)]:gap-1.5">
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-10 px-4 rounded-lg text-muted-foreground font-bold hover:bg-muted [@media(max-height:580px)]:h-8 [@media(max-height:580px)]:px-3 [@media(max-height:580px)]:text-xs"
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => onProcessPayment(includeDebt, splitMethod)}
              className={cn(
                "h-10 flex-1 rounded-lg font-bold text-sm shadow-md uppercase tracking-wide [@media(max-height:580px)]:h-8 [@media(max-height:580px)]:text-xs",
                isProcessing ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              disabled={(paymentMethod === 'cash' && received < fullTotal) || (paymentMethod === 'split' && received <= 0) || (paymentMethod === 'split' && received >= fullTotal) || (paymentMethod === 'credit' && !selectedCustomer) || (requiresCustomer && (!selectedCustomer || !selectedCustomerData?.rnc)) || isProcessing}
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin [@media(max-height:580px)]:h-3.5 [@media(max-height:580px)]:w-3.5" />
                  <span>Cargando...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4 [@media(max-height:580px)]:h-3.5 [@media(max-height:580px)]:w-3.5" />
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

