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

  // Auto-focus amount input on desktop devices
  useEffect(() => {
    if (isOpen && (paymentMethod === 'cash' || paymentMethod === 'split')) {
      const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
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

  const canProcess = 
    !isProcessing &&
    !(paymentMethod === 'cash' && currentReceived < fullTotal) &&
    !(paymentMethod === 'split' && currentReceived <= 0) &&
    !(paymentMethod === 'split' && currentReceived >= fullTotal) &&
    !(paymentMethod === 'credit' && !selectedCustomer) &&
    !(requiresCustomer && (!selectedCustomer || !selectedCustomerData?.rnc));

  // Global Enter shortcut for PC POS experience
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const activeTag = (document.activeElement as HTMLElement)?.tagName;
        // If user is inside a command search input, let it search
        if (activeTag === 'INPUT' && (document.activeElement as HTMLInputElement).placeholder?.includes('Buscar')) {
          return;
        }

        if (canProcess) {
          e.preventDefault();
          onProcessPayment(includeDebt, splitMethod);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, canProcess, includeDebt, splitMethod, onProcessPayment]);

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
      case 'split': return <Plus className="h-4 w-4" />;
      default: return <CreditCard className="h-4 w-4" />;
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
          className="max-w-[460px] sm:max-w-[560px] md:max-w-[620px] mobile-landscape:max-w-[720px] w-[calc(100%-1.25rem)] sm:w-full p-0 overflow-hidden bg-card border border-border/80 rounded-2xl shadow-2xl max-h-[calc(var(--visual-viewport-height,100dvh)-1.25rem)] flex flex-col overscroll-contain"
        >
          {/* Header: Hero Total Centrado y Destacado */}
          <div className="p-3 sm:p-4 pb-0 flex-shrink-0">
            <DialogTitle className="sr-only">Cobrar Venta</DialogTitle>
            
            <div className="flex flex-col items-center justify-center bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/15 dark:via-emerald-950/20 border border-emerald-500/25 px-4 py-2.5 sm:py-3.5 rounded-2xl text-center relative overflow-hidden shadow-xs">
              <span className="text-muted-foreground text-[10px] sm:text-xs uppercase font-bold tracking-widest block leading-tight">
                Total a Pagar
              </span>
              <div className="flex items-baseline justify-center gap-1.5 mt-0.5">
                <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">RD$</span>
                <span className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight tabular-nums">
                  {parseFloat(fullTotals.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {surchargeAmount > 0 && (
                <span className="text-destructive text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-0.5 inline-block">
                  + RD$ {surchargeAmount.toLocaleString()} recargo
                </span>
              )}
            </div>
          </div>

          {/* Body Section */}
          <div className="p-3 sm:p-4 pt-2.5 sm:pt-3 space-y-3 flex-1 min-h-0 flex flex-col overflow-y-auto">
            {/* Contenedor adaptativo: 1 columna en PC y móvil vertical / 2 columnas solo en teléfonos horizontales pequeños */}
            <div className="space-y-3 mobile-landscape:grid mobile-landscape:grid-cols-2 mobile-landscape:gap-3 mobile-landscape:space-y-0 items-start">
              {/* Sección Izquierda en mobile-landscape / Superior en PC y móvil vertical */}
              <div className="space-y-3 flex flex-col">
                {/* Selector de Cliente */}
                <div className="shrink-0 space-y-1">
                  <div className="flex items-center justify-between px-0.5">
                    <label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span>Cliente</span>
                    </label>
                    {selectedCustomer && (
                      <button
                        type="button"
                        onClick={() => onCustomerChange?.("")}
                        className="text-[10px] sm:text-[11px] font-bold text-primary hover:underline"
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
                              "w-full bg-background border-border/80 rounded-xl text-xs sm:text-sm font-semibold justify-between shadow-xs px-3 transition-all h-9 sm:h-10",
                              (paymentMethod === 'credit' && !selectedCustomer) || (requiresCustomer && (!selectedCustomer || !selectedCustomerData?.rnc))
                                ? "border-destructive/50 bg-destructive/5 text-destructive"
                                : "hover:bg-accent text-foreground"
                            )}
                          >
                            <div className="flex items-center gap-2 overflow-hidden text-left min-w-0 flex-1">
                              <User className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="truncate text-xs sm:text-sm font-medium">
                                {selectedCustomer ? selectedCustomerLabel : "Consumidor Final"}
                              </span>
                              {selectedCustomer && selectedCustomerData?.rnc && (
                                <span className="text-[10px] font-mono text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded-md shrink-0">
                                  RNC: {selectedCustomerData.rnc}
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
                          className="w-[calc(100vw-2.5rem)] sm:w-[360px] max-w-[400px] p-0 bg-popover border border-border rounded-xl shadow-xl z-[150] overflow-hidden" 
                          align="start"
                        >
                          <Command className="bg-transparent border-none">
                            <CommandInput 
                              placeholder="Buscar por nombre, RNC o teléfono..." 
                              value={customerSearch}
                              onValueChange={setCustomerSearch}
                              className="h-10 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground bg-muted/30 border-b border-border" 
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
                                    "p-2.5 cursor-pointer rounded-lg mx-0.5 my-0.5 text-xs sm:text-sm transition-all flex items-center justify-between",
                                    !selectedCustomer ? "bg-primary/10 text-primary font-bold" : "hover:bg-accent text-foreground"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 opacity-70" />
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
                                        "p-2.5 cursor-pointer rounded-lg mx-0.5 my-0.5 text-xs sm:text-sm transition-all flex items-center justify-between",
                                        isSelected ? "bg-primary/10 text-primary font-bold" : "hover:bg-accent text-foreground"
                                      )}
                                    >
                                      <div className="flex flex-col min-w-0 flex-1 pr-2 text-left">
                                        <span className="truncate text-xs sm:text-sm font-semibold">{customer.name}</span>
                                        {customer.rnc && (
                                          <span className="text-[11px] font-mono text-muted-foreground mt-0.5">
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
                        className="h-9 w-9 sm:h-10 sm:w-10 text-muted-foreground hover:text-foreground shrink-0 rounded-xl hover:bg-muted"
                        onClick={() => onCustomerChange?.("")}
                        title="Volver a Consumidor Final"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 sm:h-10 sm:w-10 bg-background border-border/80 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
                      onClick={() => setIsAddCustomerOpen(true)}
                      title="Nuevo cliente"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {previousDebt > 0 && (
                    <div className="mt-1.5 p-2 px-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <div className="flex items-baseline gap-1.5 truncate">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500">Deuda previa:</span>
                          <span className="text-xs font-black text-foreground leading-none">RD$ {previousDebt.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 bg-background px-2 py-0.5 rounded-lg border border-blue-500/20 shrink-0 ml-2">
                        <label htmlFor="include-debt" className="text-[9px] font-bold uppercase text-muted-foreground cursor-pointer">Incluir</label>
                        <input
                          type="checkbox"
                          id="include-debt"
                          checked={includeDebt}
                          onChange={(e) => setIncludeDebt(e.target.checked)}
                          className="h-3.5 w-3.5 rounded bg-background border-border text-primary focus:ring-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Selector de Método de Pago */}
                <div className="shrink-0 space-y-1">
                  <label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground block px-0.5">
                    Método de Pago
                  </label>
                  <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full">
                    {paymentMethodsList.map((method) => {
                      const isSelected = paymentMethod === method.id;
                      const displayName = method.id === 'transfer' ? 'Transf.' : method.name;
                      return (
                        <Button
                          key={method.id}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          className={cn(
                            "h-9 sm:h-10 px-1 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 min-w-0 font-bold shadow-xs",
                            isSelected 
                              ? (method.id === 'split' 
                                  ? "bg-blue-600 text-white shadow-md hover:bg-blue-500" 
                                  : "bg-primary text-primary-foreground shadow-md hover:bg-primary/90")
                              : "bg-background border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground"
                          )}
                          onClick={() => handlePaymentMethodChange(method.id)}
                        >
                          <span className="shrink-0">{getMethodIcon(method.id)}</span>
                          <span className="text-[10px] sm:text-xs leading-none whitespace-nowrap">{displayName}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* En modo mobile-landscape: CreditInfo y BankAccountsList */}
                <div className="hidden mobile-landscape:block space-y-2">
                  {paymentMethod === 'credit' && (
                    <div className="p-2.5 bg-muted/30 rounded-xl border border-border">
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
                </div>
              </div>

              {/* Sección Derecha en mobile-landscape / Flujo Principal en PC y móvil vertical */}
              <div className="space-y-3 flex flex-col">
                {/* CreditInfo / BankAccountsList / Card Info en pantalla estándar (PC y móvil vertical) */}
                <div className="mobile-landscape:hidden space-y-2">
                  {paymentMethod === 'credit' && (
                    <div className="p-3 bg-muted/30 rounded-xl border border-border animate-in fade-in">
                      <CreditInfo
                        selectedCustomer={selectedCustomer}
                        creditDays={creditDays}
                        onCreditDaysChange={onCreditDaysChange}
                      />
                    </div>
                  )}

                  {paymentMethod === 'transfer' && (
                    <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-2 animate-in fade-in">
                      <BankAccountsList totalAmount={fullTotal} />
                    </div>
                  )}

                  {paymentMethod === 'card' && (
                    <div className="p-4 sm:p-5 bg-muted/20 border border-border/80 rounded-2xl flex flex-col items-center justify-center text-center gap-2 animate-in fade-in">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                        <CreditCard className="h-6 w-6" />
                      </div>
                      <span className="text-sm sm:text-base font-bold text-foreground">Cobro con Tarjeta</span>
                      <span className="text-xs sm:text-sm text-muted-foreground max-w-[340px]">
                        Procese el cobro en el Verifone o terminal punto de venta y presione Facturar Pago.
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Info en mobile-landscape */}
                <div className="hidden mobile-landscape:block">
                  {paymentMethod === 'card' && (
                    <div className="p-2.5 bg-muted/20 border border-border/80 rounded-xl flex flex-col items-center justify-center text-center gap-1">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <span className="text-xs font-bold text-foreground">Cobro con Tarjeta</span>
                      <span className="text-[10px] text-muted-foreground">Procese en terminal y presione Facturar.</span>
                    </div>
                  )}
                </div>

                {/* Sección interactiva para Efectivo y Mixto */}
                {(paymentMethod === 'cash' || paymentMethod === 'split') && (
                  <div className="space-y-2.5 animate-in fade-in slide-in-from-top-1 flex flex-col shrink-0">
                    {paymentMethod === 'split' && (
                      <div className="grid grid-cols-2 gap-2 shrink-0">
                        <div className="space-y-1">
                          <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-0.5">Restante en</label>
                          <select
                            value={splitMethod}
                            onChange={e => setSplitMethod(e.target.value)}
                            className="w-full h-9 sm:h-10 bg-background border border-border rounded-xl text-xs sm:text-sm font-semibold px-2.5 text-foreground outline-none focus:border-primary"
                          >
                            <option value="card">Tarjeta</option>
                            <option value="transfer">Transferencia</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-0.5">Monto Restante</label>
                          <div className="h-9 sm:h-10 w-full bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center px-3 font-bold text-blue-600 text-xs sm:text-sm">
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
                        <label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {paymentMethod === 'split' ? 'Efectivo Recibido' : 'Monto Recibido'}
                        </label>
                        <div className="flex items-center gap-2">
                          {localAmount && (
                            <button
                              type="button"
                              onClick={() => handleAmountChange('')}
                              className="text-[10px] sm:text-[11px] font-bold text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                              title="Borrar monto"
                            >
                              <X className="h-3 w-3" />
                              <span>Limpiar</span>
                            </button>
                          )}
                          {webChangeInfo && (
                            <div className="bg-amber-500/10 text-amber-600 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                              {webChangeInfo.type === 'exact' ? 'Exacto' : `+RD$ ${webChangeInfo.amount}`}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="relative group shrink-0">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <span className="text-sm font-black text-muted-foreground/70 group-focus-within:text-emerald-500 transition-colors">RD$</span>
                        </div>
                        <Input
                          ref={amountInputRef}
                          type="number"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={localAmount}
                          onChange={(e) => handleAmountChange(e.target.value)}
                          onFocus={(e) => {
                            e.target.select();
                          }}
                          className="h-11 sm:h-12 pl-12 pr-4 text-xl sm:text-2xl font-black bg-background border-2 border-border/80 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20 rounded-xl text-foreground transition-all shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shrink-0"
                        />
                      </div>

                      {/* Botones de sugerencias rápidas centrados y sin scrollbar horizontal */}
                      {paymentMethod === 'cash' && (
                        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-1">
                          {localAmount && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg border border-border/70 text-[11px] sm:text-xs font-bold text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-all shrink-0 gap-1"
                              onClick={() => handleAmountChange('')}
                              title="Borrar monto"
                            >
                              <X className="h-3 w-3" />
                              Borrar
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg border text-[11px] sm:text-xs font-bold transition-all shrink-0 shadow-xs",
                              currentReceived === fullTotal
                                ? "bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black shadow-xs"
                                : "border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
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
                                "h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg border text-[11px] sm:text-xs font-bold transition-all tabular-nums shrink-0 shadow-xs",
                                currentReceived === amt
                                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black shadow-xs"
                                  : "border-border/80 bg-background hover:bg-muted text-foreground"
                              )}
                              onClick={() => handleAmountChange(amt.toString())}
                            >
                              RD$ {amt.toLocaleString()}
                            </Button>
                          ))}
                        </div>
                      )}

                      {/* Tarjeta de Cambio / Devolución / Estado Centrada */}
                      {paymentMethod === 'cash' && (
                        <div className="shrink-0 pt-1">
                          {currentReceived > fullTotal ? (
                            <div className="py-2.5 px-3.5 sm:px-4 rounded-xl bg-emerald-500/15 dark:bg-emerald-950/40 border-2 border-emerald-500/50 flex items-center justify-between shadow-xs transition-all animate-in zoom-in-95">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                  <Banknote className="h-4.5 w-4.5" />
                                </div>
                                <div>
                                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block leading-tight">
                                    Cambio a Devolver
                                  </span>
                                  <span className="text-[9px] sm:text-[10px] text-muted-foreground leading-none block">
                                    Entregar al cliente
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 mr-1">RD$</span>
                                <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">
                                  {currentChange.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          ) : currentReceived === fullTotal ? (
                            <div className="py-2 px-3 sm:px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs sm:text-sm transition-all">
                              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                                <Check className="h-4 w-4 shrink-0" />
                                <span className="text-[10px] sm:text-xs uppercase tracking-wider">Pago Completo (Exacto)</span>
                              </div>
                              <span className="text-xs sm:text-sm font-bold text-muted-foreground tabular-nums">
                                RD$ 0.00
                              </span>
                            </div>
                          ) : (
                            <div className="py-2 px-3 sm:px-4 rounded-xl bg-amber-500/15 dark:bg-amber-950/40 border border-amber-500/40 flex items-center justify-between text-xs sm:text-sm transition-all">
                              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span className="text-[10px] sm:text-xs uppercase tracking-wider">Falta por recibir:</span>
                              </div>
                              <div className="text-right font-black text-sm sm:text-base text-amber-700 dark:text-amber-400 tabular-nums">
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
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex gap-2.5 p-3 sm:p-4 border-t border-border bg-card flex-shrink-0">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-xs sm:text-sm text-muted-foreground font-bold hover:bg-muted hover:text-foreground transition-all"
              disabled={isProcessing}
            >
              Cancelar
              <span className="hidden sm:inline-block ml-1.5 text-[10px] opacity-60 font-mono">[Esc]</span>
            </Button>
            <Button
              onClick={() => onProcessPayment(includeDebt, splitMethod)}
              className={cn(
                "h-10 sm:h-11 flex-1 rounded-xl font-black text-xs sm:text-sm shadow-md uppercase tracking-wider transition-all",
                isProcessing 
                  ? "bg-muted text-muted-foreground" 
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20 active:scale-[0.99]"
              )}
              disabled={!canProcess}
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Procesando...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  <span>Facturar Pago</span>
                  <span className="hidden sm:inline-block ml-1 text-[10px] opacity-75 font-mono lowercase tracking-normal">[enter]</span>
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

