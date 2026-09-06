import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  CreditCard, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Percent, 
  DollarSign, 
  AlertCircle, 
  Archive, 
  StickyNote, 
  Check, 
  ChevronsUpDown, 
  User, 
  GripVertical, 
  SlidersHorizontal, 
  RotateCcw,
  Star 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

const DEFAULT_BLOCK_ORDER = ['invoice', 'loyalty', 'totals', 'notes'];
const STORAGE_KEY = 'cobro_pos_payment_blocks_order';

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
  const [customerSearch, setCustomerSearch] = useState('');
  const [isInvoiceTypeOpen, setIsInvoiceTypeOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [showReorderDialog, setShowReorderDialog] = useState(false);
  const [blockOrder, setBlockOrder] = useState<string[]>(DEFAULT_BLOCK_ORDER);
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);
  const [dragOverBlock, setDragOverBlock] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const filteredCustomers = React.useMemo(() => {
    if (!customerSearch) return customers.slice(0, 30);
    const q = customerSearch.toLowerCase();
    return customers
      .filter(c => c.name?.toLowerCase().includes(q) || c.rnc?.includes(q) || c.phone?.includes(q))
      .slice(0, 30);
  }, [customers, customerSearch]);

  // Load saved block order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure all standard blocks are included
          const valid = DEFAULT_BLOCK_ORDER.every(b => parsed.includes(b));
          if (valid) {
            setBlockOrder(parsed);
          }
        }
      }
    } catch (e) {
      console.error('Error loading block order:', e);
    }
  }, []);

  const saveBlockOrder = (newOrder: string[]) => {
    setBlockOrder(newOrder);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
    } catch (e) {
      console.error('Error saving block order:', e);
    }
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const currentIndex = blockOrder.indexOf(id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= blockOrder.length) return;

    const newOrder = [...blockOrder];
    const [moved] = newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, moved);
    saveBlockOrder(newOrder);
  };

  const resetBlockOrder = () => {
    saveBlockOrder(DEFAULT_BLOCK_ORDER);
    toast({
      title: "Orden restablecido",
      description: "Los bloques han vuelto a su posición predeterminada.",
    });
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedBlock(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedBlock && draggedBlock !== id) {
      setDragOverBlock(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedBlock || draggedBlock === targetId) {
      setDraggedBlock(null);
      setDragOverBlock(null);
      return;
    }
    const fromIndex = blockOrder.indexOf(draggedBlock);
    const toIndex = blockOrder.indexOf(targetId);
    if (fromIndex !== -1 && toIndex !== -1) {
      const newOrder = [...blockOrder];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);
      saveBlockOrder(newOrder);
    }
    setDraggedBlock(null);
    setDragOverBlock(null);
  };

  const handleDragEnd = () => {
    setDraggedBlock(null);
    setDragOverBlock(null);
  };

  const { totalNotes } = useQuickNotes();
  const { companyInfo } = usePrintSettings();
  const { toast } = useToast();

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

  const selectedType = mappedInvoiceTypes.find(type => type.id === selectedInvoiceType);
  const requiresCustomer = React.useMemo(() => {
    if (!selectedType?.code) return false;
    const code = selectedType.code;
    if (['B02', 'E32', 'B12', 'E43', 'B13', 'E44'].includes(code)) return false;
    return true;
  }, [selectedType]);

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

  const BLOCK_LABELS: Record<string, { label: string; icon: any }> = {
    invoice: { label: 'Factura y Comprobante', icon: CreditCard },
    loyalty: { label: 'Puntos de Lealtad', icon: Star },
    totals: { label: 'Desglose y Total', icon: Calculator },
    notes: { label: 'Notas y Pendientes', icon: StickyNote },
  };

  // Render individual block content
  const renderBlockContent = (blockId: string) => {
    switch (blockId) {
      case 'invoice':
        return (
          <Collapsible open={!isMobile || isInvoiceTypeOpen} onOpenChange={setIsInvoiceTypeOpen} className="w-full">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-1 h-6 lg:pointer-events-none hover:bg-accent/50"
              >
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> Factura
                </label>
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
                    .filter(type => !['B03', 'E33', 'B04', 'E34'].includes(type.code))
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
                  <Popover open={isCustomerOpen} onOpenChange={setIsCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isCustomerOpen}
                        className="w-full justify-between h-7 text-xs bg-background border-border font-normal"
                      >
                        {selectedCustomer ? (
                          <span className="truncate">
                            {(() => {
                              const c = customers.find(c => c.id === selectedCustomer);
                              return c ? `${c.name} ${c.rnc ? `(RNC: ${c.rnc})` : ''}` : "Seleccionar Cliente...";
                            })()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground truncate">Seleccionar Cliente...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      side="bottom" 
                      sideOffset={6} 
                      collisionPadding={12} 
                      className="w-[calc(100vw-2.5rem)] sm:w-[300px] max-w-[340px] p-0 bg-popover border border-border rounded-xl shadow-2xl z-50 overflow-hidden" 
                      align="start"
                    >
                      <Command className="bg-transparent border-none">
                        <CommandInput 
                          placeholder="Buscar por nombre o RNC..." 
                          value={customerSearch}
                          onValueChange={setCustomerSearch}
                          className="h-10 text-xs font-bold text-foreground placeholder:text-muted-foreground bg-muted/30 border-b border-border" 
                        />
                        <CommandList className="max-h-[35vh] sm:max-h-[200px] overflow-y-auto p-1.5 scrollbar-thin">
                          <CommandEmpty className="p-4 text-xs text-center text-muted-foreground font-bold uppercase tracking-widest">
                            No se encontraron clientes
                          </CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="none-customer-item-placeholder"
                              onSelect={() => {
                                onCustomerChange("");
                                setIsCustomerOpen(false);
                                setCustomerSearch('');
                              }}
                              className={cn(
                                "p-2.5 cursor-pointer rounded-xl mx-0.5 my-1 text-xs transition-all flex items-center justify-between",
                                !selectedCustomer 
                                  ? "bg-primary/20 text-primary border border-primary/30 font-black" 
                                  : "hover:bg-accent text-foreground font-medium"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                <span className="truncate">Seleccionar Cliente...</span>
                              </div>
                              {!selectedCustomer && <Check className="h-4 w-4 text-primary shrink-0" />}
                            </CommandItem>
                            {filteredCustomers.map((c) => {
                              const isSelected = selectedCustomer === c.id;
                              return (
                                <CommandItem
                                  key={c.id}
                                  value={`${c.name} ${c.rnc || ''} ${c.id}`}
                                  onSelect={() => {
                                    onCustomerChange(c.id);
                                    setIsCustomerOpen(false);
                                    setCustomerSearch('');
                                  }}
                                  className={cn(
                                    "p-2.5 cursor-pointer rounded-xl mx-0.5 my-1 text-xs transition-all flex items-center justify-between",
                                    isSelected 
                                      ? "bg-primary/20 text-primary border border-primary/30 font-black" 
                                      : "hover:bg-accent text-foreground font-medium"
                                  )}
                                >
                                  <div className="flex flex-col min-w-0 flex-1 pr-2 text-left">
                                    <span className="truncate text-xs">{c.name}</span>
                                    {c.rnc && (
                                      <span className="text-[10px] font-mono text-muted-foreground font-semibold mt-0.5">
                                        RNC: {c.rnc}
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
        );

      case 'loyalty':
        return (
          <LoyaltyPanel
            cartTotal={parseFloat(totals.total)}
            onCustomerFound={onLoyaltyCustomerFound}
            onLoyaltyPointsBalance={onLoyaltyPointsBalance}
            onPointsRedeemed={onLoyaltyPointsRedeemed}
            onClearRedemption={onLoyaltyClearRedemption}
            redeemedPoints={loyaltyRedeemedPoints}
          />
        );

      case 'totals':
        return (
          <div className="border border-border rounded-lg p-3 space-y-2 w-full bg-card/40">
            <div className="flex justify-between text-base md:text-lg font-medium">
              <span>Subtotal:</span>
              <span className="font-semibold">${totals.subtotal}</span>
            </div>

            {parseFloat(totals.discount) > 0 && (
              <div className="flex justify-between text-base md:text-lg font-medium text-destructive">
                <span>Desc.:</span>
                <span className="font-semibold">-${totals.discount}</span>
              </div>
            )}

            <div className="flex justify-between text-base md:text-lg font-medium">
              <span>ITBIS:</span>
              <span className="font-semibold">${totals.tax}</span>
            </div>
            <div className="flex justify-between text-xl md:text-3xl font-bold border-t border-border pt-2 mt-2">
              <span>Total:</span>
              <span>${totals.total}</span>
            </div>
          </div>
        );

      case 'notes':
        return isClassicMode ? (
          <QuickNotesSection />
        ) : (
          <div>
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
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-2 md:p-4 h-fit md:h-full flex flex-col transition-all">
      {/* Header con herramientas */}
      <div className="flex flex-col items-center gap-1 mb-2 flex-shrink-0">
        <div className="flex items-center gap-1 w-full justify-between">
          <div className="flex items-center gap-1">
            <Calculator className="h-3 w-3 md:h-3.5 md:w-3.5" />
            <h2 className="text-[10px] md:text-xs font-bold">Resumen</h2>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-1 text-muted-foreground hover:text-foreground"
              onClick={handleOpenDrawer}
              title="Abrir Caja (F9)"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>

            {/* Reorganizar bloques button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setShowReorderDialog(true)}
              title="Reorganizar bloques del resumen"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
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

      {/* Contenido expandido con bloques reorganizables */}
      {(!isMobile || isExpanded) && (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-2 space-y-2.5 scrollbar-thin">
          {blockOrder.map((blockId, index) => (
            <div
              key={blockId}
              draggable
              onDragStart={(e) => handleDragStart(e, blockId)}
              onDragOver={(e) => handleDragOver(e, blockId)}
              onDrop={(e) => handleDrop(e, blockId)}
              onDragEnd={handleDragEnd}
              className={cn(
                "relative group/block transition-all duration-150 rounded-lg",
                dragOverBlock === blockId && "ring-2 ring-primary ring-offset-2 scale-[1.01] bg-accent/20",
                draggedBlock === blockId && "opacity-40"
              )}
            >
              {/* Floating reorder handles visible on hover */}
              <div className="opacity-0 group-hover/block:opacity-100 transition-opacity absolute -top-2.5 right-2 z-20 bg-background/95 backdrop-blur border border-border/80 shadow-md rounded-md px-1 py-0.5 flex items-center gap-0.5 text-muted-foreground">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveBlock(blockId, 'up');
                  }}
                  disabled={index === 0}
                  className="hover:text-foreground p-0.5 disabled:opacity-20 transition-colors"
                  title="Mover arriba"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <div 
                  className="cursor-grab active:cursor-grabbing p-0.5 hover:text-foreground text-muted-foreground/80 flex items-center" 
                  title="Arrastrar para reordenar bloque"
                >
                  <GripVertical className="h-3 w-3" />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveBlock(blockId, 'down');
                  }}
                  disabled={index === blockOrder.length - 1}
                  className="hover:text-foreground p-0.5 disabled:opacity-20 transition-colors"
                  title="Mover abajo"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>

              {renderBlockContent(blockId)}
            </div>
          ))}
        </div>
      )}

      {/* Modal para reorganizar bloques */}
      <Dialog open={showReorderDialog} onOpenChange={setShowReorderDialog}>
        <DialogContent className="sm:max-w-xs bg-card p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              Reorganizar Bloques
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Ajusta el orden de las secciones en el panel de cobro según tu comodidad:
          </p>
          <div className="space-y-1.5 my-2">
            {blockOrder.map((blockId, idx) => {
              const info = BLOCK_LABELS[blockId] || { label: blockId, icon: CreditCard };
              const IconComp = info.icon;
              return (
                <div
                  key={blockId}
                  className="flex items-center justify-between p-2 rounded-md border border-border/70 bg-accent/20 text-xs"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <IconComp className="h-3.5 w-3.5 text-primary" />
                    <span>{info.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      disabled={idx === 0}
                      onClick={() => moveBlock(blockId, 'up')}
                      title="Subir"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      disabled={idx === blockOrder.length - 1}
                      onClick={() => moveBlock(blockId, 'down')}
                      title="Bajar"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 gap-1"
              onClick={resetBlockOrder}
            >
              <RotateCcw className="h-3 w-3" />
              Restablecer
            </Button>
            <Button
              size="sm"
              className="text-xs h-7"
              onClick={() => setShowReorderDialog(false)}
            >
              Listo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
