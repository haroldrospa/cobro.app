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

  const logoHeight = companyData.logoSize || (isFullPage ? 80 : 60);
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

  const pMethod = (invoiceData.paymentMethod?.trim() || 'EFECTIVO').toUpperCase();
  const rawInvoiceNum = invoiceData.invoiceNumber || '000000';
  const isQuotation = Boolean(invoiceData.isQuotation || rawInvoiceNum.startsWith('COT') || invoiceData.invoicePrefix === 'COT');
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
      margin: 8mm 10mm; 
    }
    html, body {
      width: 100% !important;
      background: #ffffff !important;
      color: #0f172a !important;
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
      min-height: ${isCarta ? '265mm' : '282mm'};
      margin: 0 auto;
      padding: 6mm 8mm;
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
      flex-grow: 1;
    }

    .grid-header {
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 24px;
      align-items: start;
      margin-bottom: 16px;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      margin-bottom: 16px;
    }
    .items-table th {
      background: #f8fafc;
      color: #475569;
      padding: 9px 12px;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-top: 1px solid #e2e8f0;
      border-bottom: 2px solid #e2e8f0;
    }
    .items-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 12px;
      color: #1e293b;
      vertical-align: middle;
    }
    .items-table tr:nth-child(even) td {
      background-color: #fafbfc;
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
      .invoice-sheet {
        padding: 4mm 6mm !important;
        max-width: 100% !important;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-sheet">
    
    <!-- CONTENIDO DE LA FACTURA -->
    <div class="invoice-content">
      
      <!-- Encabezado: Empresa (Izq) y Factura/NCF (Der) -->
      <div class="grid-header">
        <div>
          ${companyData.logo ? `
            <img src="${companyData.logo}" alt="Logo" style="max-height: ${Math.min(logoHeight, 60)}px; max-width: 220px; object-fit: contain; margin-bottom: 6px; display: block;" />
          ` : `
            <div style="display: inline-block; background: #0f172a; color: #ffffff; padding: 5px 12px; border-radius: 6px; font-weight: 800; font-size: 14px; letter-spacing: 0.05em; margin-bottom: 6px;">
              ${companyInitials}
            </div>
          `}
          <h1 style="font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; margin-bottom: 4px; line-height: 1.2;">
            ${companyData.name}
          </h1>
          <div style="font-size: 11.5px; color: #475569; line-height: 1.45;">
            ${companyData.rnc ? `<div><strong style="color: #1e293b;">RNC:</strong> ${companyData.rnc}</div>` : ''}
            ${companyData.phone ? `<div><strong style="color: #1e293b;">Teléfono:</strong> ${companyData.phone}</div>` : ''}
            ${companyData.email ? `<div><strong style="color: #1e293b;">Email:</strong> ${companyData.email}</div>` : ''}
            ${companyData.address ? `<div><strong style="color: #1e293b;">Dirección:</strong> ${companyData.address}</div>` : ''}
          </div>
        </div>

        <!-- Tarjeta NCF y Metadatos -->
        <div style="display: flex; flex-direction: column; align-items: flex-end;">
          <div style="font-size: 20px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.02em; margin-bottom: 6px;">
            ${isQuotation ? 'COTIZACIÓN' : 'FACTURA'}
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; text-align: right; width: 100%; max-width: 260px;">
            <div style="display: inline-block; background: ${isQuotation ? '#fef3c7' : (invoiceData.isElectronic ? '#e0f2fe' : '#e2e8f0')}; color: ${isQuotation ? '#92400e' : (invoiceData.isElectronic ? '#0369a1' : '#334155')}; padding: 2px 8px; border-radius: 4px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 4px;">
              ${isQuotation ? 'Cotización / Presupuesto' : (invoiceData.isElectronic ? 'e-CF Electrónico' : 'Comprobante Fiscal')}
            </div>
            <div class="tabular-numbers" style="font-size: 17px; font-weight: 800; letter-spacing: 1px; color: #0f172a; margin-bottom: 4px; line-height: 1.2;">
              ${displayNCF}
            </div>
            <div style="font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 4px; margin-top: 4px; line-height: 1.4;">
              <div><strong style="color: #334155;">Tipo:</strong> ${customerTypeLabel}</div>
              <div><strong style="color: #334155;">Fecha:</strong> ${formattedDateStr} ${formattedTimeStr}</div>
              <div><strong style="color: #334155;">Pago:</strong> ${pMethod} ${isCreditSale && invoiceData.paymentTerms ? `(${invoiceData.paymentTerms} días)` : ''}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tarjeta Datos del Cliente -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 11px 16px; margin-bottom: 14px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; font-size: 11.5px; line-height: 1.45;">
        <div>
          <div style="font-size: 9.5px; font-weight: 800; letter-spacing: 0.08em; color: #64748b; text-transform: uppercase; margin-bottom: 2px;">
            Facturado a
          </div>
          <div style="font-size: 13.5px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
            ${(invoiceData.customerName || 'CONSUMIDOR FINAL').toUpperCase()}
          </div>
          ${invoiceData.customerRnc ? `<div><span style="color: #64748b;">RNC / Cédula:</span> <strong style="color: #1e293b;">${invoiceData.customerRnc}</strong></div>` : ''}
          ${invoiceData.customerPhone ? `<div><span style="color: #64748b;">Teléfono:</span> <span style="color: #334155;">${invoiceData.customerPhone}</span></div>` : ''}
        </div>
        <div style="border-left: 1px solid #e2e8f0; padding-left: 16px; display: flex; flex-direction: column; justify-content: center; gap: 2px;">
          ${invoiceData.customerAddress ? `<div><span style="color: #64748b;">Dirección:</span> <span style="color: #334155;">${invoiceData.customerAddress}</span></div>` : ''}
          <div><span style="color: #64748b;">Condición:</span> <strong style="color: #1e293b;">${pMethod}</strong></div>
          ${invoiceData.cashierName ? `<div><span style="color: #64748b;">Atendido por:</span> <span style="color: #334155;">${invoiceData.cashierName}</span></div>` : ''}
        </div>
      </div>

      <!-- Tabla de Artículos / Servicios -->
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 8%; text-align: center;">CANT</th>
            <th style="width: 52%; text-align: left;">DESCRIPCIÓN</th>
            <th style="width: 14%; text-align: right;">PRECIO UNIT.</th>
            <th style="width: 12%; text-align: right;">ITBIS</th>
            <th style="width: 14%; text-align: right;">TOTAL (${invoiceData.currency})</th>
          </tr>
        </thead>
        <tbody>
          ${invoiceData.items && invoiceData.items.length > 0 ? invoiceData.items.map((item) => {
            const itemTax = (item.total - (item.total / (1 + invoiceData.taxRate / 100)));
            return `
              <tr>
                <td style="text-align: center; font-weight: 700; color: #0f172a;">${item.quantity}</td>
                <td>
                  <div style="font-weight: 600; color: #0f172a; font-size: 12px;">${item.name}</div>
                  ${item.comment ? `<div style="font-size: 10.5px; color: #64748b; margin-top: 1px;">${item.comment}</div>` : ''}
                </td>
                <td class="tabular-numbers" style="text-align: right; color: #334155;">${fmt(item.price)}</td>
                <td class="tabular-numbers" style="text-align: right; color: #64748b;">${fmt(itemTax)}</td>
                <td class="tabular-numbers" style="text-align: right; font-weight: 800; color: #0f172a;">${fmt(item.total)}</td>
              </tr>
            `;
          }).join('') : `
            <tr>
              <td colspan="5" style="text-align: center; padding: 18px; color: #94a3b8; font-style: italic;">Sin artículos registrados</td>
            </tr>
          `}
        </tbody>
      </table>

      <!-- Sección Inferior: DGII / Firma (Izq) y Totales (Der) -->
      <div style="display: grid; grid-template-columns: 1.15fr 1fr; gap: 20px; align-items: start; margin-top: auto; padding-top: 10px;">
        <div>
          ${invoiceData.isElectronic && invoiceData.qrCodeUrl ? `
            <div style="display: flex; align-items: center; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(invoiceData.qrCodeUrl)}" alt="Código QR Fiscal" style="width: 72px; height: 72px; border-radius: 4px; background: #ffffff; padding: 2px; border: 1px solid #e2e8f0; flex-shrink: 0;" />
              <div style="font-size: 10.5px; line-height: 1.4; color: #475569;">
                <div style="font-weight: 800; color: #0284c7; text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.05em; margin-bottom: 2px;">
                  Comprobante Autorizado por la DGII
                </div>
                ${invoiceData.securityCode ? `<div><strong style="color: #1e293b;">Cód. Seguridad:</strong> <span class="tabular-numbers">${invoiceData.securityCode}</span></div>` : ''}
                ${invoiceData.signatureDate ? `<div><strong style="color: #1e293b;">Firma Digital:</strong> <span class="tabular-numbers">${invoiceData.signatureDate}</span></div>` : ''}
              </div>
            </div>
          ` : ''}

          ${isCreditSale ? `
            <div style="border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px;">
              <div style="font-weight: 700; color: #475569; text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.05em; margin-bottom: 26px;">
                Firma de Conformidad del Cliente
              </div>
              <div style="border-bottom: 1px solid #94a3b8; width: 75%; margin-bottom: 4px;"></div>
              <div style="font-size: 9.5px; color: #64748b;">Recibido Conforme (Nombre / Firma / Cédula)</div>
            </div>
          ` : ''}

          ${(invoiceData.loyaltyPointsEarned !== undefined || invoiceData.loyaltyPoints !== undefined) ? `
            <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 6px; padding: 6px 10px; font-size: 10.5px; font-weight: 600; color: #854d0e; margin-bottom: 6px;">
              ★ PUNTOS DE LEALTAD: 
              ${invoiceData.loyaltyPointsEarned ? `+${invoiceData.loyaltyPointsEarned} pts ganados | ` : ''}
              Saldo: ${invoiceData.loyaltyPoints || 0} pts
            </div>
          ` : ''}

          ${invoiceData.footerText ? `
            <div style="font-size: 10.5px; color: #64748b; font-style: italic; margin-top: 6px;">
              ${invoiceData.footerText}
            </div>
          ` : ''}
        </div>

        <!-- Tarjeta de Totales -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px; color: #475569;">
            <span>Subtotal:</span>
            <span class="tabular-numbers" style="font-weight: 700; color: #0f172a;">${invoiceData.currency} ${fmt(invoiceData.subtotal)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; color: #475569;">
            <span>ITBIS (${invoiceData.taxRate}%):</span>
            <span class="tabular-numbers" style="font-weight: 700; color: #0f172a;">${invoiceData.currency} ${fmt(invoiceData.tax)}</span>
          </div>
          
          <div style="border-top: 1.5px solid #0f172a; padding-top: 8px; margin-top: 4px; display: flex; justify-content: space-between; align-items: baseline;">
            <span style="font-size: 13px; font-weight: 900; text-transform: uppercase; color: #0f172a; letter-spacing: 0.03em;">${isQuotation ? 'TOTAL COTIZADO:' : 'TOTAL A PAGAR:'}</span>
            <span class="tabular-numbers" style="font-size: 20px; font-weight: 900; color: #0f172a;">${invoiceData.currency} ${fmt(invoiceData.total)}</span>
          </div>

          ${(invoiceData.amountPaid !== undefined && invoiceData.amountPaid > 0 && (invoiceData.change || 0) > 0) ? `
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 8px; font-size: 11px; color: #64748b;">
              <div style="display: flex; justify-content: space-between;">
                <span>Monto Recibido:</span>
                <span class="tabular-numbers">${invoiceData.currency} ${fmt(invoiceData.amountPaid)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                <span>Devuelta:</span>
                <span class="tabular-numbers" style="font-weight: 700; color: #0f172a;">${invoiceData.currency} ${fmt(invoiceData.change)}</span>
              </div>
            </div>
          ` : ''}
        </div>
      </div>

    </div>

    <!-- Pie de Página Institucional -->
    <div style="position: relative; z-index: 1; border-top: 1px solid #e2e8f0; margin-top: 18px; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94a3b8;">
      <div style="font-weight: 600; color: #64748b; letter-spacing: 0.02em;">¡Gracias por su preferencia!</div>
      <div style="display: flex; align-items: center; gap: 6px; font-weight: 600;">
        <span>Emitido con</span>
        <strong style="color: #0f172a; letter-spacing: 0.05em;">COBROAPP</strong>
        <span>• cobroapp.app</span>
      </div>
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
          ${isQuotation ? 'COTIZACIÓN / PRESUPUESTO' : (invoiceData.isElectronic ? 'COMPROBANTE ELECTRÓNICO (e-NCF)' : 'COMPROBANTE DE VENTA (NCF)')}
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
      <div style="display: flex; justify-content: space-between; font-size: ${sizeSmall}px; font-weight: 800; margin-bottom: 2px;">
        <span>Subtotal:</span>
        <span style="font-family: monospace; font-weight: 900;">${invoiceData.currency} ${fmt(invoiceData.subtotal)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: ${sizeSmall}px; font-weight: 800; margin-bottom: 3px;">
        <span>ITBIS (${invoiceData.taxRate}%):</span>
        <span style="font-family: monospace; font-weight: 900;">${invoiceData.currency} ${fmt(invoiceData.tax)}</span>
      </div>
      
      <div style="border-top: 2px solid #000000; margin-top: 3px; padding-top: 4px; display: flex; justify-content: space-between; align-items: center;">
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

      ${invoiceData.isElectronic && invoiceData.qrCodeUrl ? `
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
        <span style="font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px;">COBROAPP</span>
      </div>
    </div>

  </div>
</body>
</html>
  `.trim();
};
