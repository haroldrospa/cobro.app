import React, { useState } from 'react';
import { FileText, Plus, RefreshCw, CheckCircle2, Clock, XCircle, DollarSign, Download, FileSpreadsheet } from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useSales, useDeleteSale, Sale, SalesFilters } from '@/hooks/useSalesManagement';
import { LoadingLogo } from '@/components/ui/loading-logo';
import { useCustomers } from '@/hooks/useCustomers';
import { cn } from "@/lib/utils";
import { useEmployees } from '@/hooks/useEmployees';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import InvoiceSearch from './invoices/InvoiceSearch';
import InvoiceTable from './invoices/InvoiceTable';
import InvoiceDetailsDialog from './invoices/InvoiceDetailsDialog';
import EditInvoiceDialog from './invoices/EditInvoiceDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const Invoices: React.FC = () => {
  const [filters, setFilters] = useState<SalesFilters>({
    searchTerm: '',
    status: 'all',
    paymentMethod: 'all',
    customerId: 'all',
    userId: 'all',
    invoiceTypeId: 'all',
    dateFrom: startOfMonth(new Date()),
    dateTo: endOfMonth(new Date()),
    minAmount: undefined,
    maxAmount: undefined,
  });
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const { data: sales = [], isLoading, isFetching, refetch } = useSales(filters);
  const { data: customers = [] } = useCustomers();
  const { data: employees = [] } = useEmployees();
  const deleteSale = useDeleteSale();
  const { toast } = useToast();
  const { settings: storeSettings } = useStoreSettings();

  const handleViewDetails = (sale: Sale) => {
    console.log('Viewing details for sale:', sale);
    setSelectedSale(sale);
    setShowDetailsDialog(true);
  };

  const handleEditSale = (sale: Sale) => {
    console.log('Editing sale:', sale);
    setSelectedSale(sale);
    setShowEditDialog(true);
  };

  const handleDeleteSale = (saleId: string) => {
    console.log('Deleting sale ID:', saleId);
    setSaleToDelete(saleId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!saleToDelete) return;

    try {
      await deleteSale.mutateAsync(saleToDelete);
      toast({
        title: "Factura eliminada",
        description: "La factura ha sido eliminada correctamente.",
      });
      setShowDeleteDialog(false);
      setSaleToDelete(null);
      setOtpCode(null);
      setOtpExpiresAt(null);
      setOtpInput('');
    } catch (error) {
      console.error('Error eliminando factura:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar la factura.",
      });
    }
  };

  const handleSendOtp = async () => {
    if (!storeSettings?.email_reports_recipient) {
      toast({
        variant: "destructive",
        title: "Error de configuración",
        description: "No hay un correo principal configurado para recibir el código.",
      });
      return;
    }

    setIsSendingOtp(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    try {
      const { error } = await supabase.functions.invoke('send-otp-email', {
        body: {
          email: storeSettings.email_reports_recipient,
          code: code
        }
      });

      if (error) throw error;

      setOtpCode(code);
      setOtpExpiresAt(Date.now() + 60000); // 1 minuto
      setOtpInput('');
      toast({
        title: "Código enviado",
        description: `Se ha enviado un código a ${storeSettings.email_reports_recipient}. Tienes 1 minuto para ingresarlo.`,
      });
    } catch (error) {
      console.error('Error enviando código:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo enviar el código de seguridad.",
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyAndDelete = async () => {
    if (!otpCode || !otpExpiresAt) return;
    
    if (Date.now() > otpExpiresAt) {
      toast({
        variant: "destructive",
        title: "Código expirado",
        description: "El código de seguridad ha expirado. Por favor solicita uno nuevo.",
      });
      setOtpCode(null);
      setOtpExpiresAt(null);
      setOtpInput('');
      return;
    }

    if (otpInput !== otpCode) {
      toast({
        variant: "destructive",
        title: "Código incorrecto",
        description: "El código ingresado no coincide.",
      });
      return;
    }

    await confirmDelete();
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Actualizado",
      description: "La lista de facturas se ha actualizado.",
    });
  };

  const handleExportExcel = () => {
    if (sales.length === 0) {
      toast({ title: 'Sin datos', description: 'No hay facturas para exportar.', variant: 'outline' });
      return;
    }
    const data = sales.map(s => ({
      Fecha: format(new Date(s.created_at), 'dd/MM/yyyy HH:mm'),
      NCF: s.invoice_number || 'S/N',
      Tipo_Comprobante: s.invoice_type?.name || s.invoice_type?.code || 'Factura',
      Codigo_Tipo: s.invoice_type?.code || 'N/A',
      Cliente: s.customer?.name || 'Consumidor Final',
      RNC_Cedula: s.customer?.rnc || 'N/A',
      Facturado_Por: s.profile?.full_name || 'Sistema',
      Metodo_Pago: s.payment_method?.toUpperCase() || 'EFECTIVO',
      Estado: s.payment_method === 'credit' ? (s.payment_status?.toUpperCase() || 'PENDIENTE') : (s.status?.toUpperCase() || 'COMPLETADO'),
      ITBIS: s.tax_total || 0,
      Total: s.total
    }));

    const totalSum = sales.reduce((sum, s) => sum + s.total, 0);
    const totalTax = sales.reduce((sum, s) => sum + (s.tax_total || 0), 0);
    data.push({
      Fecha: '',
      NCF: '',
      Tipo_Comprobante: '',
      Codigo_Tipo: '',
      Cliente: '',
      RNC_Cedula: 'TOTAL GENERAL',
      Facturado_Por: '',
      Metodo_Pago: '',
      Estado: '',
      ITBIS: totalTax,
      Total: totalSum
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Facturas");
    const cols = Object.keys(data[0]).map(key => ({ wch: Math.max(key.length, 18) }));
    ws['!cols'] = cols;

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    XLSX.writeFile(wb, `facturas-export-${dateStr}.xlsx`);
    toast({
      title: 'Excel Generado',
      description: 'El listado de facturas se ha exportado correctamente.'
    });
  };

  const handleExportPDF = () => {
    if (sales.length === 0) {
      toast({ title: 'Sin datos', description: 'No hay facturas para exportar.', variant: 'outline' });
      return;
    }
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(storeSettings?.company_name || 'Cobro App', 15, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text(`Listado General de Facturas — Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 15, 28);

    const head = [['Fecha', 'NCF', 'Tipo', 'Cliente', 'RNC / Cédula', 'ITBIS', 'Total']];
    const body: string[][] = sales.map(s => [
      format(new Date(s.created_at), 'dd/MM/yyyy HH:mm'),
      s.invoice_number || 'S/N',
      `${s.invoice_type?.code || 'N/A'} - ${s.invoice_type?.name || 'Factura'}`,
      s.customer?.name || 'Consumidor Final',
      s.customer?.rnc || '-',
      `$${(s.tax_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `$${s.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ]);

    const totalSum = sales.reduce((sum, s) => sum + s.total, 0);
    const totalTax = sales.reduce((sum, s) => sum + (s.tax_total || 0), 0);
    body.push(['', '', '', '', 'TOTAL GENERAL', `$${totalTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, `$${totalSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);

    autoTable(doc, {
      startY: 48,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, halign: 'center' },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [248, 248, 250] },
      margin: { left: 15, right: 15 }
    });

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    doc.save(`facturas-${dateStr}.pdf`);
    toast({
      title: 'PDF Generado',
      description: 'El reporte de facturas en PDF se ha descargado correctamente.'
    });
  };

  const handleClearFilters = () => {
    setFilters({
      searchTerm: '',
      status: 'all',
      paymentMethod: 'all',
      customerId: 'all',
      userId: 'all',
      invoiceTypeId: 'all',
      dateFrom: startOfMonth(new Date()),
      dateTo: endOfMonth(new Date()),
      minAmount: undefined,
      maxAmount: undefined,
    });
  };

  // Estadísticas filtradas - Para facturas a crédito usar payment_status, para otras usar status
  const completedSales = sales.filter(s => {
    const status = s.payment_method === 'credit' ? s.payment_status : s.status;
    return status === 'completed' || status === 'paid';
  });
  const pendingSales = sales.filter(s => {
    const status = s.payment_method === 'credit' ? s.payment_status : s.status;
    return status === 'pending';
  });
  const cancelledSales = sales.filter(s => {
    const status = s.payment_method === 'credit' ? s.payment_status : s.status;
    return status === 'cancelled';
  });
  const totalRevenue = completedSales.reduce((sum, sale) => sum + sale.total, 0);

  // Full page loading screen - Only show during initial load, not during filter updates
  if (isLoading && sales.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingLogo text="Cargando facturas..." size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-fade-in pb-20">
      {/* Centered Premium Header */}
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-8 py-6">
        <div className="space-y-3">
          <h1 className="text-4xl font-black tracking-tighter uppercase tracking-[0.15em] leading-normal py-1">
            Facturas
          </h1>
          <div className="flex items-center justify-center gap-4 text-primary/80">
            <div className="h-px w-10 bg-primary/30" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">
              Historial de Ventas y Comprobantes
            </p>
            <div className="h-px w-10 bg-primary/30" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest h-14 px-10 rounded-2xl shadow-xl shadow-emerald-500/20 gap-3 transition-all active:scale-95"
            onClick={() => window.location.href = '/pos'}
          >
            <Plus className="h-5 w-5" />
            Nueva Factura
          </Button>

          <Button 
            variant="outline" 
            className="h-14 px-5 rounded-2xl border-border/50 bg-muted/10 font-black uppercase text-[10px] tracking-widest gap-2"
            onClick={handleRefresh} 
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Actualizar
          </Button>

          <Button 
            variant="outline" 
            className="h-14 px-5 rounded-2xl border-border/50 bg-muted/10 font-black uppercase text-[10px] tracking-widest text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 gap-2"
            onClick={handleExportExcel}
            disabled={isLoading || sales.length === 0}
            title="Exportar a Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>

          <Button 
            variant="outline" 
            className="h-14 px-5 rounded-2xl border-border/50 bg-muted/10 font-black uppercase text-[10px] tracking-widest text-red-500 hover:bg-red-500/10 hover:text-red-600 gap-2"
            onClick={handleExportPDF}
            disabled={isLoading || sales.length === 0}
            title="Exportar a PDF"
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Impact Stats Grid - Redesigned */}
      <div className="max-w-6xl mx-auto w-full px-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="bg-muted/5 border-border/30 overflow-hidden relative group hover:bg-muted/10 transition-all rounded-3xl">
          <CardContent className="p-5 flex flex-col items-center text-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Total</span>
            <span className="text-3xl font-black tracking-tighter">{sales.length}</span>
            <div className="mt-2 p-1 bg-muted/20 rounded-full">
              <FileText className="h-3 w-3 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/5 border-border/30 overflow-hidden relative group hover:bg-muted/10 transition-all rounded-3xl">
          <CardContent className="p-5 flex flex-col items-center text-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Pagadas</span>
            <span className="text-3xl font-black tracking-tighter text-emerald-500">{completedSales.length}</span>
            <div className="mt-2 p-1 bg-emerald-500/10 rounded-full">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/5 border-border/30 overflow-hidden relative group hover:bg-muted/10 transition-all rounded-3xl">
          <CardContent className="p-5 flex flex-col items-center text-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Pendientes</span>
            <span className="text-3xl font-black tracking-tighter text-amber-500">{pendingSales.length}</span>
            <div className="mt-2 p-1 bg-amber-500/10 rounded-full">
              <Clock className="h-3 w-3 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/5 border-border/30 overflow-hidden relative group hover:bg-muted/10 transition-all rounded-3xl">
          <CardContent className="p-5 flex flex-col items-center text-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Canceladas</span>
            <span className="text-3xl font-black tracking-tighter text-red-500">{cancelledSales.length}</span>
            <div className="mt-2 p-1 bg-red-500/10 rounded-full">
              <XCircle className="h-3 w-3 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 md:col-span-1 lg:col-span-1 bg-emerald-600/10 border-emerald-600/30 overflow-hidden relative group hover:bg-emerald-600/15 transition-all rounded-3xl">
          <CardContent className="p-5 flex flex-col items-center text-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Venta Total</span>
            <span className="text-3xl font-black tracking-tighter text-emerald-600">
              ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <div className="mt-2 p-1 bg-emerald-600/20 rounded-full">
              <DollarSign className="h-3 w-3 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SEARCH AND FILTERS - Centered */}
      <div className="max-w-6xl mx-auto w-full px-4">
        <InvoiceSearch
          searchTerm={filters.searchTerm || ''}
          onSearchChange={(value) => setFilters(prev => ({ ...prev, searchTerm: value }))}
          statusFilter={filters.status || 'all'}
          onStatusChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
          paymentMethodFilter={filters.paymentMethod || 'all'}
          onPaymentMethodChange={(value) => setFilters(prev => ({ ...prev, paymentMethod: value }))}
          customerFilter={filters.customerId || 'all'}
          onCustomerChange={(value) => setFilters(prev => ({ ...prev, customerId: value }))}
          userIdFilter={filters.userId || 'all'}
          onUserIdChange={(value) => setFilters(prev => ({ ...prev, userId: value }))}
          invoiceTypeFilter={filters.invoiceTypeId || 'all'}
          onInvoiceTypeChange={(value) => setFilters(prev => ({ ...prev, invoiceTypeId: value }))}
          dateRange={{
            from: filters.dateFrom,
            to: filters.dateTo,
          }}
          onDateRangeChange={(range) => setFilters(prev => ({
            ...prev,
            dateFrom: range?.from,
            dateTo: range?.to,
          }))}
          minAmount={filters.minAmount?.toString() || ''}
          onMinAmountChange={(value) => setFilters(prev => ({ ...prev, minAmount: value ? parseFloat(value) : undefined }))}
          maxAmount={filters.maxAmount?.toString() || ''}
          onMaxAmountChange={(value) => setFilters(prev => ({ ...prev, maxAmount: value ? parseFloat(value) : undefined }))}
          onClearFilters={handleClearFilters}
          customers={customers}
          employees={employees}
        />
      </div>

      {/* INVOICE TABLE - Centered Container */}
      <div className="max-w-6xl mx-auto w-full px-4">
        <InvoiceTable
          sales={sales}
          onViewDetails={handleViewDetails}
          onEditSale={handleEditSale}
          onDeleteSale={handleDeleteSale}
          isLoading={isLoading}
        />
      </div>

      {/* Diálogos */}
      {selectedSale && showDetailsDialog && (
        <InvoiceDetailsDialog
          isOpen={showDetailsDialog}
          onClose={() => {
            console.log('Closing details dialog');
            setShowDetailsDialog(false);
            setSelectedSale(null);
          }}
          saleId={selectedSale.id}
        />
      )}

      {selectedSale && showEditDialog && (
        <EditInvoiceDialog
          isOpen={showEditDialog}
          onClose={() => {
            console.log('Closing edit dialog');
            setShowEditDialog(false);
            setSelectedSale(null);
          }}
          sale={selectedSale}
        />
      )}

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) {
          setOtpCode(null);
          setOtpExpiresAt(null);
          setOtpInput('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {!otpCode ? (
                  <p>Esta acción no se puede deshacer. La factura y todos sus items serán eliminados permanentemente. Se requerirá un código de seguridad.</p>
                ) : (
                  <div className="flex flex-col gap-3 mt-3">
                    <p>Hemos enviado un código de 6 dígitos al correo de reportes. Tienes 1 minuto para ingresarlo.</p>
                    <Input 
                      placeholder="Ingresa el código..." 
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      maxLength={6}
                      className="text-center text-xl tracking-[0.5em] font-mono"
                    />
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {!otpCode ? (
              <Button
                variant="destructive"
                onClick={handleSendOtp}
                disabled={isSendingOtp}
              >
                {isSendingOtp ? "Enviando..." : "Enviar Código"}
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleVerifyAndDelete}
                disabled={otpInput.length < 6}
              >
                Verificar y Eliminar
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Invoices;
