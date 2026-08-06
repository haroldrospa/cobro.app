// Utility to generate clean, black & white invoice HTML matching the Settings preview
// This ensures consistency between the preview and actual printed invoices
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
  loyaltyPoints?: number;        // puntos actuales del cliente DESPUÉS de la venta
  loyaltyPointsEarned?: number;  // puntos ganados en esta compra
  customerName?: string;
  customerRnc?: string;
  customerPhone?: string;
  customerAddress?: string;
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
  pageMargin?: string;
  containerPadding?: string;
  logoMarginBottom?: string;
  logoWidth?: 'auto' | 'full';
  fontSize?: number; // NEW: Base font size
}

export const generateCleanInvoiceHTML = (
  companyData: CompanyData,
  invoiceData: InvoiceData
): string => {
  const logoHeight = companyData.logoSize || 64;
  const pageMargin = companyData.pageMargin || '0mm';
  const containerPadding = companyData.containerPadding || '8px';
  const logoMarginBottom = companyData.logoMarginBottom || '6px';
  const logoWidth = companyData.logoWidth || 'auto';
  const baseFontSize = companyData.fontSize || 12;

  // Calculate relative sizes
  const sizeH1 = Math.round(baseFontSize * 1.35); // ~16px
  const sizeH2 = Math.round(baseFontSize * 1.15); // ~14px
  const sizeBase = baseFontSize; // 12px
  const sizeSmall = Math.max(9, Math.round(baseFontSize * 0.88)); // ~11px
  const sizeXSmall = Math.max(8, Math.round(baseFontSize * 0.78)); // ~10px

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura NCF ${invoiceData.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-before: avoid !important;
      page-break-after: avoid !important;
    }
    
    @page {
      size: 80mm 2500mm;
      margin: ${pageMargin};
    }
    
    @media screen {
      html, body {
        overflow: hidden !important;
      }
    }
    
    html, body {
      width: 100%;
      max-width: 80mm;
      margin: 0 auto;
      padding: 0;
      background-color: #ffffff;
      color: #0f172a;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: ${sizeBase}px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      line-height: 1.35;
      height: auto !important;
      min-height: auto !important;
    }
    
    @media print {
      @page {
        size: 80mm 2500mm;
        margin: 0mm;
      }
      html, body {
        width: 80mm !important;
        max-width: 80mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        height: auto !important;
        overflow: visible !important;
      }
      .invoice-container {
        padding: ${containerPadding} !important;
        width: 80mm !important;
        max-width: 80mm !important;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
    
    .invoice-container {
      background: #ffffff;
      color: #0f172a;
      padding: ${containerPadding};
      width: 100%;
      max-width: 80mm;
      margin: 0 auto;
      overflow: visible;
    }

    /* Top Accent Line */
    .top-badge {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 8px;
    }

    .top-badge-pill {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #475569;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 9999px;
      border: 1px solid #e2e8f0;
    }
    
    .logo {
      text-align: center;
      margin-bottom: ${logoMarginBottom};
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .logo img {
      ${logoWidth === 'full'
      ? 'width: 100%; height: auto;'
      : `max-height: ${Math.min(logoHeight, 60)}px; height: auto; width: auto;`}
      max-width: 80%;
      object-fit: contain;
      filter: grayscale(100%) contrast(150%);
      display: block;
      margin: 0 auto;
    }
    
    /* Header */
    .header {
      text-align: center;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }
    
    .company-name {
      font-size: ${sizeH1}px;
      font-weight: 900;
      color: #09090b;
      margin-bottom: 2px;
      line-height: 1.15;
      text-transform: uppercase;
      letter-spacing: -0.4px;
    }
    
    .company-info {
      font-size: ${sizeSmall}px;
      font-weight: 500;
      color: #475569;
      line-height: 1.35;
    }
    
    /* Ultra-Modern NCF Card Box */
    .ncf-card {
      border: 1.5px solid #18181b;
      border-radius: 8px;
      padding: 7px 10px;
      margin: 10px 0;
      text-align: center;
      background-color: #f8fafc;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
    }
    
    .ncf-header-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      margin-bottom: 3px;
    }

    .ncf-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #10b981;
    }

    .ncf-label {
      font-size: ${sizeXSmall}px;
      font-weight: 800;
      color: #1e293b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    
    .ncf-id {
      font-size: ${Math.round(sizeBase * 1.15)}px;
      font-family: 'JetBrains Mono', 'SF Mono', 'Roboto Mono', 'Courier New', monospace;
      font-weight: 800;
      color: #09090b;
      letter-spacing: 0.8px;
      line-height: 1.2;
    }
    
    .ncf-date {
      font-size: ${sizeXSmall}px;
      color: #64748b;
      margin-top: 3px;
      font-weight: 500;
    }
    
    /* Customer Card */
    .customer-card {
      border-top: 1px dashed #cbd5e1;
      border-bottom: 1px dashed #cbd5e1;
      padding: 7px 0;
      margin-bottom: 10px;
      font-size: ${sizeSmall}px;
      color: #0f172a;
    }
    
    .customer-label {
      font-size: ${sizeXSmall}px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 1px;
    }

    .customer-name {
      font-weight: 700;
      color: #09090b;
      font-size: ${sizeSmall}px;
    }

    .customer-meta {
      font-size: ${sizeXSmall}px;
      color: #475569;
      margin-top: 1px;
    }
    
    /* Items */
    .items {
      margin-bottom: 10px;
    }

    .items-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: ${sizeXSmall}px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding-bottom: 4px;
      border-bottom: 2px solid #09090b;
      margin-bottom: 6px;
    }
    
    .item-row {
      padding: 4px 0;
      border-bottom: 1px dotted #e2e8f0;
    }
    
    .item-main {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    
    .item-name {
      font-weight: 700;
      color: #09090b;
      font-size: ${sizeSmall}px;
      line-height: 1.25;
      flex: 1;
      padding-right: 6px;
    }

    .item-qty-pill {
      font-size: ${sizeXSmall}px;
      color: #475569;
      font-weight: 600;
      background: #f1f5f9;
      padding: 1px 5px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
      display: inline-block;
      margin-top: 2px;
    }
    
    .item-price {
      font-family: 'JetBrains Mono', 'SF Mono', 'Roboto Mono', 'Courier New', monospace;
      font-weight: 800;
      color: #09090b;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      font-size: ${sizeSmall}px;
    }
    
    /* Totals */
    .totals-container {
      margin-top: 8px;
      margin-bottom: 10px;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: ${sizeSmall}px;
      color: #475569;
      margin-bottom: 3px;
    }
    
    .total-val {
      font-family: 'JetBrains Mono', 'SF Mono', 'Roboto Mono', 'Courier New', monospace;
      font-weight: 700;
      color: #09090b;
      font-variant-numeric: tabular-nums;
    }
    
    /* Super Chulo High-Contrast GRAND TOTAL Card */
    .grand-total-card {
      background-color: #09090b;
      color: #ffffff;
      border-radius: 10px;
      padding: 10px 12px;
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    }
    
    .grand-total-label {
      font-size: ${sizeBase}px;
      font-weight: 900;
      color: #ffffff !important;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    
    .grand-total-val {
      font-family: 'JetBrains Mono', 'SF Mono', 'Roboto Mono', 'Courier New', monospace;
      font-size: ${Math.round(sizeBase * 1.35)}px;
      font-weight: 900;
      color: #ffffff !important;
      font-variant-numeric: tabular-nums;
    }
    
    /* Footer */
    .footer {
      border-top: 1px dashed #cbd5e1;
      padding-top: 10px;
      margin-top: 12px;
      text-align: center;
    }
    
    .footer-text {
      font-size: ${sizeSmall}px;
      font-weight: 700;
      color: #09090b;
      margin-bottom: 3px;
    }
    
    .payment-terms {
      font-size: ${sizeXSmall}px;
      color: #64748b;
      margin-bottom: 6px;
    }
    
    /* Barcode */
    .barcode {
      text-align: center;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px dashed #cbd5e1;
    }
    
    .barcode img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
      filter: grayscale(100%);
    }

    /* App Watermark */
    .app-watermark {
      margin-top: 14px;
      padding-top: 8px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
      border-top: 1px dashed #e2e8f0;
    }
    
    .app-watermark img {
      height: 14px;
      width: auto;
      filter: grayscale(100%);
    }
    
    .app-watermark span {
      font-size: 9px;
      font-weight: 900;
      color: #09090b;
      text-transform: uppercase;
      letter-spacing: 1.2px;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="top-badge">
      <span class="top-badge-pill">Recibo de Compra</span>
    </div>

    ${(companyData.logo || (companyData.name?.toLowerCase().includes('mamajuana') ? '/mamajuana-logo.png' : null)) ? `
      <div class="logo">
        <img src="${companyData.logo || '/mamajuana-logo.png'}" alt="Logo">
      </div>
    ` : ''}
    
    <div class="header">
      <div class="company-name">${companyData.name}</div>
      <div class="company-info">
        ${companyData.rnc ? `RNC: ${companyData.rnc}<br>` : ''}
        ${companyData.phone ? `Tel: ${companyData.phone}<br>` : ''}
        ${companyData.address ? `${companyData.address}` : ''}
      </div>
    </div>
    
    <div class="ncf-card">
      <div class="ncf-header-row">
        <div class="ncf-dot"></div>
        <div class="ncf-label">${invoiceData.isElectronic ? 'Comprobante Fiscal Electrónico (e-CF)' : 'Comprobante Fiscal (NCF)'}</div>
      </div>
      <div class="ncf-id">${invoiceData.isElectronic ? (invoiceData.encf || invoiceData.invoiceNumber) : invoiceData.invoiceNumber}</div>
      <div class="ncf-date">📅 ${invoiceData.date.toLocaleDateString('es-DO')} • ${invoiceData.date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
    
    <div class="customer-card">
      <div class="customer-label">Cliente</div>
      <div class="customer-name">${invoiceData.customerName || 'CLIENTE FINAL'}</div>
      ${invoiceData.customerRnc ? `<div class="customer-meta">RNC/Cédula: ${invoiceData.customerRnc}</div>` : ''}
      ${invoiceData.customerPhone ? `<div class="customer-meta">Tel: ${invoiceData.customerPhone}</div>` : ''}
      ${invoiceData.customerAddress ? `<div class="customer-meta">${invoiceData.customerAddress}</div>` : ''}
    </div>
    
    <div class="items">
      <div class="items-header">
        <span>Artículos / Cant.</span>
        <span>Total</span>
      </div>
      ${invoiceData.items.map(item => `
        <div class="item-row">
          <div class="item-main">
            <span class="item-name">${item.name}</span>
            <span class="item-price">${invoiceData.currency} ${item.total.toFixed(2)}</span>
          </div>
          <div>
            <span class="item-qty-pill">${item.quantity} × ${invoiceData.currency} ${item.price.toFixed(2)}</span>
            ${item.comment ? `<span style="font-size: ${sizeXSmall}px; color: #64748b; font-style: italic; margin-left: 4px;">(${item.comment})</span>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="totals-container">
      <div class="total-row">
        <span>Subtotal:</span>
        <span class="total-val">${invoiceData.currency} ${invoiceData.subtotal.toFixed(2)}</span>
      </div>
      <div class="total-row">
        <span>ITBIS (${invoiceData.taxRate}%):</span>
        <span class="total-val">${invoiceData.currency} ${invoiceData.tax.toFixed(2)}</span>
      </div>
      <div class="grand-total-card">
        <span class="grand-total-label">TOTAL</span>
        <span class="grand-total-val">${invoiceData.currency} ${invoiceData.total.toFixed(2)}</span>
      </div>
    </div>
    
    ${invoiceData.footerText ? `
      <div class="footer">
        <div class="footer-text">${invoiceData.footerText}</div>
      </div>
    ` : ''}
    
    ${invoiceData.paymentTerms ? `
      <div class="payment-terms" style="text-align: center;">
        Términos de pago: ${invoiceData.paymentTerms} días
      </div>
    ` : ''}

    ${(invoiceData.loyaltyPointsEarned !== undefined || invoiceData.loyaltyPoints !== undefined) ? `
      <div style="border-top: 1px dashed #cbd5e1; margin-top: 10px; padding-top: 8px; text-align: center;">
        <div style="font-size: ${sizeSmall}px; font-weight: 800; margin-bottom: 2px;">★ PUNTOS DE LEALTAD ★</div>
        ${invoiceData.loyaltyPointsEarned !== undefined && invoiceData.loyaltyPointsEarned > 0 ? `
          <div style="font-size: ${sizeSmall}px; margin-bottom: 1px; color: #475569;">
            Ganados esta compra: <strong style="color: #09090b;">+${invoiceData.loyaltyPointsEarned} pts</strong>
          </div>
        ` : ''}
        ${invoiceData.loyaltyPoints !== undefined ? `
          <div style="font-size: ${sizeSmall}px; color: #475569;">
            Saldo total: <strong style="color: #09090b;">${invoiceData.loyaltyPoints} pts</strong>
          </div>
        ` : ''}
      </div>
    ` : ''}
    
    ${invoiceData.showBarcode && invoiceData.barcodeDataUrl && !invoiceData.isElectronic ? `
      <div class="barcode">
        <img src="${invoiceData.barcodeDataUrl}" alt="Código de Barras NCF">
      </div>
    ` : ''}

    ${invoiceData.isElectronic && invoiceData.qrCodeUrl ? `
      <div style="text-align: center; margin-top: 14px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(invoiceData.qrCodeUrl)}" alt="Código QR Fiscal" style="width: 104px; height: 104px; display: block; margin: 0 auto;" />
        
        <div style="font-size: 9px; text-align: left; margin: 8px auto 0 auto; width: fit-content; font-family: 'JetBrains Mono', monospace; line-height: 1.35; color: #334155;">
          ${invoiceData.securityCode ? `<div><strong>Cód. Seguridad:</strong> ${invoiceData.securityCode}</div>` : ''}
          ${invoiceData.signatureDate ? `
            <div>
              <strong>Firma digital:</strong> 
              ${(() => {
                try {
                  const d = new Date(invoiceData.signatureDate);
                  const day = String(d.getDate()).padStart(2, '0');
                  const month = String(d.getMonth() + 1).padStart(2, '0');
                  const year = d.getFullYear();
                  const hours = String(d.getHours()).padStart(2, '0');
                  const minutes = String(d.getMinutes()).padStart(2, '0');
                  const seconds = String(d.getSeconds()).padStart(2, '0');
                  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
                } catch (_) {
                  return invoiceData.signatureDate;
                }
              })()}
            </div>
          ` : ''}
        </div>
        
        <div style="font-size: 8px; font-weight: 800; color: #64748b; margin-top: 5px; text-transform: uppercase; letter-spacing: 0.5px;">Comprobante Autorizado por la DGII</div>
      </div>
    ` : ''}

    <div class="app-watermark">
      <img src="${typeof window !== 'undefined' ? window.location.origin : ''}/cobro-logo.png" alt="Cobro">
      <span>Cobro</span>
    </div>
  </div>
</body>
</html>
  `.trim();
};
