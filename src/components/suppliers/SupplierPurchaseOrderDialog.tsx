import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileSpreadsheet,
  Printer,
  MessageCircle,
  Copy,
  Check,
  AlertTriangle,
  Package,
  Search,
  ShoppingCart,
  Minus,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Supplier } from '@/hooks/useSuppliers';
import { Product } from '@/hooks/useProductsOffline';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface SupplierPurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  products: Product[];
}

export const SupplierPurchaseOrderDialog: React.FC<SupplierPurchaseOrderDialogProps> = ({
  open,
  onOpenChange,
  supplier,
  products,
}) => {
  const { toast } = useToast();
  const { companyInfo } = usePrintSettings();

  const [searchTerm, setSearchTerm] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Orden ID generado automáticamente para referencia
  const orderNumber = useMemo(() => {
    const now = new Date();
    const dateStr = format(now, 'yyMMdd');
    const timeStr = format(now, 'HHmm');
    return `OC-${dateStr}-${timeStr}`;
  }, [open]);

  // Identificar productos con stock bajo o agotados
  const isProductLowStock = (p: Product) => {
    const stock = Number(p.stock) || 0;
    const minStock = Number(p.min_stock) || 0;
    return stock <= minStock;
  };

  const lowStockCount = useMemo(() => {
    return products.filter(isProductLowStock).length;
  }, [products]);

  // Al abrir el modal, inicializar seleccionados y cantidades sugeridas
  useEffect(() => {
    if (open && products.length > 0) {
      const initialSelected = new Set<string>();
      const initialQuantities: Record<string, number> = {};

      products.forEach((p) => {
        const stock = Number(p.stock) || 0;
        const minStock = Number(p.min_stock) || 0;
        const isLow = stock <= minStock;

        // Cantidad sugerida: al menos la diferencia para llegar al mínimo o 1 si ya no hay mínimo definido
        const diff = minStock - stock;
        const suggested = diff > 0 ? diff : (stock <= 0 ? 1 : 1);
        initialQuantities[p.id] = Math.max(1, suggested);

        // Preseleccionar los que están por debajo o igual al stock mínimo
        if (isLow) {
          initialSelected.add(p.id);
        }
      });

      setSelectedProductIds(initialSelected);
      setQuantities(initialQuantities);
      setSearchTerm('');
      setOnlyLowStock(true);
      setIsCopied(false);
    }
  }, [open, products]);

  // Filtrado de productos para la tabla
  const displayedProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesLowStock = !onlyLowStock || isProductLowStock(p);
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.internal_code && p.internal_code.toLowerCase().includes(q)) ||
        (p.category?.name && p.category.name.toLowerCase().includes(q));

      return matchesLowStock && matchesSearch;
    });
  }, [products, onlyLowStock, searchTerm]);

  // Productos efectivamente seleccionados para la orden
  const orderItems = useMemo(() => {
    return products
      .filter((p) => selectedProductIds.has(p.id))
      .map((p) => {
        const qty = quantities[p.id] || 1;
        const cost = Number(p.cost) || 0;
        const subtotal = qty * cost;
        return {
          product: p,
          quantity: qty,
          cost,
          subtotal,
        };
      });
  }, [products, selectedProductIds, quantities]);

  // Métricas totales de la orden
  const orderMetrics = useMemo(() => {
    const totalItems = orderItems.length;
    const totalUnits = orderItems.reduce((acc, item) => acc + item.quantity, 0);
    const totalCost = orderItems.reduce((acc, item) => acc + item.subtotal, 0);
    return { totalItems, totalUnits, totalCost };
  }, [orderItems]);

  // Toggle de selección
  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllDisplayed = () => {
    const allSelected = displayedProducts.every((p) => selectedProductIds.has(p.id));
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      displayedProducts.forEach((p) => {
        if (allSelected) {
          next.delete(p.id);
        } else {
          next.add(p.id);
        }
      });
      return next;
    });
  };

  // Cambio de cantidad a pedir
  const updateQuantity = (id: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[id] || 1;
      const nextVal = Math.max(1, current + delta);
      return { ...prev, [id]: nextVal };
    });
  };

  const setExactQuantity = (id: string, value: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, isNaN(value) ? 1 : value),
    }));
  };

  // 1. EXPORTAR A EXCEL (.xlsx)
  const handleExportExcel = () => {
    if (orderItems.length === 0) {
      toast({
        title: 'Orden vacía',
        description: 'Debes seleccionar al menos un producto para exportar la orden de compra.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const headerRows = [
        ['ORDEN DE COMPRA DE PRODUCTOS'],
        ['Número de Orden:', orderNumber],
        ['Fecha de Emisión:', format(new Date(), "dd/MM/yyyy hh:mm a", { locale: es })],
        [''],
        ['DATOS DE LA EMPRESA SOLICITANTE'],
        ['Nombre Comercial:', companyInfo?.name || 'Mi Negocio'],
        ['RNC / Cédula:', companyInfo?.rnc || '—'],
        ['Teléfono:', companyInfo?.phone || '—'],
        ['Dirección:', companyInfo?.address || '—'],
        [''],
        ['DATOS DEL PROVEEDOR'],
        ['Proveedor:', supplier?.name || '—'],
        ['RNC:', supplier?.rnc || '—'],
        ['Teléfono:', supplier?.phone || (supplier as any)?.contact_phone || '—'],
        ['Contacto:', supplier?.contact || (supplier as any)?.contact_person || '—'],
        [''],
        ['DETALLE DE PRODUCTOS SOLICITADOS'],
      ];

      const tableData = orderItems.map((item, idx) => ({
        '#': idx + 1,
        'Código': item.product.barcode || item.product.internal_code || 'S/C',
        'Producto': item.product.name,
        'Categoría': item.product.category?.name || 'General',
        'Stock Actual': Number(item.product.stock) || 0,
        'Stock Mínimo': Number(item.product.min_stock) || 0,
        'Cantidad Solicitada': item.quantity,
        'Costo Unitario (RD$)': item.cost,
        'Subtotal Estimado (RD$)': item.subtotal,
      }));

      // Fila de totales
      const totalRow = {
        '#': '',
        'Código': '',
        'Producto': 'TOTALES GENERALES',
        'Categoría': '',
        'Stock Actual': '',
        'Stock Mínimo': '',
        'Cantidad Solicitada': orderMetrics.totalUnits,
        'Costo Unitario (RD$)': '',
        'Subtotal Estimado (RD$)': orderMetrics.totalCost,
      };

      const ws = XLSX.utils.aoa_to_sheet(headerRows);
      XLSX.utils.sheet_add_json(ws, [...tableData, totalRow], { origin: -1, skipHeader: false });

      // Configurar anchos de columna
      ws['!cols'] = [
        { wch: 6 },
        { wch: 18 },
        { wch: 36 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 20 },
        { wch: 20 },
        { wch: 22 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Orden de Compra');

      const safeSupplierName = (supplier?.name || 'Proveedor').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Orden_Compra_${safeSupplierName}_${format(new Date(), 'yyyyMMdd')}.xlsx`;

      XLSX.writeFile(wb, filename);

      toast({
        title: 'Orden exportada a Excel',
        description: `Se ha descargado el archivo ${filename} con éxito.`,
      });
    } catch (err: any) {
      console.error('Error al exportar orden a Excel:', err);
      toast({
        title: 'Error al exportar',
        description: err.message || 'No se pudo generar el archivo de Excel.',
        variant: 'destructive',
      });
    }
  };

  // 2. IMPRIMIR / DESCARGAR PDF PROFESIONAL
  const handlePrint = () => {
    if (orderItems.length === 0) {
      toast({
        title: 'Orden vacía',
        description: 'Debes seleccionar al menos un producto para imprimir la orden.',
        variant: 'destructive',
      });
      return;
    }

    const printWindow = window.open('', '', 'width=900,height=900');
    if (!printWindow) {
      toast({
        title: 'Ventana bloqueada',
        description: 'Por favor permite las ventanas emergentes en tu navegador para imprimir.',
        variant: 'destructive',
      });
      return;
    }

    const businessName = companyInfo?.name || 'Mi Negocio';
    const businessRnc = companyInfo?.rnc ? `RNC: ${companyInfo.rnc}` : '';
    const businessPhone = companyInfo?.phone ? `Tel: ${companyInfo.phone}` : '';
    const businessAddress = companyInfo?.address || '';
    const supplierName = supplier?.name || 'Proveedor';
    const supplierRnc = supplier?.rnc ? `RNC: ${supplier.rnc}` : '';
    const supplierPhone = (supplier?.phone || (supplier as any)?.contact_phone) ? `Tel: ${supplier?.phone || (supplier as any)?.contact_phone}` : '';
    const supplierContact = (supplier?.contact || (supplier as any)?.contact_person) ? `Contacto: ${supplier?.contact || (supplier as any)?.contact_person}` : '';
    const formattedDate = format(new Date(), "dd 'de' MMMM, yyyy - hh:mm a", { locale: es });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <title>Orden de Compra - ${orderNumber}</title>
          <style>
            @page {
              size: letter portrait;
              margin: 12mm 14mm;
            }
            *, *:before, *:after {
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #1e293b;
              background: #fff;
              font-size: 11px;
              line-height: 1.4;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page-container {
              width: 100%;
              padding: 4px 6px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2.5px solid #059669;
              padding-bottom: 12px;
              margin-bottom: 16px;
              gap: 16px;
            }
            .company-block {
              display: flex;
              align-items: center;
              gap: 12px;
              min-width: 0;
            }
            .company-logo {
              max-height: 55px;
              max-width: 110px;
              object-fit: contain;
              border-radius: 4px;
            }
            .company-info h1 {
              font-size: 19px;
              font-weight: 900;
              color: #047857;
              margin: 0 0 3px 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              line-height: 1.2;
            }
            .company-info p {
              margin: 2px 0;
              color: #475569;
              font-size: 10px;
              line-height: 1.3;
            }
            .order-badge-container {
              text-align: right;
              display: flex;
              flex-direction: column;
              align-items: flex-end;
              shrink: 0;
            }
            .order-title {
              display: inline-block;
              background: #059669;
              color: #ffffff;
              padding: 5px 14px;
              border-radius: 6px;
              font-size: 12.5px;
              font-weight: 800;
              letter-spacing: 0.8px;
              text-transform: uppercase;
            }
            .order-number {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
              font-size: 13.5px;
              font-weight: 800;
              color: #0f172a;
              margin-top: 5px;
              letter-spacing: 0.5px;
            }
            .order-date {
              font-size: 9.5px;
              color: #64748b;
              margin-top: 2px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 14px;
              margin-bottom: 16px;
            }
            .info-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 10px 14px;
            }
            .info-box h3 {
              margin: 0 0 6px 0;
              font-size: 9.5px;
              font-weight: 800;
              text-transform: uppercase;
              color: #047857;
              letter-spacing: 0.6px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
            }
            .info-box p {
              margin: 2.5px 0;
              font-size: 10.5px;
              color: #334155;
            }
            .info-box strong {
              color: #0f172a;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
            }
            th {
              background: #1e293b;
              color: #ffffff;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 7px 6px;
              text-align: left;
              border: 1px solid #1e293b;
            }
            td {
              padding: 6px 7px;
              border: 1px solid #e2e8f0;
              font-size: 10px;
              color: #1e293b;
              vertical-align: middle;
            }
            tr:nth-child(even) td {
              background: #f8fafc;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-mono {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
              font-size: 9.5px;
              letter-spacing: -0.2px;
            }
            .qty-badge {
              display: inline-block;
              background: #ecfdf5;
              color: #047857;
              font-weight: 800;
              font-size: 11px;
              padding: 1.5px 7px;
              border-radius: 4px;
              border: 1px solid #a7f3d0;
            }
            .bottom-layout {
              display: grid;
              grid-template-columns: 1fr 280px;
              gap: 16px;
              align-items: start;
              margin-bottom: 24px;
            }
            .notes-box {
              background: #fffbeb;
              border: 1px solid #fef3c7;
              border-radius: 8px;
              padding: 8px 12px;
              font-size: 10px;
              color: #92400e;
              line-height: 1.4;
            }
            .notes-title {
              font-weight: 800;
              text-transform: uppercase;
              margin-bottom: 3px;
              letter-spacing: 0.4px;
            }
            .notes-disclaimer {
              font-size: 9.5px;
              color: #64748b;
              line-height: 1.5;
              padding: 6px 0;
            }
            .totals-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 10px 14px;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              padding: 3px 0;
              font-size: 10.5px;
              color: #475569;
            }
            .totals-row.grand-total {
              border-top: 1.5px solid #059669;
              margin-top: 5px;
              padding-top: 6px;
              color: #0f172a;
              font-size: 12.5px;
              font-weight: 900;
            }
            .signatures {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 50px;
              margin-top: 36px;
              padding-top: 10px;
            }
            .signature-box {
              text-align: center;
            }
            .signature-line {
              border-top: 1.5px solid #94a3b8;
              padding-top: 6px;
              font-size: 10px;
              font-weight: 700;
              color: #475569;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .signature-sub {
              font-size: 9.5px;
              color: #64748b;
              margin-top: 2px;
            }
            .footer {
              text-align: center;
              font-size: 9px;
              color: #94a3b8;
              margin-top: 20px;
              border-top: 1px solid #e2e8f0;
              padding-top: 8px;
            }
            @media print {
              body { padding: 0; }
              .page-container { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="page-container">
            <div class="header">
              <div class="company-block">
                ${companyInfo?.logo ? `<img src="${companyInfo.logo}" alt="Logo" class="company-logo" />` : ''}
                <div class="company-info">
                  <h1>${businessName}</h1>
                  ${businessRnc ? `<p><strong>${businessRnc}</strong></p>` : ''}
                  ${businessPhone ? `<p>${businessPhone}</p>` : ''}
                  ${businessAddress ? `<p>${businessAddress}</p>` : ''}
                </div>
              </div>
              <div class="order-badge-container">
                <span class="order-title">Orden de Compra</span>
                <div class="order-number">${orderNumber}</div>
                <div class="order-date">${formattedDate}</div>
              </div>
            </div>

            <div class="info-grid">
              <div class="info-box">
                <h3>Datos del Proveedor</h3>
                <p><strong>${supplierName}</strong></p>
                ${supplierRnc ? `<p>${supplierRnc}</p>` : ''}
                ${supplierPhone ? `<p>${supplierPhone}</p>` : ''}
                ${supplierContact ? `<p>${supplierContact}</p>` : ''}
              </div>
              <div class="info-box">
                <h3>Condiciones y Estado</h3>
                <p><strong>Fecha requerida:</strong> Inmediata / Según disponibilidad</p>
                <p><strong>Tipo de Solicitud:</strong> Reposición de Inventario</p>
                <p><strong>Moneda:</strong> Pesos Dominicanos (RD$)</p>
                <p><strong>Estado:</strong> Solicitud Emitida</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 26px;" class="text-center">#</th>
                  <th style="width: 100px;">Código</th>
                  <th>Descripción del Producto</th>
                  <th style="width: 75px;">Categoría</th>
                  <th style="width: 48px;" class="text-center">Stock</th>
                  <th style="width: 48px;" class="text-center">Mínimo</th>
                  <th style="width: 55px;" class="text-center">Cant.</th>
                  <th style="width: 82px;" class="text-right">Costo (RD$)</th>
                  <th style="width: 88px;" class="text-right">Subtotal (RD$)</th>
                </tr>
              </thead>
              <tbody>
                ${orderItems.map((item, index) => {
                  const code = item.product.barcode || item.product.internal_code;
                  return `
                    <tr>
                      <td class="text-center">${index + 1}</td>
                      <td class="font-mono text-center">${code || '<span style="color: #94a3b8;">—</span>'}</td>
                      <td>${item.product.name}</td>
                      <td style="color: #64748b; font-size: 9.5px;">${item.product.category?.name || 'General'}</td>
                      <td class="text-center font-mono">${item.product.stock}</td>
                      <td class="text-center font-mono" style="color: #64748b;">${item.product.min_stock || 0}</td>
                      <td class="text-center">
                        <span class="qty-badge">${item.quantity}</span>
                      </td>
                      <td class="text-right font-mono">
                        ${item.cost > 0 ? item.cost.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                      </td>
                      <td class="text-right font-mono" style="font-weight: 700; color: #0f172a;">
                        ${item.subtotal > 0 ? item.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div class="bottom-layout">
              <div>
                ${notes ? `
                  <div class="notes-box">
                    <div class="notes-title">Observaciones / Instrucciones de Entrega:</div>
                    <div>${notes.replace(/\n/g, '<br/>')}</div>
                  </div>
                ` : `
                  <div class="notes-disclaimer">
                    <em>* Esta orden de compra es una solicitud formal de reposición de mercancía. Favor confirmar precios vigentes y fecha de entrega.</em>
                  </div>
                `}
              </div>
              <div class="totals-box">
                <div class="totals-row">
                  <span>Artículos diferentes:</span>
                  <strong>${orderMetrics.totalItems}</strong>
                </div>
                <div class="totals-row">
                  <span>Total unidades:</span>
                  <strong>${orderMetrics.totalUnits} uds</strong>
                </div>
                <div class="totals-row grand-total">
                  <span>Total Estimado:</span>
                  <span style="color: #047857;">RD$ ${orderMetrics.totalCost.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div class="signatures">
              <div class="signature-box">
                <div style="height: 45px;"></div>
                <div class="signature-line">Autorizado por (Firma y Sello)</div>
                <div class="signature-sub">${businessName}</div>
              </div>
              <div class="signature-box">
                <div style="height: 45px;"></div>
                <div class="signature-line">Recibido y Conforme</div>
                <div class="signature-sub">${supplierName}</div>
              </div>
            </div>

            <div class="footer">
              Documento generado por Cobro App • ${formattedDate}
            </div>
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

  // 3. GENERAR MENSAJE PARA WHATSAPP / COPIAR AL PORTAPAPELES
  const generateTextMessage = () => {
    const businessName = companyInfo?.name || 'Mi Negocio';
    const supplierName = supplier?.name || 'Estimado Proveedor';
    const dateStr = format(new Date(), "dd/MM/yyyy", { locale: es });

    let msg = `📦 *ORDEN DE COMPRA - ${businessName}*\n`;
    msg += `📄 *Orden N°:* ${orderNumber}\n`;
    msg += `👤 *Para:* ${supplierName}\n`;
    msg += `📅 *Fecha:* ${dateStr}\n\n`;
    msg += `*Artículos solicitados:*\n`;

    orderItems.forEach((item, idx) => {
      const code = item.product.barcode || item.product.internal_code;
      const codeStr = code ? ` [${code}]` : '';
      const costStr = item.cost > 0 ? ` (Ref: RD$ ${item.cost.toLocaleString('es-DO')})` : '';
      msg += `${idx + 1}. *${item.quantity} uds* - ${item.product.name}${codeStr}${costStr}\n`;
    });

    msg += `\n📊 *Total Unidades:* ${orderMetrics.totalUnits} uds`;
    if (orderMetrics.totalCost > 0) {
      msg += `\n💰 *Total Estimado:* RD$ ${orderMetrics.totalCost.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
    }

    if (notes.trim()) {
      msg += `\n\n📝 *Notas:* ${notes.trim()}`;
    }

    msg += `\n\n_Por favor confirmar disponibilidad y fecha de entrega. ¡Gracias!_`;

    return msg;
  };

  const handleSendWhatsApp = () => {
    if (orderItems.length === 0) {
      toast({
        title: 'Orden vacía',
        description: 'Debes seleccionar al menos un producto para enviar la orden.',
        variant: 'destructive',
      });
      return;
    }

    const text = generateTextMessage();
    const cleanPhone = (supplier?.phone || '').replace(/[^0-9]/g, '');

    let url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (cleanPhone) {
      const fullPhone = cleanPhone.length === 10 ? `1${cleanPhone}` : cleanPhone;
      url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`;
    }

    window.open(url, '_blank');
  };

  const handleCopyText = async () => {
    if (orderItems.length === 0) {
      toast({
        title: 'Orden vacía',
        description: 'Debes seleccionar al menos un producto para copiar la orden.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const text = generateTextMessage();
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast({
        title: 'Copiado al portapapeles',
        description: 'El resumen de la orden de compra ha sido copiado listo para pegar.',
      });
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      toast({
        title: 'Error al copiar',
        description: 'No se pudo copiar el texto al portapapeles.',
        variant: 'destructive',
      });
    }
  };

  if (!supplier) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] sm:max-w-4xl lg:max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-border/50 bg-background shadow-2xl">
        {/* Header con gradiente elegante */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950/30 via-muted/30 to-background border-b border-border/50 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-xs">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base sm:text-lg font-black text-foreground tracking-tight truncate">
                    Orden de Compra — {supplier.name}
                  </DialogTitle>
                  <Badge variant="outline" className="font-mono text-[10px] font-bold border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {orderNumber}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground truncate mt-0.5">
                  Genera la orden de reposición de artículos bajo stock mínimo para enviar al proveedor.
                </DialogDescription>
              </div>
            </div>

            {/* Métricas rápidas en el encabezado */}
            <div className="flex items-center gap-2 sm:gap-3 bg-card/60 p-1.5 sm:p-2 rounded-xl border border-border/40 shrink-0 self-start sm:self-auto">
              <div className="text-center px-2">
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Artículos</span>
                <span className="text-xs sm:text-sm font-black text-foreground">{orderMetrics.totalItems}</span>
              </div>
              <div className="h-6 w-px bg-border/40" />
              <div className="text-center px-2">
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Unidades</span>
                <span className="text-xs sm:text-sm font-black text-emerald-500">{orderMetrics.totalUnits}</span>
              </div>
              <div className="h-6 w-px bg-border/40" />
              <div className="text-center px-2">
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Costo Est.</span>
                <span className="text-xs sm:text-sm font-black text-foreground font-mono">
                  RD$ {orderMetrics.totalCost.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Filtros y Controles */}
        <div className="p-3 sm:px-5 border-b border-border/40 bg-muted/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar artículo por nombre, código o categoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 rounded-xl bg-background border-border/50 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Toggle para filtrar solo bajo stock */}
            <Button
              type="button"
              size="sm"
              variant={onlyLowStock ? 'default' : 'outline'}
              onClick={() => setOnlyLowStock(!onlyLowStock)}
              className={cn(
                "h-8 text-xs font-bold gap-1.5 rounded-xl transition-all",
                onlyLowStock 
                  ? "bg-amber-600 hover:bg-amber-500 text-white shadow-xs" 
                  : "text-muted-foreground"
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Solo Bajo Stock ({lowStockCount})</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={toggleSelectAllDisplayed}
              className="h-8 text-xs font-bold rounded-xl"
            >
              {displayedProducts.every((p) => selectedProductIds.has(p.id)) ? 'Deseleccionar' : 'Seleccionar Todos'}
            </Button>
          </div>
        </div>

        {/* Tabla Central con Scroll */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 min-h-[280px]">
          {displayedProducts.length === 0 ? (
            <div className="text-center py-12 px-4 bg-muted/10 rounded-2xl border border-dashed border-border/40">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm font-bold text-foreground">
                {onlyLowStock
                  ? 'No hay productos de este proveedor con stock por debajo del mínimo'
                  : 'No se encontraron productos con ese filtro'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                {onlyLowStock
                  ? 'Todos los productos asociados a este proveedor tienen existencias suficientes. Puedes desactivar el filtro "Solo Bajo Stock" para ordenar cualquier producto.'
                  : 'Intenta con otro término de búsqueda.'}
              </p>
              {onlyLowStock && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOnlyLowStock(false)}
                  className="mt-3 rounded-xl text-xs font-bold"
                >
                  Ver todos los {products.length} productos del proveedor
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/40 overflow-hidden bg-card/60 shadow-xs">
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 backdrop-blur-sm z-10">
                  <TableRow>
                    <TableHead className="w-10 text-center py-2.5">
                      <Checkbox
                        checked={
                          displayedProducts.length > 0 &&
                          displayedProducts.every((p) => selectedProductIds.has(p.id))
                        }
                        onCheckedChange={toggleSelectAllDisplayed}
                        aria-label="Seleccionar todo"
                      />
                    </TableHead>
                    <TableHead className="text-xs font-bold py-2.5">Producto</TableHead>
                    <TableHead className="text-xs font-bold py-2.5 hidden md:table-cell">Categoría</TableHead>
                    <TableHead className="text-center text-xs font-bold py-2.5">Stock Act.</TableHead>
                    <TableHead className="text-center text-xs font-bold py-2.5">Stock Mín.</TableHead>
                    <TableHead className="text-center text-xs font-bold py-2.5 w-32">Cant. a Pedir</TableHead>
                    <TableHead className="text-right text-xs font-bold py-2.5">Costo Unit.</TableHead>
                    <TableHead className="text-right text-xs font-bold py-2.5 pr-4">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedProducts.map((prod) => {
                    const isSelected = selectedProductIds.has(prod.id);
                    const stock = Number(prod.stock) || 0;
                    const minStock = Number(prod.min_stock) || 0;
                    const isLow = stock <= minStock;
                    const cost = Number(prod.cost) || 0;
                    const qty = quantities[prod.id] || 1;
                    const subtotal = qty * cost;

                    return (
                      <TableRow
                        key={prod.id}
                        className={cn(
                          "transition-colors cursor-pointer",
                          isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/20 opacity-75"
                        )}
                        onClick={() => toggleProduct(prod.id)}
                      >
                        <TableCell className="text-center py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleProduct(prod.id)}
                            aria-label={`Seleccionar ${prod.name}`}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            {prod.image_url ? (
                              <img
                                src={prod.image_url}
                                alt={prod.name}
                                className="h-7 w-7 rounded-lg object-cover border border-border/50 shrink-0"
                              />
                            ) : (
                              <div className="h-7 w-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0 border border-border/40">
                                <Package className="h-3.5 w-3.5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-foreground block truncate max-w-[200px] sm:max-w-[260px]">
                                {prod.name}
                              </span>
                              {(prod.barcode || prod.internal_code) && (
                                <span className="text-[9px] text-muted-foreground font-mono block">
                                  {prod.barcode || prod.internal_code}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground hidden md:table-cell">
                          {prod.category?.name || '—'}
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-bold py-0 h-5",
                              isLow
                                ? "border-red-500/30 text-red-500 bg-red-500/10 font-black"
                                : "border-border/60 text-muted-foreground bg-muted/30"
                            )}
                          >
                            {stock} uds
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-center text-xs font-mono text-muted-foreground">
                          {minStock} uds
                        </TableCell>
                        <TableCell className="py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              onClick={() => updateQuantity(prod.id, -1)}
                              disabled={qty <= 1}
                              className="h-6 w-6 rounded-md shrink-0 text-muted-foreground hover:text-foreground"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              value={qty}
                              onChange={(e) => setExactQuantity(prod.id, parseInt(e.target.value, 10))}
                              className="h-6 w-14 text-center font-bold text-xs p-0 rounded-md font-mono"
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              onClick={() => updateQuantity(prod.id, 1)}
                              className="h-6 w-6 rounded-md shrink-0 text-muted-foreground hover:text-foreground"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">
                          {cost > 0 ? `RD$ ${cost.toLocaleString('es-DO', { minimumFractionDigits: 2 })}` : '—'}
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono font-bold text-xs text-foreground pr-4">
                          {subtotal > 0 ? `RD$ ${subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}` : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Campo de Notas u Observaciones */}
          <div className="bg-card/40 border border-border/40 p-3 rounded-2xl space-y-1.5">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Observaciones o Instrucciones para el Proveedor (Opcional)
            </label>
            <Input
              placeholder="Ej: Favor entregar mañana antes de las 12:00 PM con factura con comprobante..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-8 rounded-xl bg-background border-border/50 text-xs"
            />
          </div>
        </div>

        {/* Footer con Acciones de Exportación */}
        <div className="p-3.5 sm:p-5 border-t border-border/40 bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-muted-foreground text-center sm:text-left">
            <span className="font-bold text-foreground">{orderMetrics.totalItems} artículos</span> ({orderMetrics.totalUnits} uds) seleccionados • Total Estimado:{' '}
            <strong className="text-emerald-500 font-mono text-sm">
              RD$ {orderMetrics.totalCost.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </strong>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end w-full sm:w-auto">
            {/* Botón WhatsApp */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendWhatsApp}
              disabled={orderItems.length === 0}
              className="h-9 rounded-xl text-xs font-bold gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 active:scale-95 transition-all"
              title="Enviar por WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </Button>

            {/* Botón Copiar Texto */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyText}
              disabled={orderItems.length === 0}
              className="h-9 rounded-xl text-xs font-bold gap-1.5 active:scale-95 transition-all"
              title="Copiar resumen al portapapeles"
            >
              {isCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              <span className="hidden sm:inline">{isCopied ? 'Copiado' : 'Copiar'}</span>
            </Button>

            {/* Botón Excel */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={orderItems.length === 0}
              className="h-9 rounded-xl text-xs font-bold gap-1.5 border-emerald-600/30 text-foreground hover:bg-emerald-500/10 active:scale-95 transition-all shadow-xs"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              <span>Exportar Excel</span>
            </Button>

            {/* Botón Imprimir / PDF */}
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              disabled={orderItems.length === 0}
              className="h-9 rounded-xl text-xs font-black gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir / PDF</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
