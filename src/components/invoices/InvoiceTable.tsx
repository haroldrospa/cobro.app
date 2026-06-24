
import React from 'react';
import { Eye, Edit, Trash2, CheckCircle, Clock, XCircle, FileText } from 'lucide-react';
import { LoadingLogo } from '@/components/ui/loading-logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sale } from '@/hooks/useSalesManagement';
import PrintOptionsDialog from '../pos/PrintOptionsDialog';
import InvoicePreviewDialog from './InvoicePreviewDialog';
import { Printer } from 'lucide-react';

interface InvoiceTableProps {
  sales: Sale[];
  onViewDetails: (sale: Sale) => void;
  onEditSale: (sale: Sale) => void;
  onDeleteSale: (saleId: string) => void;
  isLoading?: boolean;
}

const InvoiceTable: React.FC<InvoiceTableProps> = ({
  sales,
  onViewDetails,
  onEditSale,
  onDeleteSale,
  isLoading = false,
}) => {
  const [printDialogOpen, setPrintDialogOpen] = React.useState(false);
  const [selectedSaleForPrint, setSelectedSaleForPrint] = React.useState<any>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = React.useState(false);
  const [selectedSaleForPreview, setSelectedSaleForPreview] = React.useState<Sale | null>(null);

  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 50;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [sales.length]);

  const totalPages = Math.ceil(sales.length / itemsPerPage);
  const paginatedSales = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sales.slice(startIndex, startIndex + itemsPerPage);
  }, [sales, currentPage]);

  const handlePreview = (sale: Sale) => {
    setSelectedSaleForPreview(sale);
    setPreviewDialogOpen(true);
  };

  const handlePrint = (sale: Sale) => {
    // Map Sale to the format expected by PrintOptionsDialog
    const saleData = {
      total: sale.total,
      items: sale.sale_items?.map(item => ({
        name: item.product?.name || 'Producto',
        quantity: item.quantity,
        price: item.unit_price,
        tax_amount: item.tax_amount,
        tax: item.tax_amount / (item.quantity * item.unit_price), // approximate rate if needed
        total: item.total
      })) || [],
      paymentMethod: sale.payment_method,
      change: sale.change_amount,
      customer: sale.customer,
      invoice_number: sale.invoice_number,
      invoiceNumber: sale.invoice_number,
      invoiceType: sale.invoice_type?.code,
      profile: sale.profile,
      qrcode_url: sale.qrcode_url,
      is_electronic: sale.is_electronic,
      encf: sale.encf,
      estado_fiscal: sale.estado_fiscal,
      // We don't have customerDebt readily available here without fetching, 
      // but it's optional in the dialog or handled if present.
    };
    setSelectedSaleForPrint(saleData);
    setPrintDialogOpen(true);
  };

  const getStatusBadge = (sale: Sale) => {
    // Para pagos a crédito, mostrar el payment_status
    const status = sale.payment_method === 'credit' ? sale.payment_status : sale.status;

    switch (status) {
      case 'completed':
      case 'paid':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Pagada</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
      case 'overdue':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Vencida</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 h-64">
          <LoadingLogo text="Cargando facturas..." size="sm" />
        </CardContent>
      </Card>
    );
  }

  if (sales.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-lg text-muted-foreground">No se encontraron facturas</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl">Facturas ({sales.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 pt-0 sm:pt-0">
        {/* Desktop View (Table) */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold">Número</TableHead>
                <TableHead className="font-bold">Cliente</TableHead>
                <TableHead className="font-bold">Facturado por</TableHead>
                <TableHead className="font-bold">Tipo</TableHead>
                <TableHead className="font-bold text-center">Fecha</TableHead>
                <TableHead className="font-bold text-right">Total</TableHead>
                <TableHead className="font-bold text-center">Pago</TableHead>
                <TableHead className="font-bold text-center">Estado</TableHead>
                <TableHead className="font-bold text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSales.map((sale) => (
                <TableRow 
                  key={sale.id} 
                  className="hover:bg-muted/30 transition-colors cursor-pointer" 
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    onViewDetails(sale);
                  }}
                >
                  <TableCell className="font-bold text-primary">{sale.invoice_number}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold">{sale.customer?.name || 'Cliente General'}</span>
                      {sale.customer?.rnc && (
                        <span className="text-xs text-muted-foreground">RNC: {sale.customer.rnc}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{sale.profile?.full_name || 'Sistema'}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {sale.invoice_type?.code || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-xs">{formatDate(sale.created_at)}</TableCell>
                  <TableCell className="font-bold text-right text-base">${sale.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={
                      sale.payment_method === 'cash' ? 'default' :
                        sale.payment_method === 'credit' ? 'secondary' : 'outline'
                    } className="text-[10px]">
                      {sale.payment_method === 'cash' ? 'Efectivo' :
                        sale.payment_method === 'credit' ? 'Crédito' :
                          sale.payment_method === 'card' ? 'Tarjeta' :
                            sale.payment_method}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{getStatusBadge(sale)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => handlePreview(sale)} title="Vista previa" className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onViewDetails(sale)} title="Ver detalles completos" className="h-8 w-8 p-0 hover:bg-muted hover:text-foreground">
                        <FileText className="h-4 w-4 opacity-60" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onEditSale(sale)} title="Editar" className="h-8 w-8 p-0 hover:bg-blue-500/10 hover:text-blue-600">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handlePrint(sale)} title="Opciones de impresión" className="h-8 w-8 p-0 hover:bg-emerald-500/10 hover:text-emerald-600">
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDeleteSale(sale.id)} title="Eliminar" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View (Cards) */}
        <div className="md:hidden divide-y divide-border">
          {paginatedSales.map((sale) => (
            <div 
              key={sale.id} 
              className="p-4 space-y-4 hover:bg-muted/20 transition-colors cursor-pointer" 
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                onViewDetails(sale);
              }}
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg text-primary">{sale.invoice_number}</span>
                    <Badge variant="outline" className="text-[10px] h-5">{sale.invoice_type?.code || 'NCF'}</Badge>
                  </div>
                  <p className="font-bold text-base leading-tight">{sale.customer?.name || 'Cliente General'}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {formatDate(sale.created_at)}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-xl font-black text-foreground">${sale.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <div className="flex flex-col items-end gap-1.5">
                    {getStatusBadge(sale)}
                    <Badge variant="secondary" className="text-[9px] uppercase tracking-wider font-bold h-5">
                      {sale.payment_method === 'cash' ? 'Efectivo' :
                       sale.payment_method === 'credit' ? 'Crédito' :
                       sale.payment_method === 'card' ? 'Tarjeta' : sale.payment_method}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  Por: <span className="text-foreground">{sale.profile?.full_name?.split(' ')[0] || 'Sistema'}</span>
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => handlePreview(sale)} className="h-10 px-4 rounded-xl shadow-sm font-bold gap-2">
                    <Eye className="h-4 w-4" />
                    Vista Previa
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handlePrint(sale)} className="h-10 w-10 rounded-xl shadow-sm hover:text-emerald-600 hover:bg-emerald-50">
                    <Printer className="h-5 w-5" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => onEditSale(sale)} className="h-10 w-10 rounded-xl shadow-sm hover:text-blue-600 hover:bg-blue-50">
                    <Edit className="h-5 w-5" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => onDeleteSale(sale.id)} className="h-10 w-10 rounded-xl shadow-sm text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border/40 bg-muted/10">
            <span className="text-xs text-muted-foreground">
              Mostrando del {((currentPage - 1) * itemsPerPage) + 1} al {Math.min(currentPage * itemsPerPage, sales.length)} de {sales.length} facturas
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="h-8 rounded-xl text-xs font-bold"
              >
                Anterior
              </Button>
              <span className="text-xs font-bold px-2">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="h-8 rounded-xl text-xs font-bold"
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {selectedSaleForPrint && (
        <PrintOptionsDialog
          isOpen={printDialogOpen}
          onClose={() => setPrintDialogOpen(false)}
          saleData={selectedSaleForPrint}
        />
      )}

      {selectedSaleForPreview && (
        <InvoicePreviewDialog
          isOpen={previewDialogOpen}
          onClose={() => {
            setPreviewDialogOpen(false);
            setSelectedSaleForPreview(null);
          }}
          sale={selectedSaleForPreview}
          onPrint={() => {
            setPreviewDialogOpen(false);
            handlePrint(selectedSaleForPreview);
          }}
        />
      )}
    </Card>
  );
};

export default InvoiceTable;
