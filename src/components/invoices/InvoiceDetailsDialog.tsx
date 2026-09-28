import React, { useState, useMemo } from 'react';
import {
  Loader2,
  User,
  CreditCard,
  Package,
  Calendar,
  Receipt,
  UserCheck,
  Printer,
  Copy,
  Check,
  Phone,
  Clock,
  X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSaleDetails } from '@/hooks/useSalesManagement';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import PrintOptionsDialog from '../pos/PrintOptionsDialog';

interface InvoiceDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  saleId: string;
}

const InvoiceDetailsDialog: React.FC<InvoiceDetailsDialogProps> = ({
  isOpen,
  onClose,
  saleId,
}) => {
  const { toast } = useToast();
  const { data: sale, isLoading } = useSaleDetails(saleId);
  const [copied, setCopied] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const paymentLabel = (method: string) => {
    const map: Record<string, string> = {
      cash: 'Efectivo',
      credit: 'Crédito',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      split: 'Mixto'
    };
    return map[method] || method;
  };

  const roleLabel = (role?: string) => {
    if (!role) return null;
    const map: Record<string, string> = {
      admin: 'Administrador',
      cashier: 'Cajero',
      employee: 'Empleado',
      manager: 'Gerente',
      accountant: 'Contador',
      kitchen: 'Cocinero',
      delivery: 'Delivery',
      viewer: 'Visualizador',
    };
    return map[role.toLowerCase()] || role;
  };

  const handleCopyNcf = () => {
    if (!sale?.invoice_number) return;
    navigator.clipboard.writeText(sale.invoice_number);
    setCopied(true);
    toast({
      title: "NCF copiado",
      description: `Número ${sale.invoice_number} copiado al portapapeles.`,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const printSaleData = useMemo(() => {
    if (!sale) return null;
    return {
      total: sale.total,
      subtotal: sale.subtotal,
      tax_total: sale.tax_total,
      discount_total: sale.discount_total,
      paymentMethod: sale.payment_method,
      payment_method: sale.payment_method,
      amount_received: sale.amount_received,
      change: sale.change_amount,
      customer: sale.customer,
      invoice_number: sale.invoice_number,
      invoiceNumber: sale.invoice_number,
      invoiceType: sale.invoice_type?.code || 'B02',
      profile: sale.profile ? { full_name: sale.profile.full_name || 'Sistema' } : undefined,
      created_at: sale.created_at,
      due_date: sale.due_date,
      items: sale.sale_items?.map((item: any) => ({
        ...item,
        name: item.product?.name || 'Producto',
        price: item.unit_price,
        quantity: item.quantity,
        total: item.total || (item.quantity * item.unit_price),
      })) || [],
    };
  }, [sale]);

  const LoadingOrEmpty = ({ children }: { children: React.ReactNode }) => (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-[480px] rounded-3xl p-0 overflow-hidden border border-border/50 bg-card shadow-2xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Detalles de Factura</DialogTitle>
          <DialogDescription>Cargando información</DialogDescription>
        </DialogHeader>
        <div className="p-16 text-center text-muted-foreground font-medium flex items-center justify-center gap-2">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );

  if (isLoading) {
    return (
      <LoadingOrEmpty>
        <Loader2 className="h-5 w-5 text-primary animate-spin" />
        Cargando detalles de la factura...
      </LoadingOrEmpty>
    );
  }

  if (!sale) {
    return (
      <LoadingOrEmpty>
        No se encontraron detalles de la factura
      </LoadingOrEmpty>
    );
  }

  const isPaid = sale.status === 'completed';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          hideCloseButton
          className="sm:max-w-[760px] md:max-w-[800px] w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-3xl p-0 gap-0 overflow-hidden border border-border/50 bg-card shadow-2xl"
        >
          {/* Mobile drag handle */}
          <div className="w-12 h-1 bg-muted-foreground/25 rounded-full mx-auto my-2.5 block sm:hidden shrink-0" />

          {/* ── HEADER BANNER ── */}
          <DialogHeader className="px-5 sm:px-6 py-4 sm:py-5 border-b border-border/40 bg-muted/30 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
                  <Receipt className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-xl sm:text-2xl font-black font-mono tracking-tight text-foreground">
                      {sale.invoice_number}
                    </DialogTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleCopyNcf}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
                      title="Copiar NCF"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                    <Badge variant="outline" className="h-5 px-2 text-[10px] font-bold border-primary/30 text-primary bg-primary/5">
                      {sale.invoice_type?.code || 'B02'}
                      {sale.invoice_type?.name ? ` • ${sale.invoice_type.name}` : ''}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      {formatDate(sale.created_at)}
                    </span>
                    {sale.profile?.full_name && (
                      <>
                        <span className="text-border">•</span>
                        <span className="flex items-center gap-1 font-medium text-foreground/80">
                          <UserCheck className="w-3.5 h-3.5 text-primary" />
                          {sale.profile.full_name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  className={cn(
                    "font-bold border px-3 py-1 text-xs shadow-xs",
                    isPaid
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  )}
                >
                  {isPaid ? '✓ Pagada' : '⏳ Pendiente'}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-xl"
                  title="Cerrar"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <DialogDescription className="sr-only">Detalles y desglose de la factura</DialogDescription>
          </DialogHeader>

          {/* ── BODY CON SCROLL RADIX ELEGANTE (SIN SCROLLBAR NATIVO GRIS) ── */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 sm:p-6 space-y-6">

              {/* ── 3 INFO CARDS: CLIENTE, CAJERO, PAGO ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Cliente */}
                <div className="rounded-2xl border border-border/40 bg-muted/20 p-4 space-y-2.5 hover:border-blue-500/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-blue-500">
                      <User className="w-3.5 h-3.5" />
                      <span>Cliente</span>
                    </div>
                    {sale.customer?.rnc && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-blue-500/25 text-blue-500 font-mono">
                        RNC
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-medium block">Nombre</span>
                      <p className="font-bold text-foreground text-sm leading-tight mt-0.5">
                        {sale.customer?.name || 'Consumidor Final'}
                      </p>
                    </div>
                    {sale.customer?.rnc && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-medium block">RNC / Cédula</span>
                        <p className="font-mono font-semibold text-foreground text-xs mt-0.5">{sale.customer.rnc}</p>
                      </div>
                    )}
                    {sale.customer?.phone && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-medium block">Teléfono</span>
                        <p className="font-mono text-foreground text-xs flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          {sale.customer.phone}
                        </p>
                      </div>
                    )}
                    {sale.customer?.email && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-medium block">Correo</span>
                        <p className="text-muted-foreground text-xs break-all mt-0.5" title={sale.customer.email}>
                          {sale.customer.email}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Facturado por */}
                <div className="rounded-2xl border border-border/40 bg-muted/20 p-4 space-y-2.5 hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Facturado Por</span>
                    </div>
                    {sale.profile?.role && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/25 text-primary bg-primary/5 font-bold">
                        {roleLabel(sale.profile.role)}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-medium block">Cajero / Usuario</span>
                      <p className="font-bold text-foreground text-sm leading-tight mt-0.5">
                        {sale.profile?.full_name || 'Sistema'}
                      </p>
                    </div>
                    {sale.profile?.email && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-medium block">Correo</span>
                        <p className="text-muted-foreground text-xs break-all mt-0.5" title={sale.profile.email}>
                          {sale.profile.email}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-medium block">Emisión</span>
                      <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        {formatDate(sale.created_at)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Pago y Estado */}
                <div className="rounded-2xl border border-border/40 bg-muted/20 p-4 space-y-2.5 hover:border-amber-500/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-500">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Pago y Condiciones</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5 px-2 py-0.5">
                      {paymentLabel(sale.payment_method)}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {sale.payment_method === 'split' ? (
                      <>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium block">Efectivo</span>
                          <p className="font-mono font-bold text-foreground text-xs mt-0.5">${(sale.split_cash || 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                            {sale.split_method === 'card' ? 'Tarjeta' : sale.split_method === 'transfer' ? 'Transf.' : 'Otro'}
                          </span>
                          <p className="font-mono font-bold text-foreground text-xs mt-0.5">${((sale.total || 0) - (sale.split_cash || 0)).toFixed(2)}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        {sale.amount_received != null && (
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-medium block">Monto Recibido</span>
                            <p className="font-mono font-bold text-foreground text-xs mt-0.5">${sale.amount_received.toFixed(2)}</p>
                          </div>
                        )}
                        {sale.change_amount != null && sale.change_amount > 0 && (
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-medium block">Cambio Devuelto</span>
                            <p className="font-mono font-bold text-emerald-500 text-xs mt-0.5">${sale.change_amount.toFixed(2)}</p>
                          </div>
                        )}
                        {sale.payment_method === 'credit' && sale.due_date && (
                          <div>
                            <span className="text-[10px] text-amber-500 uppercase font-bold flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Vencimiento Crédito
                            </span>
                            <p className="font-mono font-black text-amber-500 text-sm mt-0.5">
                              {new Date(sale.due_date).toLocaleDateString('es-DO')}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ── PRODUCTS ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-primary" />
                    Productos Facturados ({sale.sale_items?.length || 0})
                  </p>
                  <span className="text-xs text-muted-foreground font-mono">
                    {sale.sale_items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} artículo(s)
                  </span>
                </div>

                <div className="space-y-2">
                  {sale.sale_items?.map((item) => {
                    const lineTotal = item.total ?? (item.quantity * item.unit_price);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border border-border/40 bg-card hover:bg-muted/30 transition-all group shadow-2xs"
                      >
                        {/* Image / Icon */}
                        {item.product?.image_url ? (
                          <img
                            src={item.product.image_url}
                            alt={item.product.name}
                            className="w-12 h-12 object-cover rounded-xl border border-border/30 bg-background shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-primary/10 border border-primary/20 flex items-center justify-center rounded-xl text-primary shrink-0">
                            <Package className="w-6 h-6" />
                          </div>
                        )}

                        {/* Name + details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate leading-snug">
                            {item.product?.name || 'Producto'}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-foreground font-mono font-semibold bg-muted/50 px-2 py-0.5 rounded-lg border border-border/30">
                              {item.quantity} × ${item.unit_price.toFixed(2)}
                            </span>
                            {item.discount_percentage > 0 && (
                              <Badge variant="outline" className="text-[10px] font-bold text-rose-500 border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5">
                                -{item.discount_percentage}% dto.
                              </Badge>
                            )}
                            {item.tax_amount > 0 && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                ITBIS: ${item.tax_amount.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Line total */}
                        <div className="text-right shrink-0">
                          <span className="text-base font-black text-foreground font-mono">
                            ${lineTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── TOTALS BREAKDOWN ── */}
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 sm:p-5 space-y-2.5">
                <div className="flex justify-between text-xs sm:text-sm text-muted-foreground font-medium">
                  <span>Subtotal Neto</span>
                  <span className="font-semibold font-mono text-foreground">${sale.subtotal.toFixed(2)}</span>
                </div>
                {sale.discount_total > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm text-rose-500 font-medium">
                    <span>Descuento Aplicado</span>
                    <span className="font-semibold font-mono">-${sale.discount_total.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs sm:text-sm text-muted-foreground font-medium">
                  <span>ITBIS (Impuesto 18%)</span>
                  <span className="font-semibold font-mono text-foreground">${sale.tax_total.toFixed(2)}</span>
                </div>

                <div className="border-t border-border/40 pt-3 mt-2 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-black text-muted-foreground uppercase tracking-wider block">Total Facturado</span>
                    <span className="text-[10px] text-muted-foreground">Moneda: DOP (RD$)</span>
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-primary font-mono tracking-tight">
                    ${sale.total.toFixed(2)}
                  </span>
                </div>
              </div>

            </div>
          </ScrollArea>

          {/* ── FOOTER ACTIONS ── */}
          <div className="p-4 px-6 border-t border-border/40 bg-muted/30 flex items-center justify-between gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPrintOpen(true)}
              className="rounded-xl h-9 text-xs font-bold gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir / Enviar Ticket
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="rounded-xl h-9 px-5 text-xs font-bold"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de opciones de impresión y WhatsApp */}
      {printSaleData && (
        <PrintOptionsDialog
          isOpen={isPrintOpen}
          onClose={() => setIsPrintOpen(false)}
          saleData={printSaleData}
        />
      )}
    </>
  );
};

export default InvoiceDetailsDialog;
