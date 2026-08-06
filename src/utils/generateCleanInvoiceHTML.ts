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
  const containerPadding = companyData.containerPadding || '6px';
  const logoMarginBottom = companyData.logoMarginBottom || '6px';
  const logoWidth = companyData.logoWidth || 'auto';
  const baseFontSize = companyData.fontSize || 12;

  // Calculate relative sizes
  const sizeH1 = Math.round(baseFontSize * 1.4);
  const sizeH2 = Math.round(baseFontSize * 1.2);
  const sizeBase = baseFontSize;
  const sizeSmall = Math.max(9, Math.round(baseFontSize * 0.88));
  const sizeXSmall = Math.max(8, Math.round(baseFontSize * 0.78));

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
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    @page {
      size: 80mm auto;
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
      color: #111111;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: ${sizeBase}px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      line-height: 1.3;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    @media print {
      html, body {
        width: 80mm !important;
        max-width: 80mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
      }
      .invoice-container {
        padding: ${containerPadding} !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
    
    .invoice-container {
      background: #ffffff;
      color: #111111;
      padding: ${containerPadding};
      width: 100%;
      max-width: 80mm;
      margin: 0 auto;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .logo {
      text-align: center;
      margin-bottom: ${logoMarginBottom};
      display: flex;
      justify-content: center;
      align-items: center;
      page-break-inside: avoid;
      break-inside: avoid;
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
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .company-name {
      font-size: ${sizeH1}px;
      font-weight: 800;
      color: #000000;
      margin-bottom: 2px;
      line-height: 1.15;
      text-transform: uppercase;
      letter-spacing: -0.3px;
    }
    
    .company-info {
      font-size: ${sizeSmall}px;
      font-weight: 500;
      color: #333333;
      line-height: 1.35;
    }
    
    /* Modern NCF Card Box */
    .ncf-card {
      border: 1px solid #111111;
      border-radius: 6px;
      padding: 6px 8px;
      margin: 8px 0;
      text-align: center;
      background-color: #fafafa;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .ncf-label {
      font-size: ${sizeXSmall}px;
      font-weight: 800;
      color: #333333;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 2px;
    }
    
    .ncf-id {
      font-size: ${Math.round(sizeBase * 1.12)}px;
      font-family: 'JetBrains Mono', 'SF Mono', 'Roboto Mono', 'Courier New', monospace;
      font-weight: 800;
      color: #000000;
      letter-spacing: 0.5px;
    }
    
    .ncf-date {
      font-size: ${sizeXSmall}px;
      color: #555555;
      margin-top: 2px;
      font-weight: 500;
    }
    
    /* Customer Section */
    .customer-card {
      border-top: 1px dashed #cbd5e1;
      border-bottom: 1px dashed #cbd5e1;
      padding: 6px 0;
      margin-bottom: 8px;
      font-size: ${sizeSmall}px;
      color: #111111;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .customer-name {
      font-weight: 700;
      color: #000000;
      margin-bottom: 1px;
    }

    .customer-meta {
      font-size: ${sizeXSmall}px;
      color: #4b5563;
    }
    
    /* Items */
    .items {
      margin-bottom: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .items-header {
      display: flex;
      justify-content: space-between;
      font-size: ${sizeXSmall}px;
      font-weight: 800;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding-bottom: 3px;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 4px;
    }
    
    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: ${sizeSmall}px;
      padding: 3px 0;
      border-bottom: 1px dotted #f3f4f6;
    }
    
    .item-left {
      flex: 1;
      padding-right: 6px;
    }
    
    .item-name {
      font-weight: 600;
      color: #000000;
      line-height: 1.25;
    }

    .item-qty {
      font-size: ${sizeXSmall}px;
      color: #6b7280;
      margin-left: 4px;
      font-weight: 500;
    }
    
    .item-price {
      font-family: 'JetBrains Mono', 'SF Mono', 'Roboto Mono', 'Courier New', monospace;
      font-weight: 700;
      color: #000000;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    
    /* Totals */
    .totals-container {
      margin-top: 6px;
      margin-bottom: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: ${sizeSmall}px;
      color: #4b5563;
      margin-bottom: 3px;
    }
    
    .total-val {
      font-family: 'JetBrains Mono', 'SF Mono', 'Roboto Mono', 'Courier New', monospace;
      font-weight: 600;
      color: #111111;
      font-variant-numeric: tabular-nums;
    }
    
    /* High-contrast Grand Total Banner */
    .grand-total-card {
      background-color: #000000;
      color: #ffffff;
      border-radius: 6px;
      padding: 7px 10px;
      margin-top: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .grand-total-label {
      font-size: ${sizeBase}px;
      font-weight: 800;
      color: #ffffff !important;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .grand-total-val {
      font-family: 'JetBrains Mono', 'SF Mono', 'Roboto Mono', 'Courier New', monospace;
      font-size: ${sizeH2}px;
      font-weight: 900;
      color: #ffffff !important;
      font-variant-numeric: tabular-nums;
    }
    
    /* Footer */
    .footer {
      border-top: 1px dashed #cbd5e1;
      padding-top: 8px;
      margin-top: 10px;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .footer-text {
      font-size: ${sizeSmall}px;
      font-weight: 600;
      color: #111111;
      margin-bottom: 4px;
    }
    
    .payment-terms {
      font-size: ${sizeXSmall}px;
      color: #6b7280;
      margin-bottom: 6px;
    }
    
    /* Barcode */
    .barcode {
      text-align: center;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed #cbd5e1;
      page-break-inside: avoid;
      break-inside: avoid;
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
      margin-top: 12px;
      padding-top: 8px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
      border-top: 1px dashed #e2e8f0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .app-watermark img {
      height: 14px;
      width: auto;
      filter: grayscale(100%);
    }
    
    .app-watermark span {
      font-size: 9px;
      font-weight: 800;
      color: #111111;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
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
      <div class="ncf-label">${invoiceData.isElectronic ? 'Comprobante Fiscal Electrónico (e-CF)' : 'Comprobante Fiscal (NCF)'}</div>
      <div class="ncf-id">${invoiceData.isElectronic ? (invoiceData.encf || invoiceData.invoiceNumber) : invoiceData.invoiceNumber}</div>
      <div class="ncf-date">${invoiceData.date.toLocaleDateString('es-DO')} ${invoiceData.date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
    
    <div class="customer-card">
      <div class="customer-name">CLIENTE: ${invoiceData.customerName || 'CLIENTE FINAL'}</div>
      ${invoiceData.customerRnc ? `<div class="customer-meta">RNC/Cédula: ${invoiceData.customerRnc}</div>` : ''}
      ${invoiceData.customerPhone ? `<div class="customer-meta">Tel: ${invoiceData.customerPhone}</div>` : ''}
      ${invoiceData.customerAddress ? `<div class="customer-meta">${invoiceData.customerAddress}</div>` : ''}
    </div>
    
    <div class="items">
      <div class="items-header">
        <span>Cant. / Descripción</span>
        <span>Total</span>
      </div>
      ${invoiceData.items.map(item => `
        <div class="item-row">
          <div class="item-left">
            <span class="item-name">${item.name}</span>
            <span class="item-qty">x${item.quantity}</span>
            ${item.comment ? `<div style="font-size: ${sizeXSmall}px; color: #6b7280; font-style: italic; margin-top: 1px;">(${item.comment})</div>` : ''}
          </div>
          <span class="item-price">${invoiceData.currency} ${item.total.toFixed(2)}</span>
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
      <div style="border-top: 1px dashed #cbd5e1; margin-top: 8px; padding-top: 6px; text-align: center; page-break-inside: avoid; break-inside: avoid;">
        <div style="font-size: ${sizeSmall}px; font-weight: 700; margin-bottom: 2px;">★ PUNTOS DE LEALTAD ★</div>
        ${invoiceData.loyaltyPointsEarned !== undefined && invoiceData.loyaltyPointsEarned > 0 ? `
          <div style="font-size: ${sizeSmall}px; margin-bottom: 1px;">
            Ganados esta compra: <strong>+${invoiceData.loyaltyPointsEarned} pts</strong>
          </div>
        ` : ''}
        ${invoiceData.loyaltyPoints !== undefined ? `
          <div style="font-size: ${sizeSmall}px;">
            Saldo total: <strong>${invoiceData.loyaltyPoints} pts</strong>
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
      <div style="text-align: center; margin-top: 12px; padding-top: 10px; border-top: 1px dashed #cbd5e1; page-break-inside: avoid; break-inside: avoid;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(invoiceData.qrCodeUrl)}" alt="Código QR Fiscal" style="width: 104px; height: 104px; display: block; margin: 0 auto;" />
        
        <div style="font-size: 9px; text-align: left; margin: 6px auto 0 auto; width: fit-content; font-family: 'JetBrains Mono', monospace; line-height: 1.35;">
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
        
        <div style="font-size: 8px; font-weight: 700; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Comprobante Autorizado por la DGII</div>
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
