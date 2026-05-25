
import React from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSaleDetails } from '@/hooks/useSalesManagement';

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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="p-8 text-center">Cargando detalles...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!sale) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="p-8 text-center">No se encontraron detalles de la factura</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Detalles de Factura: {sale.invoice_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información General */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Información de la Factura</h3>
              <div className="text-sm space-y-1">
                <p><span className="font-medium">Número:</span> {sale.invoice_number}</p>
                <p><span className="font-medium">Fecha:</span> {formatDate(sale.created_at)}</p>
                <p><span className="font-medium">Tipo:</span> <Badge variant="outline">{sale.invoice_type?.code}</Badge></p>
                <p><span className="font-medium">Estado:</span>
                  <Badge className="ml-2" variant={sale.status === 'completed' ? 'default' : 'secondary'}>
                    {sale.status === 'completed' ? 'Pagada' : 'Pendiente'}
                  </Badge>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Información del Cliente</h3>
              <div className="text-sm space-y-1">
                <p><span className="font-medium">Nombre:</span> {sale.customer?.name || 'Cliente General'}</p>
                {sale.customer?.rnc && <p><span className="font-medium">RNC:</span> {sale.customer.rnc}</p>}
                {sale.customer?.phone && <p><span className="font-medium">Teléfono:</span> {sale.customer.phone}</p>}
                {sale.customer?.email && <p><span className="font-medium">Email:</span> {sale.customer.email}</p>}
              </div>
            </div>
          </div>

          {/* Productos */}
          <div>
            <h3 className="font-semibold mb-3">Productos</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Precio Unit.</TableHead>
                  <TableHead>Descuento</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead>ITBIS</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.sale_items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.product?.name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>${item.unit_price.toFixed(2)}</TableCell>
                    <TableCell>{item.discount_percentage || 0}%</TableCell>
                    <TableCell>${item.subtotal.toFixed(2)}</TableCell>
                    <TableCell>${item.tax_amount.toFixed(2)}</TableCell>
                    <TableCell className="font-semibold">${item.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totales */}
          <div className="border-t pt-4">
            <div className="flex justify-end">
              <div className="w-80 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${sale.subtotal.toFixed(2)}</span>
                </div>
                {sale.discount_total && sale.discount_total > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Descuento:</span>
                    <span>-${sale.discount_total.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>ITBIS:</span>
                  <span>${sale.tax_total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold border-t pt-2">
                  <span>Total:</span>
                  <span>${sale.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Información de Pago */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">Información de Pago</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">Método:</span>
                <Badge className="ml-2" variant="outline">
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
                    <span className="font-medium">Efectivo:</span> ${(sale.split_cash || 0).toFixed(2)}
                  </div>
                  <div>
                    <span className="font-medium">{sale.split_method === 'card' ? 'Tarjeta' : sale.split_method === 'transfer' ? 'Transf.' : 'Otro'}:</span> ${((sale.total || 0) - (sale.split_cash || 0)).toFixed(2)}
                  </div>
                </>
              ) : (
                <>
                  {sale.amount_received != null && (
                    <div>
                      <span className="font-medium">Recibido:</span> ${sale.amount_received.toFixed(2)}
                    </div>
                  )}
                  {sale.change_amount != null && sale.change_amount > 0 && (
                    <div>
                      <span className="font-medium">Cambio:</span> ${sale.change_amount.toFixed(2)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDetailsDialog;
