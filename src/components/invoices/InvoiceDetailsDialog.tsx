import React from 'react';
import { Loader2, User, CreditCard, Package, Calendar, Receipt, Tag, Hash, UserCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSaleDetails } from '@/hooks/useSalesManagement';
import { cn } from '@/lib/utils';

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
  const { data: sale, isLoading } = useSaleDetails(saleId);

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
      cash: 'Efectivo', credit: 'Crédito', card: 'Tarjeta', split: 'Mixto'
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
      viewer: 'Visualizador',
    };
    return map[role.toLowerCase()] || role;
  };

  const LoadingOrEmpty = ({ children }: { children: React.ReactNode }) => (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        centerOnMobile={false}
        className="max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-t-[2.5rem] rounded-b-none sm:rounded-[2rem] p-0 gap-0 overflow-hidden border border-border/50 bg-card shadow-2xl"
      >
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
        Cargando detalles...
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        centerOnMobile={false}
        className="max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-t-[2.5rem] rounded-b-none sm:rounded-[2rem] p-0 gap-0 overflow-hidden border border-border/40 bg-card shadow-2xl"
      >
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto my-3 block sm:hidden shrink-0" />

        {/* ── HEADER ── */}
        <DialogHeader className="px-6 pb-4 pt-1 sm:py-5 border-b border-border/30 bg-gradient-to-b from-card to-card/80 shrink-0">
          <div className="flex items-start justify-between pr-8 gap-3">
            <div className="space-y-1.5">
              <DialogTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4 text-primary" />
                </span>
                {sale.invoice_number}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pl-10">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(sale.created_at)}
                </span>
                <span className="text-border">•</span>
                <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-bold border-primary/20 text-primary bg-primary/5">
                  {sale.invoice_type?.code || 'B02'}
                </Badge>
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
            <Badge
              className={cn(
                "font-bold border-0 px-3 py-1 text-xs shadow-sm shrink-0 mt-1",
                isPaid
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-amber-500/10 text-amber-500'
              )}
            >
              {isPaid ? '✓ Pagada' : '⏳ Pendiente'}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">

            {/* ── CUSTOMER + CASHIER + PAYMENT INFO ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Cliente */}
              <div className="rounded-2xl border border-border/30 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <User className="w-3 h-3" />
                  Cliente
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Nombre</p>
                    <p className="text-sm font-bold text-foreground mt-0.5">{sale.customer?.name || 'Consumidor Final'}</p>
                  </div>
                  {sale.customer?.phone && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Teléfono</p>
                      <p className="text-sm font-semibold font-mono text-foreground mt-0.5">{sale.customer.phone}</p>
                    </div>
                  )}
                  {sale.customer?.rnc && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">RNC</p>
                      <p className="text-sm font-semibold font-mono text-foreground mt-0.5">{sale.customer.rnc}</p>
                    </div>
                  )}
                  {sale.customer?.email && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Email</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5 truncate" title={sale.customer.email}>{sale.customer.email}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Facturado por */}
              <div className="rounded-2xl border border-border/30 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <UserCheck className="w-3 h-3 text-primary" />
                  Facturado Por
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Usuario / Cajero</p>
                    <p className="text-sm font-bold text-foreground mt-0.5">
                      {sale.profile?.full_name || 'Sistema'}
                    </p>
                  </div>
                  {sale.profile?.role && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Rol</p>
                      <Badge variant="outline" className="mt-0.5 font-bold border-primary/20 text-primary bg-primary/5 px-2 py-0.5 text-[10px]">
                        {roleLabel(sale.profile.role)}
                      </Badge>
                    </div>
                  )}
                  {sale.profile?.email && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Email</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5 truncate" title={sale.profile.email}>
                        {sale.profile.email}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pago */}
              <div className="rounded-2xl border border-border/30 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <CreditCard className="w-3 h-3" />
                  Pago
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Método</p>
                    <Badge variant="outline" className="mt-0.5 font-bold border-primary/30 text-primary bg-primary/5 px-2 py-0.5 text-xs">
                      {paymentLabel(sale.payment_method)}
                    </Badge>
                  </div>
                  {sale.payment_method === 'split' ? (
                    <>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Efectivo</p>
                        <p className="text-sm font-semibold font-mono mt-0.5">${(sale.split_cash || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">
                          {sale.split_method === 'card' ? 'Tarjeta' : sale.split_method === 'transfer' ? 'Transf.' : 'Otro'}
                        </p>
                        <p className="text-sm font-semibold font-mono mt-0.5">${((sale.total || 0) - (sale.split_cash || 0)).toFixed(2)}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      {sale.amount_received != null && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Recibido</p>
                          <p className="text-sm font-semibold font-mono mt-0.5">${sale.amount_received.toFixed(2)}</p>
                        </div>
                      )}
                      {sale.change_amount != null && sale.change_amount > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Cambio</p>
                          <p className="text-sm font-semibold font-mono text-emerald-500 mt-0.5">${sale.change_amount.toFixed(2)}</p>
                        </div>
                      )}
                      {sale.payment_method === 'credit' && sale.due_date && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Vencimiento de Crédito</p>
                          <p className="text-sm font-semibold font-mono text-amber-500 mt-0.5">
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
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Package className="w-3 h-3" />
                Productos ({sale.sale_items?.length || 0})
              </p>

              <div className="space-y-2">
                {sale.sale_items?.map((item) => {
                  const lineTotal = item.total ?? (item.quantity * item.unit_price);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-2xl border border-border/25 bg-muted/10 hover:bg-muted/20 transition-colors group"
                    >
                      {/* Image / Icon */}
                      {item.product?.image_url ? (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-11 h-11 object-cover rounded-xl border border-border/30 bg-background shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 bg-primary/8 border border-primary/15 flex items-center justify-center rounded-xl text-primary shrink-0">
                          <Package className="w-5 h-5" />
                        </div>
                      )}

                      {/* Name + details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate leading-tight">
                          {item.product?.name || 'Producto'}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground font-mono">
                            {item.quantity} × ${item.unit_price.toFixed(2)}
                          </span>
                          {item.discount_percentage > 0 && (
                            <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-md">
                              -{item.discount_percentage}%
                            </span>
                          )}
                          {item.tax_amount > 0 && (
                            <span className="text-[10px] text-muted-foreground/60 font-mono">
                              ITBIS ${item.tax_amount.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Line total */}
                      <div className="text-right shrink-0">
                        <span className="text-sm font-black text-foreground font-mono">
                          ${lineTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── TOTALS ── */}
            <div className="rounded-2xl border border-border/30 bg-muted/15 p-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Subtotal</span>
                <span className="font-semibold font-mono">${sale.subtotal.toFixed(2)}</span>
              </div>
              {sale.discount_total > 0 && (
                <div className="flex justify-between text-sm text-rose-500">
                  <span className="font-medium">Descuento</span>
                  <span className="font-semibold font-mono">-${sale.discount_total.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">ITBIS</span>
                <span className="font-semibold font-mono">${sale.tax_total.toFixed(2)}</span>
              </div>

              <div className="border-t border-dashed border-border/50 pt-3 mt-1 flex justify-between items-center">
                <span className="text-base font-bold text-foreground">Total</span>
                <span className="text-2xl font-black text-primary font-mono">${sale.total.toFixed(2)}</span>
              </div>
            </div>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDetailsDialog;
