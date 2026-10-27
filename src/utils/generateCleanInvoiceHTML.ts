// Utility to generate clean, black & white invoice HTML matching the selected Paper Size (80mm, 58mm, A4, Carta)

export interface InvoiceData {
  invoiceNumber: string;
  invoicePrefix: string;
  date: Date;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
    comment?: string;
  }>;
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  currency: string;
  paymentTerms?: string;
  footerText?: string;
  showBarcode?: boolean;
  barcodeDataUrl?: string;
  loyaltyPoints?: number;
  loyaltyPointsEarned?: number;
  customerName?: string;
  customerRnc?: string;
  customerPhone?: string;
  customerAddress?: string;
  cashierName?: string;
  paymentMethod?: string;
  amountPaid?: number;
  change?: number;
  isElectronic?: boolean;
  isQuotation?: boolean;
  encf?: string;
  securityCode?: string;
  signatureDate?: string;
  qrCodeUrl?: string;
  bankAccounts?: Array<{
    id?: string;
    bank_name: string;
    account_number: string;
    account_type?: string;
    holder_name?: string;
    rnc_cedula?: string;
    alias?: string;
  }>;
}

export interface CompanyData {
  name: string;
  logo?: string;
  logoSize?: number;
  rnc?: string;
  phone?: string;
  address?: string;
  email?: string;
  pageMargin?: string;
  containerPadding?: string;
  logoMarginBottom?: string;
  logoWidth?: 'auto' | 'full';
  fontSize?: number;
  paperSize?: '80mm' | '58mm' | 'A4' | 'carta' | string;
}

