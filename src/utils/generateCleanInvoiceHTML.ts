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
  const containerPadding = companyData.containerPadding || '4px';
  const logoMarginBottom = companyData.logoMarginBottom || '6px';
  const logoWidth = companyData.logoWidth || 'auto';
  const baseFontSize = companyData.fontSize || 12;

  // App branding
  const appLogo = '/src/assets/cobro-logo.png'; // Direct path reference since imports might behave differently in util functions depending on context, but let's try to stick to what works. 
  // actually, let's use the import if possible.


  // Calculate relative sizes
  const sizeH1 = Math.round(baseFontSize * 1.5); // 18px
  const sizeH2 = Math.round(baseFontSize * 1.25); // 15px
  const sizeBase = baseFontSize; // 12px
  const sizeSmall = Math.round(baseFontSize * 0.9); // 11px
  const sizeXSmall = Math.round(baseFontSize * 0.85); // 10px

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
    }
    
    @page {
      size: auto;
      margin: ${pageMargin};
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #ffffff;
      color: #000000;
      padding: 0;
      max-width: 80mm;
      margin: 0 auto;
      font-size: ${sizeBase}px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      font-smoothing: antialiased;
      line-height: 1.2;
    }
    
    @media print {
      body {
        padding: 0;
        margin: 0;
        width: 100%;
        color: #000;
        background: #fff;
      }
      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    
    .invoice-container {
      background: #ffffff;
      color: #000000;
      padding: ${containerPadding};
      border: none;
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
      : `max-height: ${logoHeight}px; height: auto; width: auto;`}
      max-width: 100%;
      object-fit: contain;
      filter: grayscale(100%) contrast(150%);
      display: block;
      margin: 0 auto;
    }
    
    /* Header */
    .header {
      text-align: center;
      border-bottom: 3px solid #000;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    
    .company-name {
      font-size: ${sizeH1}px;
      font-weight: 800;
      color: #000;
      margin-bottom: 4px;
      line-height: 1.1;
      text-transform: uppercase;
      letter-spacing: -0.5px;
    }
    
    .company-info {
      font-size: ${sizeSmall}px;
      font-weight: 500;
      color: #000;
      line-height: 1.3;
    }
    
    /* Invoice Number */
    .invoice-number {
      text-align: center;
      border-bottom: 2px solid #000;
      padding: 6px 0;
      margin-bottom: 6px;
    }
    
    .invoice-label {
      font-size: ${sizeH2}px;
      font-weight: bold;
      color: #000;
      line-height: 1;
    }
    
    .invoice-id {
      font-size: ${Math.round(sizeBase * 1.15)}px;
      font-family: 'Courier New', Courier, monospace;
      color: #000;
      margin-top: 4px;
      font-weight: bold;
      letter-spacing: 1px;
    }
    
    .invoice-date {
      font-size: ${sizeSmall}px;
      color: #000;
      margin-top: 4px;
    }
    
    /* Items */
    .items {
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      padding: 4px 0;
      margin-bottom: 6px;
    }
    
    .item {
      display: flex;
      justify-content: space-between;
      font-size: ${sizeSmall}px;
      font-weight: 500;
      color: #000;
      margin-bottom: 4px;
      line-height: 1.2;
    }
    
    /* Ensure item text scales too */
    .item span {
        font-size: inherit;
    }
    
    .item-name {
      flex: 1;
      padding-right: 4px;
    }
    
    .item-price {
      font-family: 'Courier New', monospace;
      white-space: nowrap;
      margin-left: 4px;
      font-weight: 500;
    }
    
    /* Totals */
    .totals {
      margin-bottom: 6px;
    }
    
    .total-line {
      display: flex;
      justify-content: space-between;
      font-size: ${sizeSmall}px;
      color: #000;
      margin-bottom: 2px;
      line-height: 1.3;
    }
    
    .total-line.grand-total {
      border-top: 3px solid #000;
      padding-top: 10px;
      margin-top: 6px;
      font-size: ${sizeH2}px;
      font-weight: 900;
    }
    
    .total-value {
      font-family: 'Courier New', Courier, monospace;
      font-weight: bold;
    }
    
    /* Footer */
    .footer {
      border-top: 2px solid #000;
      padding-top: 8px;
      margin-top: 12px;
      text-align: center;
    }
    
    .footer-text {
      font-size: ${sizeSmall}px;
      font-weight: 500;
      color: #000;
      margin-bottom: 8px;
    }
    
    .payment-terms {
      font-size: ${sizeXSmall}px;
      font-weight: 500;
      color: #000;
      margin-bottom: 12px;
      text-align: center;
    }
    
    /* Barcode - CENTERED */
    .barcode {
      text-align: center;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 2px dashed #000;
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
      margin-top: 16px;
      padding-top: 12px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      opacity: 1;
      border-top: 1px dashed #000;
    }
    .app-watermark img {
      height: 16px;
      width: auto;
      filter: grayscale(100%) contrast(150%);
    }
    .app-watermark span {
      font-size: 10px;
      font-weight: 800;
      color: #000;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-family: 'Inter', sans-serif;
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
        ${companyData.phone ? `${companyData.phone}<br>` : ''}
        ${companyData.address ? `${companyData.address}` : ''}
      </div>
    </div>
    
    <div class="invoice-number">
      <div class="invoice-label">${invoiceData.isElectronic ? 'e-CF' : 'NCF'}</div>
      <div class="invoice-id">${invoiceData.isElectronic ? (invoiceData.encf || invoiceData.invoiceNumber) : invoiceData.invoiceNumber}</div>
      <div class="invoice-date">${invoiceData.date.toLocaleDateString('es-DO')}</div>
    </div>
    
    <div style="border-top: 2px dashed #000; padding: 6px 0; margin-bottom: 6px; font-size: ${sizeSmall}px; text-align: left;">
      <div style="font-weight: bold; margin-bottom: 2px;">CLIENTE: ${invoiceData.customerName || 'CLIENTE FINAL'}</div>
      ${invoiceData.customerRnc ? `<div style="margin-bottom: 2px;">RNC/Cédula: ${invoiceData.customerRnc}</div>` : ''}
      ${invoiceData.customerPhone ? `<div style="margin-bottom: 2px;">Tel: ${invoiceData.customerPhone}</div>` : ''}
      ${invoiceData.customerAddress ? `<div style="margin-bottom: 2px;">${invoiceData.customerAddress}</div>` : ''}
    </div>
    
    <div class="items">
      ${invoiceData.items.map(item => `
        <div class="item">
          <div style="display: flex; flex-direction: column; width: 100%;">
            <div style="display: flex; justify-content: space-between;">
              <span class="item-name">${item.name} x${item.quantity}</span>
              <span class="item-price">${invoiceData.currency} ${item.total.toFixed(2)}</span>
            </div>
            ${item.comment ? `<div style="font-size: 0.85em; color: #666; font-style: italic; margin-left: 4px;">(${item.comment})</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="totals">
      <div class="total-line">
        <span>Subtotal:</span>
        <span class="total-value">${invoiceData.currency} ${invoiceData.subtotal.toFixed(2)}</span>
      </div>
      <div class="total-line">
        <span>ITBIS (${invoiceData.taxRate}%):</span>
        <span class="total-value">${invoiceData.currency} ${invoiceData.tax.toFixed(2)}</span>
      </div>
      <div class="total-line grand-total">
        <span>TOTAL:</span>
        <span class="total-value">${invoiceData.currency} ${invoiceData.total.toFixed(2)}</span>
      </div>
    </div>
    
    ${invoiceData.footerText ? `
      <div class="footer">
        <div class="footer-text">${invoiceData.footerText}</div>
      </div>
    ` : ''}
    
    ${invoiceData.paymentTerms ? `
      <div class="payment-terms">
        Términos de pago: ${invoiceData.paymentTerms} días
      </div>
    ` : ''}

    ${(invoiceData.loyaltyPointsEarned !== undefined || invoiceData.loyaltyPoints !== undefined) ? `
      <div style="border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; text-align: center;">
        <div style="font-size: ${sizeSmall}px; font-weight: bold; margin-bottom: 2px;">★ PUNTOS DE LEALTAD ★</div>
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
      <div style="text-align: center; margin-top: 16px; padding-top: 12px; border-top: 1px dashed #000;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(invoiceData.qrCodeUrl)}" alt="Código QR Fiscal" style="width: 110px; height: 110px; display: block; margin: 0 auto;" />
        
        <div style="font-size: 10px; text-align: left; margin: 8px auto 0 auto; width: fit-content; font-family: monospace; line-height: 1.4;">
          ${invoiceData.securityCode ? `<div><strong>Código de seguridad:</strong> ${invoiceData.securityCode}</div>` : ''}
          ${invoiceData.signatureDate ? `
            <div>
              <strong>Fecha firma digital:</strong> 
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
        
        <div style="font-size: 8px; font-weight: bold; color: #666; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Comprobante Autorizado por la DGII</div>
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
