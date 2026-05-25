import React, { useState } from 'react';
import { Calculator, CreditCard, Plus, ChevronDown, ChevronUp, Percent, DollarSign, AlertCircle, Archive, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Customer } from '@/hooks/useCustomers';
import { InvoiceType } from '@/hooks/useInvoiceTypes';
import { useIsMobile } from '@/hooks/use-mobile';
import { GlobalDiscount } from '@/types/pos';
import { cn } from '@/lib/utils';
import AddCustomerDialog from './AddCustomerDialog';
import { useCustomerBalance } from '@/hooks/useCustomerBalance';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { thermalPrinter } from '@/utils/thermalPrinter';
import { useToast } from '@/hooks/use-toast';
import LoyaltyPanel from './LoyaltyPanel';
import QuickNotesSection, { useQuickNotes } from './QuickNotes';

interface PaymentSummaryProps {
  totals: {
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
  };
  selectedCustomer: string;
  selectedInvoiceType: string;
  cartLength: number;
  customers: Customer[];
  invoiceTypes: InvoiceType[];
  globalDiscount: GlobalDiscount;
  onCustomerChange: (value: string) => void;
  onInvoiceTypeChange: (value: string) => void;
  onDiscountChange: (discount: GlobalDiscount) => void;
  onCheckout: () => void;
  fullscreenButton?: React.ReactNode;
  isInvoiceLimitReached?: boolean;
  onLoyaltyCustomerFound?: (customerId: string) => void;
  onLoyaltyPointsBalance?: (currentPoints: number) => void;
  onLoyaltyPointsRedeemed?: (discountAmount: number, pointsUsed: number) => void;
  onLoyaltyClearRedemption?: () => void;
  loyaltyRedeemedPoints?: number;
  isClassicMode?: boolean;
  isElectronic?: boolean;
}

