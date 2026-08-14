// Utility to generate clean, black & white invoice HTML matching the selected Paper Size (80mm, 58mm, A4, Carta)
import appLogo from '@/assets/cobro-logo.png';

interface InvoiceData {
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
  encf?: string;
  securityCode?: string;
  signatureDate?: string;
  qrCodeUrl?: string;
}

interface CompanyData {
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
  const baseFontSize = companyData.fontSize || (isFullPage ? 13 : is58mm ? 9.5 : 12);

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
  const displayNCF = invoiceData.isElectronic
    ? (invoiceData.encf || rawInvoiceNum)
    : rawInvoiceNum;

  const displayPrefix = invoiceData.invoicePrefix || 'FAC-';
  const fullInvoiceCode = rawInvoiceNum.startsWith('FAC-') || rawInvoiceNum.startsWith('E') || rawInvoiceNum.startsWith('B')
    ? rawInvoiceNum
    : `${displayPrefix}${rawInvoiceNum}`;

  const customerTypeLabel = invoiceData.customerName && invoiceData.customerName.toUpperCase() !== 'CLIENTE FINAL' && invoiceData.customerName.toUpperCase() !== 'CONSUMIDOR FINAL'
    ? 'Comprobante Fiscal'
    : 'Consumidor Final';

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
    @page { size: ${pageCSS}; margin: 10mm; }
    html, body {
      width: 100% !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: ${baseFontSize}px;
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
    }
    .invoice-container {
      width: 100%;
      max-width: ${isCarta ? '215.9mm' : '210mm'};
      margin: 0 auto;
      padding: 10px;
      background: #ffffff;
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .card-box {
      border: 2px solid #000000;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 14px;
      background-color: #ffffff;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    .items-table th {
      background-color: #000000 !important;
      color: #ffffff !important;
      padding: 8px 10px;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .items-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 12px;
    }
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .items-table th { background-color: #000000 !important; color: #ffffff !important; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    
    <!-- Header Grid: Company Info (Left) & NCF Box (Right) -->
    <div class="grid-2" style="align-items: start; margin-bottom: 16px;">
      <div>
        ${companyData.logo ? `
          <img src="${companyData.logo}" alt="Logo" style="max-height: ${Math.min(logoHeight, 80)}px; max-width: 240px; object-fit: contain; margin-bottom: 8px; display: block;" />
        ` : `
          <div style="display: inline-block; background: #000; color: #fff; padding: 6px 16px; border-radius: 6px; font-weight: 900; font-size: 16px; margin-bottom: 8px;">
            ${companyInitials}
          </div>
        `}
        <h1 style="font-size: 22px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; line-height: 1.1;">
          ${companyData.name}
        </h1>
        <div style="font-size: 12px; color: #333; line-height: 1.4; font-weight: 600;">
          ${companyData.rnc ? `<div><strong>RNC:</strong> ${companyData.rnc}</div>` : ''}
          ${companyData.phone ? `<div><strong>Teléfono:</strong> ${companyData.phone}</div>` : ''}
          ${companyData.email ? `<div><strong>Email:</strong> ${companyData.email}</div>` : ''}
          ${companyData.address ? `<div><strong>Dirección:</strong> ${companyData.address}</div>` : ''}
        </div>
      </div>

      <!-- NCF & Factura Header Card -->
      <div style="border: 2px solid #000000; border-radius: 8px; padding: 14px; text-align: center; background-color: #fcfcfc;">
        <div style="background-color: #000000; color: #ffffff; padding: 4px 8px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; border-radius: 4px; margin-bottom: 8px;">
          ${invoiceData.isElectronic ? 'COMPROBANTE ELECTRÓNICO (e-NCF)' : 'COMPROBANTE FISCAL (NCF)'}
        </div>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 900; letter-spacing: 2px; color: #000000; margin-bottom: 6px;">
          ${displayNCF}
        </div>
        <div style="font-size: 12px; font-weight: 800; color: #444; border-top: 1px dashed #ccc; padding-top: 6px; margin-top: 4px;">
          <strong>TIPO:</strong> ${customerTypeLabel} (${fullInvoiceCode})
        </div>
        <div style="font-size: 11px; color: #555; margin-top: 4px;">
          <strong>FECHA:</strong> ${formattedDateStr} ${formattedTimeStr}
        </div>
        ${invoiceData.cashierName ? `<div style="font-size: 11px; color: #555; margin-top: 2px;"><strong>ATENDIDO POR:</strong> ${invoiceData.cashierName.toUpperCase()}</div>` : ''}
      </div>
    </div>

    <!-- Customer Information Box -->
    <div class="card-box">
      <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1.5px solid #000000; padding-bottom: 4px; margin-bottom: 8px; color: #000000;">
        DATOS DEL CLIENTE Y VENTA
      </div>
      <div class="grid-2" style="font-size: 12px; line-height: 1.5;">
        <div>
          <div><strong style="color: #000000;">CLIENTE:</strong> ${(invoiceData.customerName || 'CONSUMIDOR FINAL').toUpperCase()}</div>
          ${invoiceData.customerRnc ? `<div><strong style="color: #000000;">RNC / CÉDULA:</strong> ${invoiceData.customerRnc}</div>` : ''}
          ${invoiceData.customerPhone ? `<div><strong style="color: #000000;">TELÉFONO:</strong> ${invoiceData.customerPhone}</div>` : ''}
        </div>
        <div>
          ${invoiceData.customerAddress ? `<div><strong style="color: #000000;">DIRECCIÓN:</strong> ${invoiceData.customerAddress}</div>` : ''}
          <div><strong style="color: #000000;">FORMA DE PAGO:</strong> ${pMethod} ${isCreditSale && invoiceData.paymentTerms ? `(${invoiceData.paymentTerms} DÍAS)` : ''}</div>
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <div style="border: 2px solid #000000; border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
      <table class="items-table" style="margin-bottom: 0;">
        <thead>
          <tr>
            <th style="width: 8%; text-align: center;">CANT</th>
            <th style="width: 52%; text-align: left;">DESCRIPCIÓN DE PRODUCTO / SERVICIO</th>
            <th style="width: 13%; text-align: right;">PRECIO UNIT.</th>
            <th style="width: 12%; text-align: right;">ITBIS</th>
            <th style="width: 15%; text-align: right;">TOTAL (${invoiceData.currency})</th>
          </tr>
        </thead>
        <tbody>
          ${invoiceData.items && invoiceData.items.length > 0 ? invoiceData.items.map((item, idx) => {
            const itemTax = (item.total - (item.total / (1 + invoiceData.taxRate / 100)));
            return `
              <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#fcfcfc'};">
                <td style="text-align: center; font-weight: 800;">${item.quantity}</td>
                <td>
                  <strong style="font-size: 12px; color: #000;">${item.name}</strong>
                  ${item.comment ? `<div style="font-size: 10px; color: #555;">${item.comment}</div>` : ''}
                </td>
                <td style="text-align: right; font-family: monospace;">${fmt(item.price)}</td>
                <td style="text-align: right; font-family: monospace;">${fmt(itemTax)}</td>
                <td style="text-align: right; font-family: monospace; font-weight: 900;">${fmt(item.total)}</td>
              </tr>
            `;
          }).join('') : `
            <tr>
              <td colspan="5" style="text-align: center; padding: 16px; color: #666;">Sin artículos registrados</td>
            </tr>
          `}
        </tbody>
      </table>
    </div>

    <!-- Bottom Section: Disclaimers / Signature (Left) & Totals (Right) -->
    <div class="grid-2" style="align-items: start; margin-bottom: 20px;">
      <div>
        ${isCreditSale ? `
          <div style="margin-top: 10px; padding: 10px; border: 1.5px solid #000000; border-radius: 6px; font-size: 11px; background-color: #fafafa;">
            <div style="font-weight: 900; text-transform: uppercase; margin-bottom: 25px;">FIRMA DE CONFORMIDAD DEL CLIENTE</div>
            <div style="border-bottom: 1.5px solid #000000; width: 80%;"></div>
            <div style="font-size: 10px; color: #555; margin-top: 3px;">Recibido Conforme (Nombre / Firma / Cédula)</div>
          </div>
        ` : ''}

        ${invoiceData.footerText ? `
          <div style="font-size: 11px; color: #444; font-style: italic; margin-top: 10px;">
            ${invoiceData.footerText}
          </div>
        ` : ''}

        ${(invoiceData.loyaltyPointsEarned !== undefined || invoiceData.loyaltyPoints !== undefined) ? `
          <div style="margin-top: 10px; font-size: 11px; font-weight: 700; color: #000;">
            ★ PUNTOS DE LEALTAD: 
            ${invoiceData.loyaltyPointsEarned ? `+${invoiceData.loyaltyPointsEarned} pts ganados | ` : ''}
            Saldo actual: ${invoiceData.loyaltyPoints || 0} pts
          </div>
        ` : ''}
      </div>

      <!-- Totals Card -->
      <div style="border: 2px solid #000000; border-radius: 6px; padding: 12px 16px; background-color: #ffffff;">
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; font-weight: 700;">
          <span>Subtotal:</span>
          <span style="font-family: monospace; font-weight: 900;">${invoiceData.currency} ${fmt(invoiceData.subtotal)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; font-weight: 700;">
          <span>ITBIS (${invoiceData.taxRate}%):</span>
          <span style="font-family: monospace; font-weight: 900;">${invoiceData.currency} ${fmt(invoiceData.tax)}</span>
        </div>
        
        <div style="border-top: 2px solid #000000; padding-top: 8px; margin-top: 4px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 14px; font-weight: 900; text-transform: uppercase;">TOTAL A PAGAR:</span>
          <span style="font-family: monospace; font-size: 20px; font-weight: 900;">${invoiceData.currency} ${fmt(invoiceData.total)}</span>
        </div>

        <div style="border-top: 1px dashed #ccc; padding-top: 6px; margin-top: 8px; font-size: 11px; color: #444;">
          <div style="display: flex; justify-content: space-between;">
            <span>Monto Recibido:</span>
            <span style="font-family: monospace;">${invoiceData.currency} ${fmt(invoiceData.amountPaid !== undefined && invoiceData.amountPaid > 0 ? invoiceData.amountPaid : invoiceData.total)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 2px;">
            <span>Devuelta:</span>
            <span style="font-family: monospace; font-weight: 900;">${invoiceData.currency} ${fmt(invoiceData.change || 0)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Fiscal & DGII Validation -->
    <div style="border-top: 2px solid #000000; padding-top: 12px; text-align: center; font-size: 11px;">
      ${invoiceData.isElectronic && invoiceData.qrCodeUrl ? `
        <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 10px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(invoiceData.qrCodeUrl)}" alt="Código QR Fiscal" style="width: 100px; height: 100px;" />
          <div style="text-align: left; font-family: monospace; font-size: 10px; line-height: 1.4;">
            ${invoiceData.securityCode ? `<div><strong>Cód. Seguridad:</strong> ${invoiceData.securityCode}</div>` : ''}
            ${invoiceData.signatureDate ? `<div><strong>Firma Digital:</strong> ${invoiceData.signatureDate}</div>` : ''}
            <div style="font-weight: 900; margin-top: 4px; text-transform: uppercase;">Comprobante Autorizado por la DGII</div>
          </div>
        </div>
      ` : ''}

      <div style="font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">¡GRACIAS POR SU COMPRA!</div>
      
      <div style="margin-top: 12px; display: flex; justify-content: center; align-items: center; gap: 8px; font-size: 12px; font-weight: 900;">
        <span>COBROAPP</span>
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
  const sizeH1 = is58mm ? 13 : Math.round(baseFontSize * 1.35);
  const sizeBase = baseFontSize;
  const sizeSmall = is58mm ? 8 : Math.max(9, Math.round(baseFontSize * 0.88));
  const sizeXSmall = is58mm ? 7.5 : Math.max(8, Math.round(baseFontSize * 0.78));
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
          <img src="${companyData.logo}" alt="Logo" style="max-height: ${Math.min(logoHeight, is58mm ? 45 : 60)}px; max-width: 85%; object-fit: contain; margin: 0 auto; display: block;" />
        </div>
      ` : `
        <div style="display: inline-block; background-color: #ffffff; color: #000000; border: 2px solid #000000; padding: 2px 8px; border-radius: 4px; font-weight: 900; font-size: ${is58mm ? '10px' : '12px'}; text-transform: uppercase;">
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
        <div style="font-size: ${is58mm ? '7.5px' : '8.5px'}; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #000000;">
          ${invoiceData.isElectronic ? 'COMPROBANTE ELECTRÓNICO (e-NCF)' : 'COMPROBANTE DE VENTA (NCF)'}
        </div>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: ${is58mm ? '12px' : '15px'}; font-weight: 900; letter-spacing: 1px; color: #000000; margin-top: 1px; word-break: break-all;">
          ${displayNCF}
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: ${is58mm ? '8px' : '9px'}; border-top: 1.5px solid #000000; padding-top: 4px;">
        <div>
          <div style="color: #000000; font-weight: 900; text-transform: uppercase; font-size: ${is58mm ? '7.5px' : '8.5px'};">FACTURA / TIPO</div>
          <div style="font-weight: 900; color: #000000; word-break: break-word;">${fullInvoiceCode}</div>
          <div style="font-weight: 800; color: #000000; font-size: ${is58mm ? '7.5px' : '8.5px'};">(${customerTypeLabel})</div>
        </div>
        <div style="text-align: right;">
          <div style="color: #000000; font-weight: 900; text-transform: uppercase; font-size: ${is58mm ? '7.5px' : '8.5px'};">FECHA Y HORA</div>
          <div style="font-weight: 900; color: #000000;">${formattedTimeStr}</div>
          <div style="font-weight: 800; color: #000000; font-size: ${is58mm ? '7.5px' : '8.5px'};">(${formattedDateStr})</div>
        </div>
      </div>

      <div style="border-top: 1.5px solid #000000; margin-top: 4px; padding-top: 4px; font-size: ${is58mm ? '8px' : '9px'}; line-height: 1.35;">
        <div><span style="font-weight: 900; text-transform: uppercase;">CLIENTE:</span> <strong style="font-weight: 900;">${(invoiceData.customerName || 'CONSUMIDOR FINAL').toUpperCase()}</strong></div>
        ${invoiceData.customerRnc ? `<div><span style="font-weight: 900; text-transform: uppercase;">RNC CLIENTE:</span> <strong style="font-weight: 900;">${invoiceData.customerRnc}</strong></div>` : ''}
        ${invoiceData.cashierName ? `<div><span style="font-weight: 900; text-transform: uppercase;">CAJERO:</span> <strong style="font-weight: 900;">${invoiceData.cashierName.toUpperCase()}</strong></div>` : ''}
      </div>
    </div>

    <!-- Card 2: Items Table -->
    <div style="margin-bottom: 6px;">
      <div style="background-color: #ffffff; color: #000000; padding: 4px 6px; border: 2px solid #000000; border-top-left-radius: 6px; border-top-right-radius: 6px; display: flex; justify-content: space-between; font-weight: 900; font-size: ${is58mm ? '8px' : '9px'}; text-transform: uppercase;">
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
        <span style="background-color: #ffffff; border: 1.5px solid #000000; font-weight: 900; font-size: ${is58mm ? '8.5px' : '9.5px'}; padding: 1px 4px; border-radius: 4px; text-transform: uppercase;">
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
          <div style="font-size: 8px; font-weight: 900; margin-top: 3px; text-transform: uppercase;">Comprobante Autorizado por la DGII</div>
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
