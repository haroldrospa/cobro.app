import React from 'react';
import { X, Loader2, User, CreditCard, Package, Calendar, Receipt } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          centerOnMobile={false}
          className="max-w-4xl max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-t-[2.5rem] rounded-b-none sm:rounded-[2rem] p-0 gap-0 overflow-hidden border border-border bg-card shadow-2xl"
        >
          <div className="p-16 text-center text-muted-foreground font-medium flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            Cargando detalles...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!sale) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          centerOnMobile={false}
          className="max-w-4xl max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-t-[2.5rem] rounded-b-none sm:rounded-[2rem] p-0 gap-0 overflow-hidden border border-border bg-card shadow-2xl"
        >
          <div className="p-16 text-center text-muted-foreground font-medium">
            No se encontraron detalles de la factura
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        centerOnMobile={false}
        className="max-w-3xl max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-t-[2.5rem] rounded-b-none sm:rounded-[2rem] p-0 gap-0 overflow-hidden border border-border bg-card shadow-2xl"
      >
        {/* Mobile bottom-sheet drag indicator */}
        <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto my-3 block sm:hidden shrink-0" />

        <DialogHeader className="px-6 pb-4 pt-1 sm:py-5 border-b border-border bg-card/50">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center pr-6">
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                <span>Factura {sale.invoice_number}</span>
              </DialogTitle>
              <Badge 
                className={cn(
                  "font-bold border-0 px-2.5 py-0.5 shadow-sm shrink-0",
                  sale.status === 'completed' 
                    ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15' 
                    : 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/15'
                )}
              >
                {sale.status === 'completed' ? 'Pagada' : 'Pendiente'}
              </Badge>
            </div>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground/75" />
                {formatDate(sale.created_at)}
              </span>
              <span className="text-muted-foreground/30 hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5">
                Tipo: 
                <Badge variant="outline" className="h-5 px-2 text-[10px] font-bold border-primary/20 text-primary bg-primary/5">
                  {sale.invoice_type?.code || 'B02'}
                </Badge>
              </span>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            {/* Información General del Cliente y Pago */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Información del Cliente */}
              <div className="p-4 rounded-2xl bg-secondary/25 border border-border/40 space-y-3 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <User className="w-3.5 h-3.5" />
                  <span>Cliente</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Nombre</p>
                    <p className="font-semibold text-foreground mt-0.5">{sale.customer?.name || 'Cliente General'}</p>
                  </div>
                  {sale.customer?.phone && (
                    <div>
                      <p className="text-xs text-muted-foreground">Teléfono</p>
                      <p className="font-semibold text-foreground mt-0.5 font-mono">{sale.customer.phone}</p>
                    </div>
                  )}
                  {sale.customer?.rnc && (
                    <div className="col-span-2 border-t border-border/10 pt-2">
                      <p className="text-xs text-muted-foreground">RNC</p>
                      <p className="font-semibold text-foreground mt-0.5 font-mono">{sale.customer.rnc}</p>
                    </div>
                  )}
                  {sale.customer?.email && (
                    <div className="col-span-2 border-t border-border/10 pt-2">
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-semibold text-foreground mt-0.5 truncate">{sale.customer.email}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Información de Pago */}
              <div className="p-4 rounded-2xl bg-secondary/25 border border-border/40 space-y-3 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Detalles de Pago</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Método</p>
                    <Badge variant="outline" className="w-fit font-bold border-primary/30 text-primary bg-primary/5 px-2.5 py-0.5 mt-0.5">
                      {sale.payment_method === 'cash' ? 'Efectivo' :
                        sale.payment_method === 'credit' ? 'Crédito' :
                          sale.payment_method === 'card' ? 'Tarjeta' :
                            sale.payment_method === 'split' ? 'Mixto' :
                              sale.payment_method}
                    </Badge>
                  </div>
                  
                  {sale.payment_method === 'split' ? (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Efectivo</p>
                        <p className="font-semibold text-foreground mt-0.5 font-mono">${(sale.split_cash || 0).toFixed(2)}</p>
                      </div>
                      <div className="col-span-2 border-t border-border/10 pt-2">
                        <p className="text-xs text-muted-foreground">
                          {sale.split_method === 'card' ? 'Tarjeta' : sale.split_method === 'transfer' ? 'Transf.' : 'Otro'}
                        </p>
                        <p className="font-semibold text-foreground mt-0.5 font-mono">
                          ${((sale.total || 0) - (sale.split_cash || 0)).toFixed(2)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      {sale.amount_received != null && (
                        <div>
                          <p className="text-xs text-muted-foreground">Recibido</p>
                          <p className="font-semibold text-foreground mt-0.5 font-mono">${sale.amount_received.toFixed(2)}</p>
                        </div>
                      )}
                      {sale.change_amount != null && sale.change_amount > 0 && (
                        <div className="col-span-2 border-t border-border/10 pt-2">
                          <p className="text-xs text-muted-foreground">Cambio</p>
                          <p className="font-semibold text-emerald-500 mt-0.5 font-mono">${sale.change_amount.toFixed(2)}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Productos */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Productos ({sale.sale_items?.length || 0})
                </h3>
              </div>
              
              {/* Vista Escritorio */}
              <div className="hidden md:block border border-border/50 rounded-2xl overflow-hidden shadow-sm bg-secondary/5">
                <Table>
                  <TableHeader className="bg-secondary/20">
                    <TableRow>
                      <TableHead className="font-semibold text-foreground">Producto</TableHead>
                      <TableHead className="text-center font-semibold text-foreground">Cantidad</TableHead>
                      <TableHead className="text-right font-semibold text-foreground">Precio Unit.</TableHead>
                      <TableHead className="text-center font-semibold text-foreground">Descuento</TableHead>
                      <TableHead className="text-right font-semibold text-foreground">Subtotal</TableHead>
                      <TableHead className="text-right font-semibold text-foreground">ITBIS</TableHead>
                      <TableHead className="text-right font-semibold text-foreground">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sale.sale_items?.map((item) => (
                      <TableRow key={item.id} className="hover:bg-secondary/15 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {item.product?.image_url ? (
                              <img
                                src={item.product.image_url}
                                alt={item.product.name}
                                className="w-10 h-10 object-cover rounded-xl border bg-background"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-primary/10 border border-primary/20 flex items-center justify-center rounded-xl text-primary">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                            <span className="font-semibold text-foreground">
                              {item.product?.name || 'Producto'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">{item.quantity}</TableCell>
                        <TableCell className="text-right font-mono">${item.unit_price.toFixed(2)}</TableCell>
                        <TableCell className="text-center font-medium text-red-500">{item.discount_percentage || 0}%</TableCell>
                        <TableCell className="text-right font-mono">${item.subtotal.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">${item.tax_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold font-mono text-foreground">${item.total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Vista Móvil (Tarjetas) */}
              <div className="md:hidden space-y-2.5">
                {sale.sale_items?.map((item) => (
                  <div key={item.id} className="flex items-center gap-3.5 p-3.5 bg-secondary/15 border border-border/40 rounded-2xl shadow-sm hover:bg-secondary/20 transition-colors">
                    {item.product?.image_url ? (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="w-12 h-12 object-cover rounded-xl border bg-background shrink-0 shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-primary/10 border border-primary/20 flex items-center justify-center rounded-xl text-primary shrink-0">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-foreground truncate">{item.product?.name || 'Producto'}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <span>{item.quantity} × ${item.unit_price.toFixed(2)}</span>
                        {item.discount_percentage ? (
                          <span className="text-[10px] font-semibold text-red-500 bg-red-500/10 px-1 py-0.2 rounded">
                            -{item.discount_percentage}%
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[10px] text-muted-foreground/80 mt-1 font-mono">
                        ITBIS: ${item.tax_amount.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-sm text-foreground font-mono">
                        ${item.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totales */}
            <div className="border-t border-border/40 pt-4 flex justify-end">
              <div className="w-full md:w-80 p-4 rounded-2xl bg-secondary/25 border border-border/30 space-y-2.5 shadow-sm">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Subtotal</span>
                  <span className="font-semibold text-foreground font-mono">${sale.subtotal.toFixed(2)}</span>
                </div>
                {sale.discount_total > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span className="font-medium">Descuento</span>
                    <span className="font-semibold font-mono">-${sale.discount_total.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">ITBIS</span>
                  <span className="font-semibold text-foreground font-mono">${sale.tax_total.toFixed(2)}</span>
                </div>
                
                <div className="border-t border-dashed border-border/60 my-2 pt-2" />
                
                <div className="flex justify-between items-center">
                  <span className="text-base font-bold text-foreground">Total</span>
                  <span className="text-xl font-black text-primary font-mono">${sale.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDetailsDialog;