const PaymentSummary: React.FC<PaymentSummaryProps> = ({
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
  fullscreenButton,
  isInvoiceLimitReached = false,
  onLoyaltyCustomerFound,
  onLoyaltyPointsBalance,
  onLoyaltyPointsRedeemed,
  onLoyaltyClearRedemption,
  loyaltyRedeemedPoints = 0,
  isClassicMode = true,
  isElectronic = false,
}) => {
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [isInvoiceTypeOpen, setIsInvoiceTypeOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const isMobile = useIsMobile();

  const { totalNotes } = useQuickNotes();

  const { companyInfo } = usePrintSettings();
  const companyLogo = companyInfo.logo || null;
  const logoSummarySize = companyInfo.logoSummarySize;
  const { toast } = useToast();

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

  const selectedType = mappedInvoiceTypes.find(type => type.id === selectedInvoiceType);
  const requiresCustomer = selectedType?.code === 'B01' || selectedType?.code === 'E31' || selectedType?.name?.toLowerCase().includes('crédito fiscal');

  const { data: customerBalance } = useCustomerBalance(selectedCustomer);
  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);

  const isCheckoutDisabled = cartLength === 0 || (requiresCustomer && !selectedCustomer);

  const handleCustomerAdded = (customerId: string) => {
    onCustomerChange(customerId);
  };

  const handleDiscountTypeChange = (type: 'percentage' | 'amount') => {
    onDiscountChange({ value: 0, type });
  };

  const handleDiscountValueChange = (value: number) => {
    const maxValue = globalDiscount.type === 'percentage' ? 100 : parseFloat(totals.subtotal);
    onDiscountChange({
      ...globalDiscount,
      value: Math.max(0, Math.min(maxValue, value))
    });
  };

  const handleOpenDrawer = async () => {
    const success = await thermalPrinter.openDrawer();
    if (success) {
      toast({
        title: "Caja Abierta",
        description: "Se envió el comando al cajón de dinero",
      });
    } else {
      toast({
        title: "Error",
        description: "No se pudo conectar a la impresora",
        variant: "destructive",
      });
    }
  };

  // Shortcut F9
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        handleOpenDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="bg-card border border-border rounded-lg p-1 md:p-4 h-fit md:h-full flex flex-col transition-all">
      {/* Header con logo */}
      <div className="flex flex-col items-center gap-1 mb-1 flex-shrink-0">
        <div className="flex items-center gap-1 w-full justify-between">
          <div className="flex items-center gap-1">
            <Calculator className="h-3 w-3 md:h-3.5 md:w-3.5" />
            <h2 className="text-[10px] md:text-xs font-bold">Resumen</h2>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-2 text-muted-foreground hover:text-foreground"
              onClick={handleOpenDrawer}
              title="Abrir Caja (F9)"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 w-6"
              >
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            )}
            {fullscreenButton && <div className="shrink-0">{fullscreenButton}</div>}
          </div>
        </div>
      </div>

      {/* Contenido expandido */}
      {/* Contenido expandido */}
      {(!isMobile || isExpanded) && (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1 -mr-1 pb-2">
          {/* Selección de tipo de factura */}
          <Collapsible open={!isMobile || isInvoiceTypeOpen} onOpenChange={setIsInvoiceTypeOpen} className="mb-2 flex-shrink-0">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-1 h-6 lg:pointer-events-none hover:bg-accent/50"
              >
                <label className="text-xs md:text-xs font-medium text-muted-foreground">Factura</label>
                {isMobile && <ChevronDown className={`h-3 w-3 transition-transform ${isInvoiceTypeOpen ? 'rotate-180' : ''}`} />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 px-1">
               <Select value={selectedInvoiceType} onValueChange={onInvoiceTypeChange}>
                 <SelectTrigger className="h-7 text-xs w-full">
                   <SelectValue placeholder="Seleccionar Factura" />
                 </SelectTrigger>
                 <SelectContent className="bg-popover border border-border z-50">
                   {mappedInvoiceTypes
                     .filter(type => ['B01', 'E31', 'B02', 'E32'].includes(type.code))
                     .map((type) => (
                       <SelectItem key={type.id} value={type.id} className="text-xs">
                         {type.code} - {type.name}
                       </SelectItem>
                     ))}
                 </SelectContent>
               </Select>

               {requiresCustomer && (
                 <div className="mt-2 space-y-1.5 border border-primary/20 bg-primary/5 rounded-lg p-2 animate-in fade-in slide-in-from-top-1 duration-200">
                   <div className="flex items-center justify-between">
                     <label className="text-[10px] uppercase font-bold tracking-wider text-primary">
                       Cliente Requerido (Crédito Fiscal)
                     </label>
                     <Button
                       variant="ghost"
                       size="icon"
                       className="h-5 w-5 text-primary hover:text-primary hover:bg-primary/10 rounded-full"
                       onClick={() => setShowAddCustomer(true)}
                       title="Agregar nuevo cliente"
                     >
                       <Plus className="h-3 w-3" />
                     </Button>
                   </div>
                   <Select value={selectedCustomer || "none"} onValueChange={(val) => onCustomerChange(val === "none" ? "" : val)}>
                     <SelectTrigger className="h-7 text-xs bg-background border-border">
                       <SelectValue placeholder="Seleccionar Cliente" />
                     </SelectTrigger>
                     <SelectContent className="bg-popover border border-border z-50 max-h-[200px] overflow-y-auto">
                       <SelectItem value="none" className="text-xs">
                         Seleccionar Cliente...
                       </SelectItem>
                       {customers.map((c) => (
                         <SelectItem key={c.id} value={c.id} className="text-xs">
                           {c.name} {c.rnc ? `(RNC: ${c.rnc})` : ''}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                   {selectedCustomerData && (
                     <div className="text-[10px] text-muted-foreground flex flex-col gap-0.5 bg-background/50 p-1.5 rounded border border-border/50">
                       <span className="font-semibold text-foreground">{selectedCustomerData.name}</span>
                       {selectedCustomerData.rnc ? (
                         <span className="text-primary font-mono font-semibold">RNC: {selectedCustomerData.rnc}</span>
                       ) : (
                         <span className="text-destructive font-semibold">⚠️ Sin RNC registrado</span>
                       )}
                     </div>
                   )}
                 </div>
               )}
            </CollapsibleContent>
          </Collapsible>

          {/* Loyalty Panel */}
          <div className="mb-2 flex-shrink-0">
            <LoyaltyPanel
              cartTotal={parseFloat(totals.total)}
              onCustomerFound={onLoyaltyCustomerFound}
              onLoyaltyPointsBalance={onLoyaltyPointsBalance}
              onPointsRedeemed={onLoyaltyPointsRedeemed}
              onClearRedemption={onLoyaltyClearRedemption}
              redeemedPoints={loyaltyRedeemedPoints}
            />
          </div>

          {/* Totales */}
          <div className="border border-border rounded-lg p-3 space-y-2 mb-3 flex-shrink-0">
            <div className="flex justify-between text-base md:text-lg font-medium">
              <span>Subtotal:</span>
              <span className="font-semibold">${totals.subtotal}</span>
            </div>

            {/* Descuento con controles */}
            <div className="flex justify-between items-center text-base md:text-lg gap-1">
              <span className="shrink-0 font-medium">Desc.:</span>
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex rounded-md border border-border overflow-hidden shrink-0 h-6">
                  <button
                    onClick={() => handleDiscountTypeChange('percentage')}
                    className={cn(
                      "w-6 transition-colors flex items-center justify-center",
                      globalDiscount.type === 'percentage'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    )}
                    title="Descuento por porcentaje"
                  >
                    <Percent className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDiscountTypeChange('amount')}
                    className={cn(
                      "w-6 transition-colors flex items-center justify-center",
                      globalDiscount.type === 'amount'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    )}
                    title="Descuento por monto"
                  >
                    <DollarSign className="h-3 w-3" />
                  </button>
                </div>
                <Input
                  type="number"
                  value={globalDiscount.value || ''}
                  onChange={(e) => handleDiscountValueChange(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-14 h-6 text-sm px-1"
                  min={0}
                />
                <span className="font-semibold text-destructive shrink-0 text-base md:text-lg text-right min-w-[30px]">-${totals.discount}</span>
              </div>
            </div>

            <div className="flex justify-between text-base md:text-lg font-medium">
              <span>ITBIS:</span>
              <span className="font-semibold">${totals.tax}</span>
            </div>
            <div className="flex justify-between text-xl md:text-3xl font-bold border-t border-border pt-2 mt-2">
              <span>Total:</span>
              <span>${totals.total}</span>
            </div>
          </div>

          {/* Quick Notes Section Section - Conditional Display */}
          {isClassicMode ? (
            <div className="mb-4">
              <QuickNotesSection />
            </div>
          ) : (
            <div className="mb-4">
              <Button
                variant="outline"
                className="w-full flex justify-between items-center group hover:border-primary/50 transition-all border-dashed"
                onClick={() => setShowNotesDialog(true)}
              >
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notas y Pendientes</span>
                </div>
                {totalNotes > 0 && (
                  <span className="bg-primary/10 text-primary text-[10px] px-1.5 rounded-full font-black border border-primary/20">
                    ${totalNotes.toLocaleString()}
                  </span>
                )}
              </Button>

              <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
                <DialogContent className="sm:max-w-md bg-card">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <StickyNote className="h-5 w-5 text-primary" />
                      Control de Notas y Pendientes
                    </DialogTitle>
                  </DialogHeader>
                  <div className="max-h-[80vh] overflow-y-auto">
                    <QuickNotesSection />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      )}

      {/* Botón de procesar venta - FUERA del scroll para que siempre sea visible */}
      {(!isMobile || isExpanded) && (
        <div className="mt-auto flex-shrink-0 pt-1 border-t border-transparent space-y-2">
          {isInvoiceLimitReached && (
            <div className="text-xs text-destructive font-medium text-center bg-destructive/10 p-1.5 rounded border border-destructive/20">
              Límite de facturas alcanzado
            </div>
          )}
          <Button
            onClick={onCheckout}
            className={cn(
              "w-full h-9 md:h-10 text-sm font-semibold",
              isInvoiceLimitReached && "opacity-80"
            )}
            variant={isInvoiceLimitReached ? "destructive" : "default"}
            disabled={isCheckoutDisabled || isInvoiceLimitReached}
          >
            {isInvoiceLimitReached ? (
              <>
                <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
                Límite Alcanzado
              </>
            ) : (
              <>
                <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                Procesar
                {!isMobile && <span className="ml-2 text-[10px] opacity-70 font-normal border border-current rounded px-1">F10</span>}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Versión compacta cuando está colapsado en móvil */}
      {isMobile && !isExpanded && (
        <div className="flex items-center justify-between py-2 border-t border-border mt-1 gap-2">
          <div className="flex flex-col">
            <div className="text-[10px] text-muted-foreground">Total a Pagar</div>
            <div className="text-base font-bold leading-none">${totals.total}</div>
          </div>
          <Button
            onClick={onCheckout}
            className="h-9 px-4 text-xs font-semibold flex-1 max-w-[150px]"
            disabled={isCheckoutDisabled}
          >
            <CreditCard className="mr-1.5 h-3.5 w-3.5" />
            Cobrar
          </Button>
        </div>
      )}

      <AddCustomerDialog
        isOpen={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        onCustomerAdded={handleCustomerAdded}
      />
    </div>
  );
};

export default React.memo(PaymentSummary);
