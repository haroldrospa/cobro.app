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
import BankAccountsList from './BankAccountsList';
import { useCustomerBalance } from '@/hooks/useCustomerBalance';

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
  const [customerSearch, setCustomerSearch] = useState('');
  const [localAmount, setLocalAmount] = useState(amountReceived);

  useEffect(() => {
    if (isOpen) {
      setLocalAmount(amountReceived);
    }
  }, [isOpen, amountReceived]);

  const handleAmountChange = (val: string) => {
    setLocalAmount(val);
    onAmountReceivedChange(val);
  };

  const previousDebt = selectedCustomer && selectedCustomer !== 'general' && balance ? (balance.totalDebt || 0) : 0;
  const fullTotal = total + (includeDebt ? previousDebt : 0);
  const fullTotals = {
    total: fullTotal.toFixed(2)
  };

  const currentReceived = parseFloat(localAmount) || 0;
  const currentChange = currentReceived - fullTotal;

  const selectedCustomerData = React.useMemo(() => {
    if (!selectedCustomer) return null;
    return customers.find(c => c.id === selectedCustomer) || null;
  }, [selectedCustomer, customers]);

  const selectedCustomerLabel = React.useMemo(() => {
    if (!selectedCustomer) return "Consumidor Final";
    return selectedCustomerData ? selectedCustomerData.name : "Cargando...";
  }, [selectedCustomer, selectedCustomerData]);

  const filteredCustomers = React.useMemo(() => {
    if (!customerSearch) return customers.slice(0, 30);
    const q = customerSearch.toLowerCase();
    return customers
      .filter(c => c.name?.toLowerCase().includes(q) || c.rnc?.includes(q) || c.phone?.includes(q))
      .slice(0, 30);
  }, [customers, customerSearch]);

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
      const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
      // Solo hacer auto-focus en dispositivos de escritorio (con teclado físico).
      // En tablets y móviles evita que el teclado virtual tape la ventana al abrir.
      if (!isTouchDevice) {
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
          className="max-w-[420px] w-[calc(100%-1.5rem)] sm:w-full p-0 overflow-hidden bg-card border border-border rounded-2xl shadow-2xl max-h-[calc(var(--visual-viewport-height,100dvh)-1.5rem)] sm:max-h-[calc(var(--visual-viewport-height,100dvh)-2rem)] lg:[@media(min-height:820px)_and_(pointer:fine)]:max-h-[85vh] flex flex-col [@media(max-height:580px)]:max-h-[98vh] overscroll-contain"
        >
          {/* Header & Total Area */}
          <div className="p-3.5 pb-0 flex-shrink-0">
            <DialogTitle className="sr-only">
              Cobrar
            </DialogTitle>
            
            {/* Total a Pagar Card */}
            <div className="flex flex-col items-center justify-center bg-muted/40 border border-border/80 py-3 px-3 rounded-xl relative overflow-hidden">
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest mb-1">
                Total a Pagar
              </span>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-lg font-bold text-primary">RD$</span>
                <span className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                  {parseFloat(fullTotals.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {surchargeAmount > 0 && (
                <span className="text-destructive text-[9px] font-bold uppercase tracking-wider mt-1 bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
                  + RD$ {surchargeAmount.toLocaleString()} recargo
                </span>
              )}
            </div>
          </div>

          {/* Body Section */}
          <div className="p-3.5 space-y-3 flex-1 min-h-0 flex flex-col overflow-y-auto">
            {/* Cliente */}
            <div>
              <div className="flex items-center justify-between mb-1 ml-0.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Cliente
                </label>
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => onCustomerChange?.("")}
                    className="text-[10px] font-semibold text-primary hover:underline"
                  >
                    Restablecer
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 w-full">
                <div className="flex-1 min-w-0">
                  <Popover open={openCustomerPopover} onOpenChange={setOpenCustomerPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full bg-background border-border rounded-lg text-xs font-semibold justify-between shadow-sm px-2.5 transition-all h-8 sm:h-8.5",
                          (paymentMethod === 'credit' && !selectedCustomer) || (requiresCustomer && (!selectedCustomer || !selectedCustomerData?.rnc))
                            ? "border-destructive/50 bg-destructive/5 text-destructive"
                            : "hover:bg-accent text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-1.5 overflow-hidden text-left min-w-0 flex-1">
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate text-xs font-medium">
                            {selectedCustomer ? selectedCustomerLabel : "Consumidor Final"}
                          </span>
                          {selectedCustomer && selectedCustomerData?.rnc && (
                            <span className="text-[9px] font-mono text-primary font-bold bg-primary/10 px-1 py-0.2 rounded shrink-0">
                              RNC: {selectedCustomerData.rnc}
                            </span>
                          )}
                        </div>
                        <ChevronsUpDown className="h-3 w-3 opacity-40 shrink-0 ml-1" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      side="bottom" 
                      sideOffset={6} 
                      collisionPadding={12} 
                      className="w-[calc(100vw-2.5rem)] sm:w-[320px] max-w-[340px] p-0 bg-popover border border-border rounded-xl shadow-xl z-[150] overflow-hidden" 
                      align="start"
                    >
                      <Command className="bg-transparent border-none">
                        <CommandInput 
                          placeholder="Buscar por nombre, RNC o teléfono..." 
                          value={customerSearch}
                          onValueChange={setCustomerSearch}
                          className="h-9 text-base sm:text-xs text-foreground placeholder:text-muted-foreground bg-muted/30 border-b border-border" 
                        />
                        <CommandList className="max-h-[220px] overflow-y-auto p-1 scrollbar-thin">
                          <CommandEmpty className="p-4 text-xs text-muted-foreground text-center">
                            No se encontraron clientes
                          </CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="general-consumidor-final"
                              onSelect={() => { onCustomerChange?.(""); setOpenCustomerPopover(false); setCustomerSearch(''); }}
                              className={cn(
                                "p-2 cursor-pointer rounded-lg mx-0.5 my-0.5 text-xs transition-all flex items-center justify-between",
                                !selectedCustomer ? "bg-primary/10 text-primary font-bold" : "hover:bg-accent text-foreground"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 opacity-70" />
                                <span className="truncate">Consumidor Final</span>
                              </div>
                              {!selectedCustomer && <Check className="h-4 w-4 text-primary shrink-0" />}
                            </CommandItem>

                            {filteredCustomers.map((customer) => {
                              const isSelected = selectedCustomer === customer.id;
                              return (
                                <CommandItem
                                  key={customer.id}
                                  value={`${customer.name} ${customer.rnc || ''} ${customer.phone || ''} ${customer.id}`}
                                  onSelect={() => { onCustomerChange?.(customer.id); setOpenCustomerPopover(false); setCustomerSearch(''); }}
                                  className={cn(
                                    "p-2 cursor-pointer rounded-lg mx-0.5 my-0.5 text-xs transition-all flex items-center justify-between",
                                    isSelected ? "bg-primary/10 text-primary font-bold" : "hover:bg-accent text-foreground"
                                  )}
                                >
                                  <div className="flex flex-col min-w-0 flex-1 pr-2 text-left">
                                    <span className="truncate text-xs font-semibold">{customer.name}</span>
                                    {customer.rnc && (
                                      <span className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                        RNC: {customer.rnc}
                                      </span>
                                    )}
                                  </div>
                                  {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {selectedCustomer && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 rounded-lg hover:bg-muted"
                    onClick={() => onCustomerChange?.("")}
                    title="Volver a Consumidor Final"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 sm:h-8.5 sm:w-8.5 bg-background border-border rounded-lg hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
                  onClick={() => setIsAddCustomerOpen(true)}
                  title="Nuevo cliente"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {previousDebt > 0 && (
                <div className="mt-1.5 p-1.5 px-2 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <AlertCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <div className="truncate">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-blue-500">Deuda Pendiente</p>
                      <p className="text-xs font-black text-foreground leading-none">RD$ {previousDebt.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-background px-1.5 py-0.5 rounded border border-blue-500/20 shrink-0 ml-2">
                    <label htmlFor="include-debt" className="text-[9px] font-bold uppercase text-muted-foreground cursor-pointer">Incluir</label>
                    <input
                      type="checkbox"
                      id="include-debt"
                      checked={includeDebt}
                      onChange={(e) => setIncludeDebt(e.target.checked)}
                      className="h-3 w-3 rounded-sm bg-background border-border text-primary focus:ring-0 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Método de Pago */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block ml-0.5">
                Método de Pago
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(availableMethods.length > 0 ? availableMethods.filter(m => m.enabled) : [
                  { id: 'cash', name: 'Efectivo' },
                  { id: 'card', name: 'Tarjeta' },
                  { id: 'transfer', name: 'Transferencia' },
                  { id: 'credit', name: 'Crédito' }
                ]).map((method) => {
                  const isSelected = paymentMethod === method.id;
                  return (
                    <Button
                      key={method.id}
                      variant={isSelected ? "default" : "outline"}
                      className={cn(
                        "h-8 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 min-w-[28%]",
                        isSelected 
                          ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" 
                          : "bg-background border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      onClick={() => handlePaymentMethodChange(method.id)}
                    >
                      {getMethodIcon(method.id)}
                      <span className="truncate">{method.name}</span>
                    </Button>
                  );
                })}
                <Button
                  variant={paymentMethod === 'split' ? "default" : "outline"}
                  className={cn(
                    "h-8 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 min-w-[28%]",
                    paymentMethod === 'split' 
                      ? "bg-blue-600 text-white shadow-sm hover:bg-blue-500" 
                      : "bg-background border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                  onClick={() => handlePaymentMethodChange('split')}
                >
                  <Plus className="h-3 w-3" />
                  Mixto
                </Button>
              </div>
            </div>

            {paymentMethod === 'credit' && (
              <div className="p-2.5 bg-muted/30 rounded-lg border border-border">
                <CreditInfo
                  selectedCustomer={selectedCustomer}
                  creditDays={creditDays}
                  onCreditDaysChange={onCreditDaysChange}
                />
              </div>
            )}

            {paymentMethod === 'transfer' && (
              <div className="p-2.5 bg-muted/30 rounded-xl border border-border space-y-2 animate-in fade-in slide-in-from-top-1">
                <BankAccountsList totalAmount={fullTotal} />
              </div>
            )}

            {(paymentMethod === 'cash' || paymentMethod === 'split') && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-1 flex flex-col shrink-0">
                {paymentMethod === 'split' && (
                  <div className="grid grid-cols-2 gap-2 shrink-0">
                    <div className="space-y-0.5">
                      <label className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground ml-0.5">Restante en</label>
                      <select
                        value={splitMethod}
                        onChange={e => setSplitMethod(e.target.value)}
                        className="w-full h-8 bg-background border border-border rounded-md text-base sm:text-xs font-semibold px-2 text-foreground outline-none focus:border-primary"
                      >
                        <option value="card">Tarjeta</option>
                        <option value="transfer">Transferencia</option>
                      </select>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground ml-0.5">Monto Mixto</label>
                      <div className="h-8 w-full bg-blue-500/10 border border-blue-500/20 rounded-md flex items-center px-2 font-bold text-blue-600 text-xs">
                        RD$ {Math.max(0, fullTotal - currentReceived).toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === 'split' && splitMethod === 'transfer' && (
                  <div className="p-2.5 bg-muted/30 rounded-xl border border-border space-y-2 shrink-0">
                    <BankAccountsList totalAmount={Math.max(0, fullTotal - currentReceived)} />
                  </div>
                )}

                {/* Input Monto Recibido */}
                <div className="space-y-1.5 shrink-0">
                  <div className="flex items-center justify-between px-0.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {paymentMethod === 'split' ? 'Efectivo Recibido' : 'Monto Recibido'}
                    </label>
                    {webChangeInfo && (
                      <div className="bg-amber-500/10 text-amber-600 text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest">
                        {webChangeInfo.type === 'exact' ? 'Exacto' : `+RD$ ${webChangeInfo.amount}`}
                      </div>
                    )}
                  </div>
                  
                  <div className="relative group shrink-0">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <span className="text-sm font-black text-muted-foreground/60 group-focus-within:text-emerald-500 transition-colors">RD$</span>
                    </div>
                    <Input
                      ref={amountInputRef}
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={localAmount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && ((currentReceived >= fullTotal || paymentMethod === 'split') && !isProcessing)) {
                          onProcessPayment(includeDebt, splitMethod);
                        }
                      }}
                      className="h-12 min-h-[48px] pl-14 pr-9 text-2xl font-black bg-background border-2 border-border/80 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20 rounded-xl text-foreground transition-all shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shrink-0"
                    />
                    {localAmount && (
                      <button
                        type="button"
                        onClick={() => handleAmountChange('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                        title="Borrar monto"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Botones de sugerencias / billetes rápidos */}
                  {paymentMethod === 'cash' && (
                    <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto py-0.5 scrollbar-none">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-8 px-2.5 rounded-lg border text-xs font-bold transition-all shrink-0",
                          currentReceived === fullTotal
                            ? "bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black shadow-xs"
                            : "border-border/70 bg-background hover:bg-muted text-muted-foreground"
                        )}
                        onClick={() => handleAmountChange(fullTotal.toString())}
                      >
                        Exacto
                      </Button>
                      {suggestedAmounts.map(amt => (
                        <Button
                          key={amt}
                          type="button"
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-8 px-2.5 rounded-lg border text-xs font-bold transition-all tabular-nums shrink-0",
                            currentReceived === amt
                              ? "bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black shadow-xs"
                              : "border-border/70 bg-background hover:bg-muted text-foreground"
                          )}
                          onClick={() => handleAmountChange(amt.toString())}
                        >
                          RD$ {amt.toLocaleString()}
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* Tarjeta Destacada de Devolver / Cambio */}
                  {paymentMethod === 'cash' && (
                    <div className="shrink-0 pt-1">
                      {currentReceived > fullTotal ? (
                        <div className="p-3 rounded-2xl bg-emerald-500/15 dark:bg-emerald-950/40 border-2 border-emerald-500/40 dark:border-emerald-500/50 shadow-sm flex items-center justify-between transition-all">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <Banknote className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block leading-tight">
                                Cambio a Devolver
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Entregar al cliente
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mr-1">RD$</span>
                            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">
                              {currentChange.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      ) : currentReceived === fullTotal ? (
                        <div className="py-2.5 px-3 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between text-xs transition-all">
                          <div className="flex items-center gap-2 text-muted-foreground font-semibold">
                            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span>Pago Completo (Exacto)</span>
                          </div>
                          <span className="font-bold text-muted-foreground tabular-nums">
                            Sin cambio (RD$ 0.00)
                          </span>
                        </div>
                      ) : (
                        <div className="py-2.5 px-3 rounded-xl bg-amber-500/15 dark:bg-amber-950/40 border border-amber-500/30 flex items-center justify-between text-xs transition-all">
                          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span className="text-[10px] uppercase tracking-wider">Falta por recibir:</span>
                          </div>
                          <div className="text-right font-black text-base text-amber-700 dark:text-amber-400 tabular-nums">
                            <span className="text-xs mr-0.5">RD$</span>
                            {(fullTotal - currentReceived).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 p-3.5 border-t border-border bg-card flex-shrink-0">
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-10 px-4 rounded-lg text-muted-foreground font-bold hover:bg-muted"
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => onProcessPayment(includeDebt, splitMethod)}
              className={cn(
                "h-10 flex-1 rounded-lg font-bold text-sm shadow-md uppercase tracking-wider",
                isProcessing ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              disabled={(paymentMethod === 'cash' && currentReceived < fullTotal) || (paymentMethod === 'split' && currentReceived <= 0) || (paymentMethod === 'split' && currentReceived >= fullTotal) || (paymentMethod === 'credit' && !selectedCustomer) || (requiresCustomer && (!selectedCustomer || !selectedCustomerData?.rnc)) || isProcessing}
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Cargando...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4" />
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

export default React.memo(PaymentDialog);