export const generateCleanInvoiceHTML = (
  companyData: CompanyData,
  invoiceData: InvoiceData
): string => {
  const paperSizeNorm = (companyData.paperSize || '80mm').toLowerCase();
  const is58mm = paperSizeNorm === '58mm';
  const isA4 = paperSizeNorm === 'a4';
  const isCarta = paperSizeNorm === 'carta' || paperSizeNorm === 'letter';
  const isFullPage = isA4 || isCarta;

  const logoHeight = companyData.logoSize ? Math.max(companyData.logoSize, 90) : (isFullPage ? 95 : 60);
  // 58mm sube de 9.5 a 11 — a los ~168 DPI reales de una térmica de 58mm
  // (384 dots de ancho), el tamaño anterior quedaba demasiado chico para
  // sobrevivir la conversión a blanco/negro sin volverse ilegible.
  const baseFontSize = companyData.fontSize || (isFullPage ? 13 : is58mm ? 11 : 12);

  // Helper to format currency with thousands separators (e.g. 1,529.66)
  const fmt = (num: number | undefined): string => {
    return (num || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const pmLower = (invoiceData.paymentMethod || '').toLowerCase();
  const isCreditSale = pmLower === 'credit' || pmLower.includes('crédito') || pmLower.includes('credito');

  const formattedDateStr = invoiceData.date.toLocaleDateString('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const formattedTimeStr = invoiceData.date.toLocaleTimeString('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const pMethod = (() => {
    const raw = (invoiceData.paymentMethod || '').trim().toLowerCase();
    const map: Record<string, string> = {
      cash: 'Efectivo',
      efectivo: 'Efectivo',
      card: 'Tarjeta',
      tarjeta: 'Tarjeta',
      transfer: 'Transferencia',
      transferencia: 'Transferencia',
      credit: 'Crédito',
      credito: 'Crédito',
      crédito: 'Crédito',
      check: 'Cheque',
      cheque: 'Cheque',
      split: 'Pago Mixto',
      mixto: 'Pago Mixto',
      pending: 'Pendiente',
      pendiente: 'Pendiente',
      contado: 'Al Contado',
    };
    return map[raw] || invoiceData.paymentMethod?.trim() || 'Efectivo';
  })();
  const rawInvoiceNum = invoiceData.invoiceNumber || '000000';
  const isQuotation = Boolean(invoiceData.isQuotation || rawInvoiceNum.startsWith('COT') || invoiceData.invoicePrefix === 'COT');
  const isInternalInvoice = !isQuotation && (rawInvoiceNum.startsWith('FAC') || invoiceData.invoicePrefix === 'FAC' || (invoiceData as any).invoiceType === 'FAC');
  const hasElectronicStyle = Boolean(invoiceData.isElectronic && !isInternalInvoice && !isQuotation);
  const hasTax = Boolean(invoiceData.taxRate > 0 && (invoiceData.tax || 0) > 0.005);

  const effectiveSecurityCode = (() => {
    if (invoiceData.securityCode && invoiceData.securityCode !== 'undefined') return invoiceData.securityCode;
    const seed = invoiceData.encf || rawInvoiceNum || 'FAC0000000001';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let fallbackCode = '';
    for (let i = 0; i < 6; i++) {
      const index = Math.abs((hash + i * 13) % chars.length);
      fallbackCode += chars[index];
    }
    return fallbackCode;
  })();

  const effectiveSignatureDate = (() => {
    const raw = invoiceData.signatureDate || invoiceData.date;
    try {
      const d = raw instanceof Date ? raw : new Date(raw);
      if (isNaN(d.getTime())) return String(raw);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
    } catch {
      return String(raw || '');
    }
  })();

  const effectiveQrCodeUrl = (() => {
    if (isInternalInvoice || isQuotation) return '';
    if (invoiceData.qrCodeUrl) return invoiceData.qrCodeUrl;
    if (!hasElectronicStyle) return '';
    const emisorRnc = (companyData.rnc || '').replace(/[^0-9]/g, '');
    const receptorRnc = (invoiceData.customerRnc || '').replace(/[^0-9]/g, '');
    const docCode = invoiceData.encf || rawInvoiceNum;
    return `https://ecf.dgii.gov.do/EstadoseCF/ConsultaeCF?RncEmisor=${emisorRnc}&RncComprador=${receptorRnc}&ENCF=${docCode}&MontoTotal=${invoiceData.total}&CodigoSeguridad=${effectiveSecurityCode}&FechaFirma=${encodeURIComponent(effectiveSignatureDate)}`;
  })();
  const displayNCF = isQuotation
    ? rawInvoiceNum
    : (invoiceData.isElectronic
      ? (invoiceData.encf || rawInvoiceNum)
      : rawInvoiceNum);

  const displayPrefix = invoiceData.invoicePrefix || 'FAC-';
  const fullInvoiceCode = rawInvoiceNum.startsWith('FAC-') || rawInvoiceNum.startsWith('E') || rawInvoiceNum.startsWith('B') || rawInvoiceNum.startsWith('COT')
    ? rawInvoiceNum
    : `${displayPrefix}${rawInvoiceNum}`;

  const customerTypeLabel = isQuotation
    ? 'Presupuesto'
    : (invoiceData.customerName && invoiceData.customerName.toUpperCase() !== 'CLIENTE FINAL' && invoiceData.customerName.toUpperCase() !== 'CONSUMIDOR FINAL'
      ? 'Comprobante Fiscal'
      : 'Consumidor Final');

  const companyInitials = companyData.name
    ? companyData.name.split(' ').map(w => w[0]).join('').substring(0, 8).toUpperCase()
    : 'POS';

  // ==========================================
  // FULL PAGE TEMPLATE (A4 & CARTA)
  // ==========================================
  if (isFullPage) {
    const pageCSS = isCarta ? 'letter portrait' : 'A4 portrait';
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Factura ${displayNCF}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { 
      size: ${pageCSS}; 
      margin: 0; 
    }
    html, body {
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #18181b !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: ${baseFontSize}px;
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .invoice-sheet {
      position: relative;
      width: 100%;
      max-width: ${isCarta ? '215.9mm' : '210mm'};
      min-height: ${isCarta ? '279.4mm' : '297mm'};
      margin: 0 auto;
      padding: 0 !important;
      background: #ffffff;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }
    
    .invoice-content {
      position: relative;
      display: flex;
      flex-direction: column;
      flex: 1 0 auto;
      padding: 8mm 10mm 4mm 10mm;
      box-sizing: border-box;
    }

    .items-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-top: 6px;
      margin-bottom: 8px;
    }
    .items-table th {
      background: #18181b !important;
      color: #ffffff !important;
      padding: 10px 14px;
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: none !important;
    }
    .items-table th:first-child {
      border-top-left-radius: 6px;
      border-bottom-left-radius: 6px;
    }
    .items-table th:last-child {
      border-top-right-radius: 6px;
      border-bottom-right-radius: 6px;
    }
    .items-table td {
      padding: 11px 14px;
      border-bottom: 1px solid #f0f0f2;
      border-left: none !important;
      border-right: none !important;
      border-top: none !important;
      font-size: 12px;
      color: #18181b;
      vertical-align: middle;
    }

    .tabular-numbers {
      font-family: 'JetBrains Mono', 'Roboto Mono', ui-monospace, SFMono-Regular, monospace;
      font-variant-numeric: tabular-nums;
    }

    @media print {
      * { 
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important; 
        color-adjust: exact !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
      .invoice-sheet {
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        min-height: 100vh !important;
        height: 100vh !important;
        page-break-after: avoid !important;
      }
      .invoice-content {
        padding: 8mm 10mm 4mm 10mm !important;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-sheet">
    
    <!-- CONTENIDO DE LA FACTURA -->
    <div class="invoice-content">
      
      <!-- Encabezado Superior: Logo Grande / Empresa (Izq) y Título (Der) -->
      <div style="position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; gap: 20px;">
        <div style="max-width: 58%;">
          ${companyData.logo ? `
            <img src="${companyData.logo}" alt="Logo" style="max-height: ${logoHeight}px; max-width: 290px; width: auto; object-fit: contain; margin-bottom: 6px; display: block;" />
          ` : `
            <div style="display: inline-flex; align-items: center; justify-content: center; background: #18181b; color: #ffffff; padding: 10px 20px; border-radius: 8px; font-weight: 900; font-size: 18px; letter-spacing: 0.05em; margin-bottom: 8px;">
              ${companyInitials}
            </div>
          `}
          <div style="font-size: 16px; font-weight: 800; color: #18181b; letter-spacing: -0.02em; line-height: 1.2;">
            ${companyData.name}
          </div>
          <div style="font-size: 11px; color: #71717a; line-height: 1.45; margin-top: 3px;">
            ${companyData.rnc ? `<span><strong>RNC:</strong> ${companyData.rnc}</span> ` : ''}
            ${companyData.phone ? `<span>• <strong>Tel:</strong> ${companyData.phone}</span> ` : ''}
            ${companyData.email ? `<div><strong>Email:</strong> ${companyData.email}</div>` : ''}
            ${companyData.address ? `<div>${companyData.address}</div>` : ''}
          </div>
        </div>

        <div style="text-align: right; margin-top: 2px; max-width: 42%;">
          <h1 style="font-size: 24px; font-weight: 900; color: #18181b; letter-spacing: -0.02em; margin: 0 0 6px 0; line-height: 1.15; text-transform: uppercase;">
            ${isQuotation ? 'Presupuesto' : (isInternalInvoice ? 'Factura Interna' : (invoiceData.isElectronic ? 'Factura Electrónica' : 'Factura Fiscal'))}
          </h1>
          <div>
            <span style="display: inline-block; background: #18181b; color: #ffffff; font-size: 9.5px; font-weight: 800; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.06em; text-transform: uppercase;">
              ${isQuotation ? 'COTIZACIÓN' : (isInternalInvoice ? 'CONTROL INTERNO' : customerTypeLabel)}
            </span>
          </div>
        </div>
      </div>

      <!-- Cuadro Minimalista Moderno de Datos (Cliente y Documento) -->
      <div style="position: relative; z-index: 1; background: #fbfbfc; border: 1px solid #ebecee; border-radius: 10px; padding: 13px 18px; margin-bottom: 14px; display: grid; grid-template-columns: 1.25fr 1fr; gap: 20px; font-size: 12px; line-height: 1.5;">
        <div>
          <div style="font-size: 9.5px; font-weight: 800; letter-spacing: 0.08em; color: #a1a1aa; text-transform: uppercase; margin-bottom: 2px;">
            Facturado a
          </div>
          <div style="font-size: 14.5px; font-weight: 800; color: #18181b; margin-bottom: 3px;">
            ${(invoiceData.customerName || 'Consumidor Final')}
          </div>
          ${invoiceData.customerRnc ? `<div><span style="color: #71717a;">RNC / Cédula:</span> <strong style="color: #27272a;">${invoiceData.customerRnc}</strong></div>` : ''}
          ${invoiceData.customerPhone ? `<div><span style="color: #71717a;">Teléfono:</span> <span style="color: #3f3f46;">${invoiceData.customerPhone}</span></div>` : ''}
          ${invoiceData.customerAddress ? `<div><span style="color: #71717a;">Dirección:</span> <span style="color: #3f3f46;">${invoiceData.customerAddress}</span></div>` : ''}
        </div>
        <div style="border-left: 1px solid #ebecee; padding-left: 18px; display: flex; flex-direction: column; justify-content: center; gap: 3px;">
          <div><span style="color: #71717a;">Fecha de Emisión:</span> <strong style="color: #18181b;">${formattedDateStr}</strong></div>
          <div><span style="color: #71717a;">No. Comprobante:</span> <span class="tabular-numbers" style="font-family: 'JetBrains Mono', monospace; font-size: 13.5px; font-weight: 800; color: #18181b; letter-spacing: 0.02em;">${displayNCF}</span></div>
          <div><span style="color: #71717a;">Condición de Pago:</span> <strong style="color: #18181b;">${pMethod}${isCreditSale && invoiceData.paymentTerms ? ` (${invoiceData.paymentTerms} días)` : ''}</strong></div>
          ${invoiceData.cashierName ? `<div><span style="color: #a1a1aa;">Atendido por:</span> <span style="color: #71717a;">${invoiceData.cashierName}</span></div>` : ''}
        </div>
      </div>

      <!-- Tabla de Artículos / Servicios Estilo Minimalista y Moderno -->
      <table class="items-table" style="width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 4px; margin-bottom: 10px;">
        <thead>
          <tr>
            <th style="background: #18181b !important; color: #ffffff !important; padding: 10px 14px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; border-top-left-radius: 8px; border-bottom-left-radius: 8px; text-align: left; width: ${hasTax ? '48%' : '58%'}; border: none;">
              Servicio / Descripción
            </th>
            <th style="background: #18181b !important; color: #ffffff !important; padding: 10px 14px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; text-align: center; width: 10%; border: none;">
              Cant.
            </th>
            <th style="background: #18181b !important; color: #ffffff !important; padding: 10px 14px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; text-align: right; width: 16%; border: none;">
              Precio
            </th>
            ${hasTax ? `
              <th style="background: #18181b !important; color: #ffffff !important; padding: 10px 14px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; text-align: right; width: 12%; border: none;">
                ITBIS
              </th>
            ` : ''}
            <th style="background: #18181b !important; color: #ffffff !important; padding: 10px 14px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; border-top-right-radius: 8px; border-bottom-right-radius: 8px; text-align: right; width: 16%; border: none;">
              Total (${invoiceData.currency})
            </th>
          </tr>
        </thead>
        <tbody>
          ${invoiceData.items && invoiceData.items.length > 0 ? invoiceData.items.map((item, idx) => {
            const itemTax = hasTax ? (item.total - (item.total / (1 + invoiceData.taxRate / 100))) : 0;
            return `
              <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#fafafa'};">
                <td style="padding: 11px 14px; border-bottom: 1px solid #f0f0f2; vertical-align: middle;">
                  <div style="font-weight: 700; color: #18181b; font-size: 12.5px;">${item.name}</div>
                  ${item.comment ? `<div style="font-size: 10.5px; color: #71717a; margin-top: 2px; line-height: 1.35;">${item.comment}</div>` : ''}
                </td>
                <td style="padding: 11px 14px; border-bottom: 1px solid #f0f0f2; text-align: center; font-weight: 700; color: #18181b; vertical-align: middle;">
                  <span style="display: inline-block; background: #f4f4f5; padding: 2px 7px; border-radius: 4px; font-size: 11px;">${item.quantity}</span>
                </td>
                <td class="tabular-numbers" style="padding: 11px 14px; border-bottom: 1px solid #f0f0f2; text-align: right; color: #3f3f46; font-size: 12px; vertical-align: middle;">
                  ${fmt(item.price)}
                </td>
                ${hasTax ? `
                  <td class="tabular-numbers" style="padding: 11px 14px; border-bottom: 1px solid #f0f0f2; text-align: right; color: #71717a; font-size: 12px; vertical-align: middle;">
                    ${fmt(itemTax)}
                  </td>
                ` : ''}
                <td class="tabular-numbers" style="padding: 11px 14px; border-bottom: 1px solid #f0f0f2; text-align: right; font-weight: 800; color: #18181b; font-size: 12.5px; vertical-align: middle;">
                  ${fmt(item.total)}
                </td>
              </tr>
            `;
          }).join('') : `
            <tr>
              <td colspan="${hasTax ? 5 : 4}" style="text-align: center; padding: 22px; color: #a1a1aa; font-style: italic;">Sin conceptos o servicios registrados</td>
            </tr>
          `}
        </tbody>
      </table>

      <!-- Sección Inferior: Cuentas Bancarias / QR (Izq) y Totales (Der) -->
      <div style="display: grid; grid-template-columns: 1.35fr 1fr; gap: 22px; align-items: start; margin-top: 2px;">
        
        <!-- Columna Izquierda: Cuentas Bancarias y/o QR DGII -->
        <div style="display: flex; flex-direction: column; gap: 9px;">
          
          <!-- Cuentas Bancarias para Transferencias (Diseño Minimalista) -->
          ${invoiceData.bankAccounts && invoiceData.bankAccounts.length > 0 ? `
            <div style="background: #fbfbfc; border: 1px solid #ebecee; border-radius: 10px; padding: 10px 13px; width: 100%; box-sizing: border-box;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f0f0f2; padding-bottom: 4px; margin-bottom: 5px;">
                <span style="font-size: 9.5px; font-weight: 800; color: #18181b; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 4px;">
                  🏦 Cuentas para Transferencia
                </span>
                <span style="font-size: 8.5px; color: #a1a1aa; font-weight: 500;">Notificar pago</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 5px;">
                ${invoiceData.bankAccounts.map((acc: any) => `
                  <div style="font-size: 10.5px; line-height: 1.35; color: #3f3f46; background: #ffffff; border: 1px solid #eef0f2; border-radius: 6px; padding: 5px 9px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <strong style="color: #18181b; font-size: 11px;">${acc.bank_name}${acc.alias ? ` (${acc.alias})` : ''}</strong>
                      ${acc.account_type ? `<span style="font-size: 9px; color: #52525b; background: #f4f4f5; padding: 1px 5px; border-radius: 4px; text-transform: capitalize; font-weight: 600;">${acc.account_type}</span>` : ''}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 2px;">
                      <div>
                        <span style="color: #a1a1aa; font-size: 9px; font-weight: 600;">No:</span>
                        <span style="font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #0284c7; font-size: 11.5px; letter-spacing: 0.02em;">${acc.account_number}</span>
                      </div>
                      ${acc.holder_name ? `<span style="font-size: 9px; color: #52525b; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${acc.holder_name}</span>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Si es Fiscal (NO interna): Código QR DGII debajo de las cuentas bancarias -->
          ${hasElectronicStyle && effectiveQrCodeUrl ? `
            <div style="display: flex; align-items: center; gap: 12px; background: #fbfbfc; border: 1px solid #ebecee; border-radius: 10px; padding: 8px 12px; width: 100%; box-sizing: border-box;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(effectiveQrCodeUrl)}" alt="Código QR DGII" style="width: 58px; height: 58px; border-radius: 6px; background: #ffffff; padding: 2px; border: 1px solid #e4e4e7; flex-shrink: 0;" />
              <div style="font-size: 9.5px; line-height: 1.35; color: #52525b;">
                <div style="font-weight: 800; color: #0284c7; text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.04em; margin-bottom: 2px;">
                  Comprobante Autorizado por la DGII
                </div>
                ${effectiveSecurityCode ? `<div><strong style="color: #18181b;">Cód. Seguridad:</strong> <span class="tabular-numbers" style="font-family: 'JetBrains Mono', monospace;">${effectiveSecurityCode}</span></div>` : ''}
                ${effectiveSignatureDate ? `<div><strong style="color: #18181b;">Firma Digital:</strong> <span class="tabular-numbers">${effectiveSignatureDate}</span></div>` : ''}
              </div>
            </div>
          ` : ''}

        </div>

        <!-- Columna Derecha: Totales Modernos -->
        <div style="display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-start;">
          <div style="width: 100%; max-width: 240px;">
            ${hasTax ? `
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: #71717a; margin-bottom: 4px; padding: 0 4px;">
                <span>Subtotal:</span>
                <span class="tabular-numbers" style="font-weight: 600; color: #18181b;">${invoiceData.currency} ${fmt(invoiceData.subtotal)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: #71717a; margin-bottom: 8px; padding: 0 4px;">
                <span>ITBIS (${invoiceData.taxRate}%):</span>
                <span class="tabular-numbers" style="font-weight: 600; color: #18181b;">${invoiceData.currency} ${fmt(invoiceData.tax)}</span>
              </div>
            ` : ''}
            
            <div style="background: #18181b; color: #ffffff; border-radius: 8px; padding: 11px 16px; display: flex; justify-content: space-between; align-items: baseline; box-shadow: 0 2px 4px rgba(0,0,0,0.06);">
              <span style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #a1a1aa;">TOTAL:</span>
              <span class="tabular-numbers" style="font-size: 21px; font-weight: 900; color: #ffffff; letter-spacing: -0.02em;">
                ${invoiceData.currency} ${fmt(invoiceData.total)}
              </span>
            </div>

            ${(invoiceData.amountPaid !== undefined && invoiceData.amountPaid > 0 && (invoiceData.change || 0) > 0) ? `
              <div style="margin-top: 8px; padding-top: 5px; border-top: 1px dashed #e4e4e7; font-size: 10.5px; color: #71717a; padding-left: 4px; padding-right: 4px;">
                <div style="display: flex; justify-content: space-between;">
                  <span>Recibido:</span>
                  <span class="tabular-numbers">${invoiceData.currency} ${fmt(invoiceData.amountPaid)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                  <span style="font-weight: 600; color: #18181b;">Devuelta:</span>
                  <span class="tabular-numbers" style="font-weight: 800; color: #18181b;">${invoiceData.currency} ${fmt(invoiceData.change)}</span>
                </div>
              </div>
            ` : ''}
          </div>
        </div>

      </div>

      <!-- Condiciones del Servicio y Firma (Estilo Minimalista) -->
      <div style="margin-top: 24px; padding-top: 8px;">
        <div style="font-size: 11.5px; font-weight: 800; color: #18181b; margin-bottom: 5px;">
          Condiciones del servicio:
        </div>
        <div style="font-size: 10.5px; color: #71717a; line-height: 1.5; max-width: 88%;">
          ${invoiceData.footerText ? invoiceData.footerText : (isQuotation
            ? 'Para facilitar el lanzamiento o ejecución de su proyecto, este presupuesto cuenta con validez de 30 días a partir de su emisión. Los tiempos de entrega comenzarán a correr a partir de la confirmación formal del pago inicial.'
            : 'Comprobante emitido para fines de registro y control. En caso de realizar pago mediante transferencia o depósito bancario, favor remitir el comprobante a nuestro canal de contacto para la debida acreditación.')}
        </div>

        <div style="margin-top: 32px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11.5px; font-weight: 700; color: #18181b;">Firma:</span>
          <div style="border-bottom: 1.5px solid #cbd5e1; width: 220px; display: inline-block;"></div>
        </div>
      </div>

    </div>

    <!-- Pie de página oscuro moderno al ras de la base de la factura -->
    <div style="background: #18181b; color: #f4f4f5; width: 100%; margin: 0; padding: 13px 20px; display: flex; justify-content: center; align-items: center; gap: 16px; font-size: 10.5px; font-weight: 500; letter-spacing: 0.02em; flex-shrink: 0; box-sizing: border-box;">
      ${companyData.email ? `<span>${companyData.email}</span>` : ''}
      ${companyData.email && companyData.phone ? `<span style="color: #71717a;">|</span>` : ''}
      ${companyData.phone ? `<span>${companyData.phone}</span>` : ''}
      ${companyData.phone && companyData.rnc ? `<span style="color: #71717a;">|</span>` : ''}
      ${companyData.rnc ? `<span>RNC: ${companyData.rnc}</span>` : ''}
      <span style="color: #71717a;">|</span>
      <span style="color: #e4e4e7; font-weight: 600;">cobroapp.app</span>
    </div>

  </div>
</body>
</html>
    `.trim();
  }

  // ==========================================
  // THERMAL TICKET TEMPLATE (80MM & 58MM)
  // ==========================================
  const ticketWidth = is58mm ? '58mm' : '80mm';
  // Igual que baseFontSize arriba: subidos para la resolución real de una
  // térmica de 58mm (~168 DPI) — el texto más chico es el que peor
  // sobrevive la conversión a blanco/negro.
  const sizeH1 = is58mm ? 15 : Math.round(baseFontSize * 1.35);
  const sizeBase = baseFontSize;
  const sizeSmall = is58mm ? 9.5 : Math.max(9, Math.round(baseFontSize * 0.88));
  const sizeXSmall = is58mm ? 9 : Math.max(8, Math.round(baseFontSize * 0.78));
  const containerPadding = is58mm ? '2px 2mm' : '4px 5mm';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura ${displayNCF}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page {
      size: ${ticketWidth} auto;
      margin: 0mm;
    }
    @media screen {
      html, body { overflow: hidden !important; }
    }
    html, body {
      width: 100% !important;
      max-width: ${ticketWidth} !important;
      margin: 0 auto !important;
      padding: 0 !important;
      background-color: #ffffff !important;
      color: #000000 !important;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: ${sizeBase}px;
      line-height: 1.35;
      -webkit-font-smoothing: antialiased;
    }
    @media print {
      @page { size: ${ticketWidth} auto; margin: 0mm; }
      html, body {
        width: 100% !important;
        max-width: ${ticketWidth} !important;
        margin: 0 auto !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        overflow: visible !important;
      }
      .invoice-container {
        padding: ${containerPadding} !important;
        width: 100% !important;
        max-width: ${ticketWidth} !important;
        margin: 0 auto !important;
      }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
    .invoice-container {
      background: #ffffff !important;
      color: #000000 !important;
      padding: ${containerPadding};
      width: 100%;
      max-width: ${ticketWidth};
      margin: 0 auto;
      overflow: hidden;
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    
    <!-- Top Monogram / Logo Section -->
    <div style="text-align: center; margin-bottom: 6px;">
      ${companyData.logo ? `
        <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 4px;">
          <img src="${companyData.logo}" alt="Logo" style="max-height: ${Math.min(logoHeight, is58mm ? 65 : 85)}px; max-width: 85%; object-fit: contain; margin: 0 auto; display: block;" />
        </div>
      ` : `
        <div style="display: inline-block; background-color: #ffffff; color: #000000; border: 2px solid #000000; padding: 2px 8px; border-radius: 4px; font-weight: 900; font-size: ${is58mm ? '13px' : '12px'}; text-transform: uppercase;">
          ${companyInitials}
        </div>
      `}
    </div>
    
    <!-- Company Header -->
    <div style="text-align: center; margin-bottom: 6px;">
      <div style="font-size: ${sizeH1}px; font-weight: 900; color: #000000; text-transform: uppercase; letter-spacing: -0.3px; line-height: 1.2;">
        ${companyData.name}
      </div>
      ${(companyData.rnc || companyData.phone) ? `
        <div style="font-size: ${sizeSmall}px; color: #000000; margin-top: 2px; font-weight: 800;">
          ${companyData.rnc ? `RNC: ${companyData.rnc}` : ''} ${companyData.rnc && companyData.phone ? '•' : ''} ${companyData.phone ? `Tel: ${companyData.phone}` : ''}
        </div>
      ` : ''}
      ${companyData.address ? `
        <div style="font-size: ${sizeSmall}px; color: #000000; margin-top: 1px; font-weight: 700;">
          ${companyData.address}
        </div>
      ` : ''}
      <div style="border-bottom: 2px solid #000000; margin-top: 5px; width: 100%;"></div>
    </div>
    
    <!-- Card 1: Comprobante & Info Card -->
    <div style="background-color: #ffffff; border: 2px solid #000000; border-radius: 6px; padding: 5px 6px; margin-bottom: 6px;">
      <div style="background-color: #ffffff; color: #000000; border: 2px solid #000000; border-radius: 4px; padding: 3px 4px; text-align: center; margin-bottom: 5px;">
        <div style="font-size: ${is58mm ? '10px' : '8.5px'}; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #000000;">
          ${isQuotation ? 'COTIZACIÓN / PRESUPUESTO' : (isInternalInvoice ? 'FACTURA INTERNA' : (invoiceData.isElectronic ? 'COMPROBANTE ELECTRÓNICO (e-NCF)' : 'COMPROBANTE DE VENTA (NCF)'))}
        </div>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: ${is58mm ? '15px' : '15px'}; font-weight: 900; letter-spacing: 1px; color: #000000; margin-top: 1px; word-break: break-all;">
          ${displayNCF}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: ${is58mm ? '10.5px' : '9px'}; border-top: 1.5px solid #000000; padding-top: 4px;">
        <div>
          <div style="color: #000000; font-weight: 900; text-transform: uppercase; font-size: ${is58mm ? '10px' : '8.5px'};">FACTURA / TIPO</div>
          <div style="font-weight: 900; color: #000000; word-break: break-word;">${fullInvoiceCode}</div>
          <div style="font-weight: 800; color: #000000; font-size: ${is58mm ? '10px' : '8.5px'};">(${customerTypeLabel})</div>
        </div>
        <div style="text-align: right;">
          <div style="color: #000000; font-weight: 900; text-transform: uppercase; font-size: ${is58mm ? '10px' : '8.5px'};">FECHA Y HORA</div>
          <div style="font-weight: 900; color: #000000;">${formattedTimeStr}</div>
          <div style="font-weight: 800; color: #000000; font-size: ${is58mm ? '10px' : '8.5px'};">(${formattedDateStr})</div>
        </div>
      </div>

      <div style="border-top: 1.5px solid #000000; margin-top: 4px; padding-top: 4px; font-size: ${is58mm ? '10.5px' : '9px'}; line-height: 1.35;">
        <div><span style="font-weight: 900; text-transform: uppercase;">CLIENTE:</span> <strong style="font-weight: 900;">${(invoiceData.customerName || 'CONSUMIDOR FINAL').toUpperCase()}</strong></div>
        ${invoiceData.customerRnc ? `<div><span style="font-weight: 900; text-transform: uppercase;">RNC CLIENTE:</span> <strong style="font-weight: 900;">${invoiceData.customerRnc}</strong></div>` : ''}
        ${invoiceData.cashierName ? `<div><span style="font-weight: 900; text-transform: uppercase;">CAJERO:</span> <strong style="font-weight: 900;">${invoiceData.cashierName.toUpperCase()}</strong></div>` : ''}
      </div>
    </div>

    <!-- Card 2: Items Table -->
    <div style="margin-bottom: 6px;">
      <div style="background-color: #ffffff; color: #000000; padding: 4px 6px; border: 2px solid #000000; border-top-left-radius: 6px; border-top-right-radius: 6px; display: flex; justify-content: space-between; font-weight: 900; font-size: ${is58mm ? '10.5px' : '9px'}; text-transform: uppercase;">
        <span>CANT / DESCRIPCIÓN</span>
        <span>TOTAL</span>
      </div>
      
      <div style="border: 2px solid #000000; border-top: none; border-bottom-left-radius: 6px; border-bottom-right-radius: 6px; padding: 4px 6px; background-color: #ffffff;">
        ${invoiceData.items && invoiceData.items.length > 0 ? invoiceData.items.map(item => `
          <div style="padding: 4px 0; border-bottom: 1px dashed #000000;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px;">
              <div style="font-weight: 900; font-size: ${sizeSmall}px; color: #000000; flex: 1; word-break: break-word; line-height: 1.2;">
                <span style="font-weight: 900; font-size: ${sizeSmall}px; margin-right: 3px;">${item.quantity}x</span>
                ${item.name}
              </div>
              <div style="font-family: monospace; font-weight: 900; font-size: ${sizeSmall}px; color: #000000; white-space: nowrap;">
                ${invoiceData.currency} ${fmt(item.total)}
              </div>
            </div>
            <div style="font-size: ${sizeXSmall}px; color: #000000; font-weight: 700; margin-top: 1px;">
              ${invoiceData.currency} ${fmt(item.price)} c/u ${item.comment ? `• (${item.comment})` : ''}
            </div>
          </div>
        `).join('') : `
          <div style="padding: 6px 0; text-align: center; font-weight: 800; font-size: ${sizeSmall}px;">
            Sin artículos cargados
          </div>
        `}
      </div>
    </div>

    <!-- Card 3: Subtotal / ITBIS / TOTAL -->
    <div style="background-color: #ffffff; border: 2px solid #000000; border-radius: 6px; padding: 5px 6px; margin-bottom: 6px;">
      ${hasTax ? `
        <div style="display: flex; justify-content: space-between; font-size: ${sizeSmall}px; font-weight: 800; margin-bottom: 2px;">
          <span>Subtotal:</span>
          <span style="font-family: monospace; font-weight: 900;">${invoiceData.currency} ${fmt(invoiceData.subtotal)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: ${sizeSmall}px; font-weight: 800; margin-bottom: 3px;">
          <span>ITBIS (${invoiceData.taxRate}%):</span>
          <span style="font-family: monospace; font-weight: 900;">${invoiceData.currency} ${fmt(invoiceData.tax)}</span>
        </div>
      ` : ''}
      
      <div style="${hasTax ? 'border-top: 2px solid #000000; margin-top: 3px; padding-top: 4px;' : ''} display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 900; font-size: ${sizeBase}px; text-transform: uppercase;">TOTAL A PAGAR:</span>
        <span style="font-family: monospace; font-weight: 900; font-size: ${Math.round(sizeBase * 1.25)}px;">${invoiceData.currency} ${fmt(invoiceData.total)}</span>
      </div>
    </div>

    <!-- Card 4: Método de Pago -->
    <div style="background-color: #ffffff; border: 2px solid #000000; border-radius: 6px; padding: 5px 6px; margin-bottom: 6px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
        <span style="font-weight: 900; font-size: ${sizeXSmall}px; text-transform: uppercase;">MÉTODO DE PAGO:</span>
        <span style="background-color: #ffffff; border: 1.5px solid #000000; font-weight: 900; font-size: ${is58mm ? '11px' : '9.5px'}; padding: 1px 4px; border-radius: 4px; text-transform: uppercase;">
          ${pMethod}
        </span>
      </div>
      
      <div style="display: flex; justify-content: space-between; font-size: ${sizeSmall}px; font-weight: 800; margin-top: 3px;">
        <span>Monto Recibido:</span>
        <span style="font-family: monospace; font-weight: 900;">${invoiceData.currency} ${fmt(invoiceData.amountPaid !== undefined && invoiceData.amountPaid > 0 ? invoiceData.amountPaid : invoiceData.total)}</span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; font-size: ${sizeSmall}px; font-weight: 800; margin-top: 2px;">
        <span>Devuelta:</span>
        <span style="font-family: monospace; font-weight: 900; border: 1.5px solid #000000; padding: 1px 4px; border-radius: 4px;">
          ${invoiceData.currency} ${fmt(invoiceData.change || 0)}
        </span>
      </div>
    </div>

    <!-- Card Bancaria: Cuentas para Transferencias -->
    ${invoiceData.bankAccounts && invoiceData.bankAccounts.length > 0 ? `
      <div style="background-color: #ffffff; border: 2px solid #000000; border-radius: 6px; padding: 5px 6px; margin-bottom: 6px;">
        <div style="font-weight: 900; font-size: ${sizeXSmall}px; text-transform: uppercase; margin-bottom: 3px; border-bottom: 1px dashed #000000; padding-bottom: 2px;">
          CUENTAS PARA TRANSFERENCIAS:
        </div>
        ${invoiceData.bankAccounts.map((acc: any) => `
          <div style="padding: 3px 0; border-bottom: 1px dotted #ccc; font-size: ${sizeXSmall}px; line-height: 1.25;">
            <div style="font-weight: 900; color: #000000;">${acc.bank_name}${acc.alias ? ` (${acc.alias})` : ''}</div>
            <div style="font-family: monospace; font-weight: 900; font-size: ${sizeSmall}px; color: #000000;">${acc.account_number}</div>
            ${acc.account_type ? `<div>Tipo: ${acc.account_type}</div>` : ''}
            ${acc.holder_name ? `<div>Titular: ${acc.holder_name}</div>` : ''}
            ${acc.rnc_cedula ? `<div>RNC/Céd: ${acc.rnc_cedula}</div>` : ''}
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${(invoiceData.loyaltyPointsEarned !== undefined || invoiceData.loyaltyPoints !== undefined) ? `
      <div style="border-top: 2px dashed #000000; margin-top: 6px; padding-top: 4px; text-align: center;">
        <div style="font-size: ${sizeSmall}px; font-weight: 900; margin-bottom: 1px;">★ PUNTOS DE LEALTAD ★</div>
        ${invoiceData.loyaltyPointsEarned ? `<div style="font-size: ${sizeSmall}px; font-weight: 800;">Ganados: +${invoiceData.loyaltyPointsEarned} pts</div>` : ''}
        ${invoiceData.loyaltyPoints !== undefined ? `<div style="font-size: ${sizeSmall}px; font-weight: 800;">Saldo: ${invoiceData.loyaltyPoints} pts</div>` : ''}
      </div>
    ` : ''}

    <!-- Barcode & Footer Disclaimer -->
    <div style="border-top: 2px solid #000000; padding-top: 8px; margin-top: 6px; text-align: center;">
      ${invoiceData.showBarcode && invoiceData.barcodeDataUrl && !invoiceData.isElectronic ? `
        <div style="margin-bottom: 6px; text-align: center;">
          <img src="${invoiceData.barcodeDataUrl}" alt="Código de barras" style="max-width: 95%; width: 92%; height: 50px; margin: 0 auto; display: block; filter: grayscale(100%);" />
          <div style="font-family: monospace; font-size: 11px; font-weight: 900; margin-top: 2px;">${displayNCF}</div>
        </div>
      ` : ''}

      ${hasElectronicStyle && effectiveQrCodeUrl ? `
        <div style="text-align: center; margin-bottom: 6px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(effectiveQrCodeUrl)}" alt="Código QR Fiscal" style="width: ${is58mm ? '75px' : '90px'}; height: ${is58mm ? '75px' : '90px'}; display: block; margin: 0 auto;" />
          <div style="font-size: ${is58mm ? '9.5px' : '8.5px'}; font-weight: 800; margin-top: 3px; font-family: monospace;">
            ${effectiveSecurityCode ? `<div>Cód. Seguridad: ${effectiveSecurityCode}</div>` : ''}
            ${effectiveSignatureDate ? `<div>Firma: ${effectiveSignatureDate}</div>` : ''}
          </div>
          <div style="font-size: ${is58mm ? '10px' : '8px'}; font-weight: 900; margin-top: 2px; text-transform: uppercase;">Comprobante Autorizado por la DGII</div>
        </div>
      ` : ''}
      ${false && invoiceData.isElectronic && invoiceData.qrCodeUrl ? `
        <div style="text-align: center; margin-bottom: 6px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(invoiceData.qrCodeUrl)}" alt="Código QR Fiscal" style="width: ${is58mm ? '75px' : '90px'}; height: ${is58mm ? '75px' : '90px'}; display: block; margin: 0 auto;" />
          <div style="font-size: ${is58mm ? '10px' : '8px'}; font-weight: 900; margin-top: 3px; text-transform: uppercase;">Comprobante Autorizado por la DGII</div>
        </div>
      ` : ''}
      
      <div style="font-weight: 900; font-size: ${sizeSmall}px; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 3px;">
        ¡GRACIAS POR SU COMPRA!
      </div>
      
      ${invoiceData.footerText ? `
        <div style="font-size: ${sizeXSmall}px; font-weight: 700; margin-top: 2px;">
          ${invoiceData.footerText}
        </div>
      ` : ''}

      <div style="margin-top: 10px; padding-top: 8px; border-top: 2px dashed #000000; display: flex; justify-content: center; align-items: center; gap: 6px;">
        <div style="text-align: center; line-height: 1.3;">
          <div style="font-size: 11.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px;">Emitido con COBROAPP</div>
          <div style="font-size: 9px; font-weight: 700; margin-top: 1px;">¿Tienes un negocio? Factura fácil en cobroapp.app</div>
        </div>
      </div>
    </div>

  </div>
</body>
</html>
  `.trim();
};
