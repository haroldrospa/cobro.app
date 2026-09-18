import React, { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, X, QrCode, ShieldCheck, Building2, User } from 'lucide-react';
import { PurchaseReceipt } from '@/hooks/usePurchaseReceipts';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PurchaseReceiptPrintDialogProps {
  receipt: PurchaseReceipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PurchaseReceiptPrintDialog: React.FC<PurchaseReceiptPrintDialogProps> = ({
  receipt,
  open,
  onOpenChange,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { data: company } = useCompanySettings();
  const { settings: store } = useStoreSettings();

  if (!receipt) return null;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '', 'width=800,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprobante de Compras - ${receipt.ncf}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              padding: 24px;
              color: #111827;
              background: #fff;
              font-size: 12px;
              line-height: 1.5;
            }
            .ticket {
              max-width: 600px;
              margin: 0 auto;
              border: 1px solid #e5e7eb;
              padding: 24px;
              border-radius: 8px;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .font-mono { font-family: monospace; }
            .border-t { border-top: 1px solid #e5e7eb; }
            .border-b { border-bottom: 1px solid #e5e7eb; }
            .py-2 { padding-top: 8px; padding-bottom: 8px; }
            .my-3 { margin-top: 12px; margin-bottom: 12px; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { padding: 6px 8px; text-align: left; }
            th { border-bottom: 1.5px solid #111827; font-size: 11px; text-transform: uppercase; }
            .highlight-row { background-color: #f9fafb; font-weight: bold; }
            .qr-box { text-align: center; margin-top: 16px; padding-top: 12px; border-top: 1px dashed #d1d5db; }
            @media print {
              body { padding: 0; }
              .ticket { border: none; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const formattedDate = receipt.issue_date
    ? format(new Date(receipt.issue_date), "dd 'de' MMMM, yyyy", { locale: es })
    : '';

  const qrUrl = receipt.qrcode_url || (receipt.is_electronic ? `https://dgii.gov.do/ecf/${receipt.ncf}` : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl bg-card border-border">
        <DialogHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between">
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <Printer className="w-4 h-4 text-primary" />
            Vista Previa de Comprobante Fiscal
          </DialogTitle>
        </DialogHeader>

        {/* Printable Paper Area */}
        <div className="p-6 bg-muted/20 overflow-y-auto">
          <div
            ref={printRef}
            className="bg-white text-zinc-900 p-6 sm:p-8 rounded-xl shadow-md border border-zinc-200 text-xs leading-relaxed max-w-lg mx-auto"
          >
            {/* Header Emisor (El Comprador / La Empresa) */}
            <div className="text-center pb-4 border-b border-zinc-200">
              <h2 className="text-base font-black uppercase tracking-wider text-zinc-900">
                {company?.company_name || store?.name || 'EMPRESA'}
              </h2>
              {company?.rnc && (
                <p className="font-mono text-[11px] text-zinc-600 font-semibold">
                  RNC Emisor: {company.rnc}
                </p>
              )}
              {company?.address && (
                <p className="text-[10px] text-zinc-500 mt-0.5">{company.address}</p>
              )}
              {company?.phone && (
                <p className="text-[10px] text-zinc-500">Tel: {company.phone}</p>
              )}

              <div className="mt-3 py-1.5 px-3 bg-zinc-100 rounded-lg inline-block">
                <span className="font-black text-xs uppercase tracking-widest text-zinc-900">
                  {receipt.ncf_type === 'E41'
                    ? 'COMPROBANTE ELECTRÓNICO DE COMPRAS (e-CF 41)'
                    : 'COMPROBANTE DE COMPRAS (B11)'}
                </span>
              </div>
            </div>

            {/* Datos del Comprobante & Suplidor */}
            <div className="py-4 border-b border-zinc-200 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase text-zinc-400">Número de Comprobante:</p>
                <p className="font-mono font-black text-sm text-zinc-900 tracking-wider">
                  {receipt.ncf}
                </p>
                <p className="text-[10px] font-bold uppercase text-zinc-400 mt-2">Fecha de Emisión:</p>
                <p className="font-medium text-zinc-800">{formattedDate}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase text-zinc-400">Proveedor (Persona Física):</p>
                <p className="font-bold text-zinc-900">{receipt.supplier_name}</p>
                <p className="text-[10px] font-bold uppercase text-zinc-400 mt-2">Cédula / RNC Vendedor:</p>
                <p className="font-mono font-bold text-zinc-800">{receipt.supplier_rnc_cedula}</p>
              </div>
            </div>

            {/* Concepto / Items Table */}
            <div className="py-4 border-b border-zinc-200">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] uppercase font-bold text-zinc-600">
                    <th className="py-1">Cant.</th>
                    <th className="py-1">Descripción</th>
                    <th className="py-1 text-right">Precio</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {receipt.items && receipt.items.length > 0 ? (
                    receipt.items.map((item, i) => (
                      <tr key={i} className="text-zinc-800">
                        <td className="py-1.5 font-mono">{item.quantity}</td>
                        <td className="py-1.5">{item.description}</td>
                        <td className="py-1.5 text-right font-mono">
                          RD$ {Number(item.unit_price || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 text-right font-mono font-bold">
                          RD$ {Number(item.subtotal || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="text-zinc-800">
                      <td className="py-1.5 font-mono">1</td>
                      <td className="py-1.5">{receipt.description}</td>
                      <td className="py-1.5 text-right font-mono">
                        RD$ {Number(receipt.subtotal || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 text-right font-mono font-bold">
                        RD$ {Number(receipt.subtotal || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Desglose Fiscal y Retenciones DGII */}
            <div className="py-3 space-y-1.5 text-zinc-700">
              <div className="flex justify-between">
                <span>Subtotal Neto:</span>
                <span className="font-mono font-semibold">
                  RD$ {receipt.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>ITBIS Facturado ({receipt.itbis_rate}%):</span>
                <span className="font-mono font-semibold">
                  + RD$ {receipt.itbis_amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between font-bold text-zinc-900 pt-1 border-t border-zinc-200">
                <span>Total Facturado:</span>
                <span className="font-mono">
                  RD$ {receipt.total_amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {receipt.itbis_retained > 0 && (
                <div className="flex justify-between text-zinc-600 font-medium">
                  <span>(-) Retención ITBIS ({receipt.itbis_retention_rate}% - Norma 02-05):</span>
                  <span className="font-mono text-rose-700">
                    - RD$ {receipt.itbis_retained.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {receipt.isr_retained > 0 && (
                <div className="flex justify-between text-zinc-600 font-medium">
                  <span>(-) Retención ISR ({receipt.isr_retention_rate}% - Norma 07-07):</span>
                  <span className="font-mono text-rose-700">
                    - RD$ {receipt.isr_retained.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center font-black text-sm text-zinc-950 pt-2 border-t-2 border-zinc-900">
                <span>Total Neto Pagado al Proveedor:</span>
                <span className="font-mono text-base">
                  RD$ {receipt.total_net_paid.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* QR Fiscal DGII & Firma */}
            {qrUrl && (
              <div className="mt-4 pt-4 border-t border-dashed border-zinc-300 text-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrUrl)}`}
                  alt="QR Fiscal DGII"
                  className="w-24 h-24 mx-auto mb-1 opacity-90 mix-blend-multiply"
                />
                <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                  Consulta de Validación DGII
                </p>
                {receipt.security_code && (
                  <p className="text-[10px] font-mono font-bold text-zinc-700 mt-0.5">
                    Cód. Seguridad: {receipt.security_code}
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-zinc-200 text-center text-[9px] text-zinc-400 uppercase tracking-widest">
              Documento tributario emitido conforme a la normativa de la DGII
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <DialogFooter className="p-4 border-t border-border/60 bg-card gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={handlePrint}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl gap-2"
          >
            <Printer className="w-4 h-4" />
            Imprimir Comprobante
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
