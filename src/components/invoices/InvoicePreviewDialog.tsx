import React, { useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, X, Mail, Download, Eye, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { Sale, useSaleDetails } from '@/hooks/useSalesManagement';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { generateCleanInvoiceHTML } from '@/utils/generateCleanInvoiceHTML';

interface InvoicePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  onPrint?: () => void;
}

const InvoicePreviewDialog: React.FC<InvoicePreviewDialogProps> = ({
  isOpen,
  onClose,
  sale,
  onPrint,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { data: saleDetails, isLoading } = useSaleDetails(sale.id);
  const { printSettings, companyInfo } = usePrintSettings();
  const { settings: storeSettings } = useStoreSettings();

  // Use detailed sale data when available, fall back to list data
  const saleData = saleDetails || sale;

  const invoiceHTML = useMemo(() => {
    if (!saleData) return '';

    const rawItems = (saleData as any).sale_items || (saleData as any).items || [];
    const items = rawItems.map((item: any) => ({
      name: item.product?.name || item.product_name || item.name || 'Producto',
      quantity: item.quantity || 1,
      price: item.unit_price || item.price || 0,
      total: item.total || (item.quantity || 1) * (item.unit_price || item.price || 0),
      comment: item.comment,
    }));

    const taxRate = parseFloat(storeSettings?.default_tax_rate?.toString() || '18');
    const taxAmount = items.reduce((sum: number, item: any) => sum + ((item.total - item.total / (1 + taxRate / 100))), 0);
    const subtotalAmount = (saleData.total || 0) - taxAmount;

    const invoiceNum = (saleData as any).encf || saleData.invoice_number || '';
    const isElec = invoiceNum.startsWith('E') || (saleData as any).is_electronic || !!(saleData as any).encf;

    return generateCleanInvoiceHTML(
      {
        name: companyInfo?.name || 'Mi Empresa',
        logo: companyInfo?.logo,
        logoSize: companyInfo?.logoInvoiceSize || companyInfo?.logoSize || 64,
        rnc: companyInfo?.rnc,
        phone: companyInfo?.phone,
        address: companyInfo?.address,
        fontSize: printSettings?.fontSize,
        containerPadding: '8px',
      },
      {
        invoiceNumber: saleData.invoice_number || '',
        invoicePrefix: storeSettings?.invoice_prefix || 'FAC-',
        date: new Date(saleData.created_at),
        items,
        subtotal: subtotalAmount,
        tax: taxAmount,
        taxRate,
        total: saleData.total || 0,
        currency: storeSettings?.currency || 'RD$',
        footerText: storeSettings?.invoice_footer_text,
        showBarcode: false,
        customerName: saleData.customer?.name,
        customerRnc: saleData.customer?.rnc,
        customerPhone: saleData.customer?.phone,
        cashierName: (saleData as any).profile?.full_name || (saleData as any).cashier_name || (saleData as any).user?.full_name,
        paymentMethod: (saleData as any).payment_method || (saleData as any).paymentMethod || 'Efectivo',
        amountPaid: (saleData as any).cash_received || (saleData as any).amountPaid || saleData.total,
        change: (saleData as any).change || 0,
        isElectronic: isElec,
        encf: (saleData as any).encf,
        securityCode: (saleData as any).codigo_seguridad,
        signatureDate: (saleData as any).fecha_firma,
        qrCodeUrl: (saleData as any).qrcode_url,
      }
    );
  }, [saleData, companyInfo, printSettings, storeSettings]);

  const handlePrint = async () => {
    if (onPrint) {
      onPrint();
      return;
    }
    // Fallback: print directly from iframe
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  const getStatusBadge = () => {
    const status = saleData.payment_method === 'credit' ? saleData.payment_status : saleData.status;
    switch (status) {
      case 'completed':
      case 'paid':
        return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1.5"><CheckCircle className="h-3 w-3" />Pagada</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="gap-1.5"><Clock className="h-3 w-3" />Pendiente</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" className="gap-1.5"><XCircle className="h-3 w-3" />Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const paymentMethodLabel = (method: string) => {
    const map: Record<string, string> = {
      cash: 'Efectivo', credit: 'Crédito', card: 'Tarjeta', transfer: 'Transferencia', split: 'Mixto',
    };
    return map[method] || method;
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent hideCloseButton className="sm:max-w-md w-full p-16 flex flex-col items-center justify-center gap-4 rounded-2xl border-border/40 bg-background shadow-2xl">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">Cargando factura...</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent hideCloseButton className="sm:max-w-4xl w-full p-0 overflow-hidden rounded-2xl border-border/40 bg-background shadow-2xl" style={{ height: 'min(90vh, 760px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Eye className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-black text-base tracking-tight">Vista Previa de Factura</h2>
              <p className="text-xs text-muted-foreground font-mono">{saleData.invoice_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 rounded-xl h-9 px-4"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 rounded-xl">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {/* Left panel: invoice details */}
          <div className="w-64 shrink-0 border-r border-border/20 bg-muted/10 flex flex-col overflow-y-auto">
            <div className="p-4 space-y-5">
              {/* Invoice info */}
              <section className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Factura</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Número</span>
                    <span className="font-mono font-bold text-xs text-primary">{saleData.invoice_number}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Estado</span>
                    {getStatusBadge()}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Pago</span>
                    <Badge variant="outline" className="text-[10px] h-5">{paymentMethodLabel(saleData.payment_method)}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Fecha</span>
                    <span className="text-xs font-medium">{new Date(saleData.created_at).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Hora</span>
                    <span className="text-xs font-medium">{new Date(saleData.created_at).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </section>

              <div className="h-px bg-border/30" />

              {/* Customer */}
              <section className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente</p>
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-sm">{saleData.customer?.name || 'Venta Rápida'}</p>
                  {saleData.customer?.rnc && <p className="text-muted-foreground font-mono">RNC: {saleData.customer.rnc}</p>}
                  {saleData.customer?.phone && <p className="text-muted-foreground">📞 {saleData.customer.phone}</p>}
                </div>
              </section>

              <div className="h-px bg-border/30" />

              {/* Total */}
              <section className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total</p>
                <p className="text-3xl font-black tracking-tighter text-foreground">
                  ${saleData.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </section>

              <div className="h-px bg-border/30" />

              {/* Items summary */}
              <section className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Productos ({saleData.sale_items?.length || 0})</p>
                <div className="space-y-1.5">
                  {(saleData.sale_items || []).slice(0, 5).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-start gap-2 text-xs">
                      <span className="text-muted-foreground flex-1 truncate leading-tight">{item.product?.name || 'Producto'} ×{item.quantity}</span>
                      <span className="font-mono font-semibold shrink-0">${(item.total || 0).toFixed(2)}</span>
                    </div>
                  ))}
                  {(saleData.sale_items?.length || 0) > 5 && (
                    <p className="text-[10px] text-muted-foreground">+{(saleData.sale_items?.length || 0) - 5} más...</p>
                  )}
                </div>
              </section>

              {/* Cashier */}
              {saleData.profile?.full_name && (
                <>
                  <div className="h-px bg-border/30" />
                  <section className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cajero</p>
                    <p className="text-xs font-semibold">{saleData.profile.full_name}</p>
                  </section>
                </>
              )}
            </div>
          </div>

          {/* Right panel: receipt preview */}
          <div className="flex-1 flex flex-col bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
            {/* Receipt container with shadow */}
            <div className="flex-1 overflow-auto flex items-start justify-center p-8">
              {!invoiceHTML ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Cargando vista previa...</p>
                </div>
              ) : (
                <div
                  className="bg-white shadow-2xl rounded-xl overflow-hidden h-fit"
                  style={{
                    width: '80mm',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.08)',
                  }}
                >
                  <iframe
                    ref={iframeRef}
                    title="Vista previa de factura"
                    srcDoc={invoiceHTML}
                    style={{
                      width: '80mm',
                      minHeight: '300px',
                      height: 'auto',
                      border: 'none',
                      display: 'block',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}
                    scrolling="no"
                    onLoad={(e) => {
                      const iframe = e.currentTarget;
                      try {
                        const doc = iframe.contentWindow?.document || iframe.contentDocument;
                        if (doc && doc.body) {
                          // Inject CSS to guarantee no scrollbars on screen
                          const style = doc.createElement('style');
                          style.textContent = `
                            @media screen {
                              html, body {
                                overflow: hidden !important;
                                margin: 0 !important;
                                padding: 0 !important;
                                width: 100% !important;
                                height: auto !important;
                              }
                              ::-webkit-scrollbar {
                                display: none !important;
                                width: 0 !important;
                                height: 0 !important;
                              }
                            }
                          `;
                          doc.head.appendChild(style);

                          const updateHeight = () => {
                            const h = doc.body.scrollHeight || doc.documentElement.scrollHeight;
                            if (h && h > 0) {
                              iframe.style.height = `${h + 10}px`;
                            }
                          };

                          updateHeight();

                          // ResizeObserver for dynamic layout shifts
                          const resizeObserver = new ResizeObserver(() => {
                            updateHeight();
                          });
                          resizeObserver.observe(doc.body);

                          // Trigger update when images load
                          doc.querySelectorAll('img').forEach(img => {
                            if (!img.complete) {
                              img.onload = updateHeight;
                            }
                          });
                        }
                      } catch (_) {
                        try {
                          const height = iframe.contentDocument?.body?.scrollHeight;
                          if (height) {
                            iframe.style.height = (height + 10) + 'px';
                          }
                        } catch (__) {}
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoicePreviewDialog;
