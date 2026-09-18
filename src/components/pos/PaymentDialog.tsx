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
      case 'cash': return <Wallet className="h-3.5 w-3.5" />;
      case 'card': return <CreditCard className="h-3.5 w-3.5" />;
      case 'transfer': case 'bank': return <ArrowRightLeft className="h-3.5 w-3.5" />;
      case 'check': case 'cheque': return <FileText className="h-3.5 w-3.5" />;
      case 'credit': return <Banknote className="h-3.5 w-3.5" />;
      case 'split': return <Plus className="h-3.5 w-3.5" />;
      default: return <CreditCard className="h-3.5 w-3.5" />;
    }
  };

  const paymentMethodsList = React.useMemo(() => {
    const list = availableMethods.length > 0
      ? availableMethods.filter(m => m.enabled)
      : [
          { id: 'cash', name: 'Efectivo' },
          { id: 'card', name: 'Tarjeta' },
          { id: 'transfer', name: 'Transferencia' },
          { id: 'credit', name: 'Crédito' }
        ];
    return [...list, { id: 'split', name: 'Mixto' }];
  }, [availableMethods]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          className="max-w-[420px] w-[calc(100%-1rem)] sm:w-full p-0 overflow-hidden bg-card border border-border rounded-2xl shadow-2xl max-h-[calc(var(--visual-viewport-height,100dvh)-1rem)] sm:max-h-[calc(var(--visual-viewport-height,100dvh)-2rem)] flex flex-col overscroll-contain"
        >
          {/* Header & Total Area Compact */}
          <div className="p-2.5 sm:p-3 pb-0 flex-shrink-0">
            <DialogTitle className="sr-only">
              Cobrar
            </DialogTitle>
            
            {/* Total a Pagar Compact Row */}
            <div className="flex items-center justify-between bg-muted/40 border border-border/80 px-3 py-1.5 sm:py-2 rounded-xl relative overflow-hidden">
              <div>
                <span className="text-muted-foreground text-[9px] uppercase font-bold tracking-wider block leading-tight">
                  Total a Pagar
                </span>
                {surchargeAmount > 0 && (
                  <span className="text-destructive text-[8px] font-bold uppercase tracking-wider mt-0.5 inline-block">
                    + RD$ {surchargeAmount.toLocaleString()} recargo
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xs sm:text-sm font-bold text-primary">RD$</span>
                <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                  {parseFloat(fullTotals.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Body Section */}
          <div className="p-2.5 sm:p-3 space-y-2 sm:space-y-2.5 flex-1 min-h-0 flex flex-col overflow-y-auto">
            {/* Cliente */}
            <div className="shrink-0">
              <div className="flex items-center justify-between mb-0.5 ml-0.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Cliente
                </label>
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => onCustomerChange?.("")}
                    className="text-[9px] font-semibold text-primary hover:underline"
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
                          "w-full bg-background border-border rounded-lg text-xs font-semibold justify-between shadow-xs px-2.5 transition-all h-8",
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
                  className="h-8 w-8 bg-background border-border rounded-lg hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
                  onClick={() => setIsAddCustomerOpen(true)}
                  title="Nuevo cliente"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {previousDebt > 0 && (
                <div className="mt-1 p-1 px-2 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <AlertCircle className="h-3 w-3 text-blue-500 shrink-0" />
                    <div className="flex items-baseline gap-1.5 truncate">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-blue-500">Deuda:</span>
                      <span className="text-[11px] font-black text-foreground leading-none">RD$ {previousDebt.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-background px-1.5 py-0.5 rounded border border-blue-500/20 shrink-0 ml-2">
                    <label htmlFor="include-debt" className="text-[8px] font-bold uppercase text-muted-foreground cursor-pointer">Incluir</label>
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

            {/* Método de Pago en 1 Sola Fila */}
            <div className="shrink-0">
              <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block ml-0.5">
                Método de Pago
              </label>
              <div className="flex gap-1 w-full">
                {paymentMethodsList.map((method) => {
                  const isSelected = paymentMethod === method.id;
                  const shortName = method.id === 'transfer' ? 'Transf.' : method.name;
                  return (
                    <Button
                      key={method.id}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className={cn(
                        "h-8 sm:h-8.5 px-0.5 sm:px-1 rounded-lg transition-all flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 flex-1 min-w-0 font-bold",
                        isSelected 
                          ? (method.id === 'split' 
                              ? "bg-blue-600 text-white shadow-xs hover:bg-blue-500" 
                              : "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90")
                          : "bg-background border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      onClick={() => handlePaymentMethodChange(method.id)}
                    >
                      <span className="shrink-0">{getMethodIcon(method.id)}</span>
                      <span className="text-[9px] sm:text-[10.5px] leading-none truncate">{shortName}</span>
                    </Button>
                  );
                })}
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
                <div className="space-y-1 sm:space-y-1.5 shrink-0">
                  <div className="flex items-center justify-between px-0.5">
                    <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {paymentMethod === 'split' ? 'Efectivo Recibido' : 'Monto Recibido'}
                    </label>
                    {webChangeInfo && (
                      <div className="bg-amber-500/10 text-amber-600 text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest">
                        {webChangeInfo.type === 'exact' ? 'Exacto' : `+RD$ ${webChangeInfo.amount}`}
                      </div>
                    )}
                  </div>
                  
                  <div className="relative group shrink-0">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-xs font-black text-muted-foreground/60 group-focus-within:text-emerald-500 transition-colors">RD$</span>
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
                      className="h-10 min-h-[40px] pl-11 pr-8 text-xl font-black bg-background border border-border/80 focus-visible:border-emerald-500 focus-visible:ring-1 focus-visible:ring-emerald-500/20 rounded-xl text-foreground transition-all shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shrink-0"
                    />
                    {localAmount && (
                      <button
                        type="button"
                        onClick={() => handleAmountChange('')}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                        title="Borrar monto"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Botones de sugerencias / billetes rápidos */}
                  {paymentMethod === 'cash' && (
                    <div className="flex items-center gap-1 shrink-0 overflow-x-auto py-0.5 scrollbar-none">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-7 px-2 rounded-lg border text-[11px] font-bold transition-all shrink-0",
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
                            "h-7 px-2 rounded-lg border text-[11px] font-bold transition-all tabular-nums shrink-0",
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

                  {/* Tarjeta Destacada de Devolver / Cambio Compacta */}
                  {paymentMethod === 'cash' && (
                    <div className="shrink-0">
                      {currentReceived > fullTotal ? (
                        <div className="py-2 px-2.5 rounded-xl bg-emerald-500/15 dark:bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between shadow-xs transition-all">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <Banknote className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block leading-tight">
                                Cambio a Devolver
                              </span>
                              <span className="text-[9px] text-muted-foreground leading-none block">
                                Entregar al cliente
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mr-1">RD$</span>
                            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">
                              {currentChange.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      ) : currentReceived === fullTotal ? (
                        <div className="py-2 px-2.5 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between text-xs transition-all">
                          <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Pago Completo (Exacto)</span>
                          </div>
                          <span className="text-xs font-bold text-muted-foreground tabular-nums">
                            RD$ 0.00
                          </span>
                        </div>
                      ) : (
                        <div className="py-2 px-2.5 rounded-xl bg-amber-500/15 dark:bg-amber-950/40 border border-amber-500/30 flex items-center justify-between text-xs transition-all">
                          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-[9px] uppercase tracking-wider">Falta por recibir:</span>
                          </div>
                          <div className="text-right font-black text-sm text-amber-700 dark:text-amber-400 tabular-nums">
                            <span className="text-[10px] mr-0.5">RD$</span>
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

          {/* Actions Compact */}
          <div className="flex gap-2 p-2.5 sm:p-3 border-t border-border bg-card flex-shrink-0">
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-9 sm:h-10 px-3 sm:px-4 rounded-lg text-xs sm:text-sm text-muted-foreground font-bold hover:bg-muted"
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => onProcessPayment(includeDebt, splitMethod)}
              className={cn(
                "h-9 sm:h-10 flex-1 rounded-lg font-bold text-xs sm:text-sm shadow-md uppercase tracking-wider",
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

