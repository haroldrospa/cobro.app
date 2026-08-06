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
  pageMargin?: string;
  containerPadding?: string;
  logoMarginBottom?: string;
  logoWidth?: 'auto' | 'full';
  fontSize?: number;
}

export const generateCleanInvoiceHTML = (
  companyData: CompanyData,
  invoiceData: InvoiceData
): string => {
  const logoHeight = companyData.logoSize || 55;
  const pageMargin = companyData.pageMargin || '0mm';
  const containerPadding = companyData.containerPadding || '6px';
  const baseFontSize = companyData.fontSize || 12;

  // Calculate relative sizes
  const sizeH1 = Math.round(baseFontSize * 1.35); // ~16px
  const sizeBase = baseFontSize; // 12px
  const sizeSmall = Math.max(9, Math.round(baseFontSize * 0.88)); // ~11px
  const sizeXSmall = Math.max(8, Math.round(baseFontSize * 0.78)); // ~10px

  const companyInitials = companyData.name
    ? companyData.name.split(' ').map(w => w[0]).join('').substring(0, 8).toUpperCase()
    : 'POS';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura ${invoiceData.invoiceNumber}</title>
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
  </style>
</head>
<body>
  <div class="invoice-container">
    
    <!-- Top Monogram Badge / Logo -->
    <div style="text-align: center; margin-bottom: 8px;">
      ${companyData.logo ? `
        <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 4px;">
          <img src="${companyData.logo}" alt="Logo" style="max-height: ${Math.min(logoHeight, 55)}px; max-width: 80%; object-fit: contain; margin: 0 auto; display: block; filter: grayscale(100%) contrast(150%);" />
        </div>
      ` : `
        <div style="display: inline-block; background-color: #000000; color: #ffffff; padding: 4px 14px; border-radius: 6px; font-weight: 900; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase;">
          ${companyInitials}
        </div>
      `}
    </div>
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 10px;">
      <div style="font-size: ${sizeH1}px; font-weight: 900; color: #000000; text-transform: uppercase; letter-spacing: -0.3px; line-height: 1.15;">
        ${companyData.name}
      </div>
      ${(companyData.rnc || companyData.phone) ? `
        <div style="font-size: ${sizeSmall}px; color: #4b5563; margin-top: 3px; font-weight: 500;">
          ${companyData.rnc ? `RNC: ${companyData.rnc}` : ''} ${companyData.rnc && companyData.phone ? '|' : ''} ${companyData.phone ? `Tel: ${companyData.phone}` : ''}
        </div>
      ` : ''}
      ${companyData.address ? `
        <div style="font-size: ${sizeSmall}px; color: #4b5563; margin-top: 1px; font-weight: 500;">
          ${companyData.address}
        </div>
      ` : ''}
      <div style="border-bottom: 2px solid #000000; margin-top: 8px; width: 100%;"></div>
    </div>
    
    <!-- Card 1: Comprobante & Info Card -->
    <div style="background-color: #f4f4f6; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 900; font-size: ${sizeSmall}px; color: #000000; text-transform: uppercase;">
        <span>${invoiceData.isElectronic ? 'COMPROBANTE ELECTRÓNICO' : 'COMPROBANTE DE VENTA'}</span>
        <span style="font-family: 'JetBrains Mono', 'SF Mono', monospace; font-size: ${sizeSmall}px;">${invoiceData.isElectronic ? (invoiceData.encf || invoiceData.invoiceNumber) : invoiceData.invoiceNumber}</span>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: ${sizeXSmall}px;">
        <div>
          <div style="color: #64748b; font-weight: 700; text-transform: uppercase;">FACTURA / TIPO</div>
          <div style="font-weight: 800; color: #000000; margin-top: 1px;">
            ${invoiceData.invoicePrefix}${invoiceData.invoiceNumber.replace(/^FAC-/, '')} (${invoiceData.customerName && invoiceData.customerName !== 'CLIENTE FINAL' ? 'Comprobante Fiscal' : 'Consumidor Final'})
          </div>
        </div>
        <div style="text-align: right;">
          <div style="color: #64748b; font-weight: 700; text-transform: uppercase;">FECHA Y HORA</div>
          <div style="font-weight: 800; color: #000000; margin-top: 1px;">
            ${invoiceData.date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })} (${invoiceData.date.toLocaleDateString('es-DO')})
          </div>
        </div>
      </div>

      <div style="border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 6px; font-size: ${sizeXSmall}px; line-height: 1.4;">
        <div><span style="color: #475569; font-weight: 700;">CLIENTE:</span> <strong style="color: #000000; font-weight: 800;">${(invoiceData.customerName || 'CONSUMIDOR FINAL').toUpperCase()}</strong></div>
        ${invoiceData.cashierName ? `<div><span style="color: #475569; font-weight: 700;">CAJERO:</span> <strong style="color: #000000; font-weight: 800;">${invoiceData.cashierName.toUpperCase()}</strong></div>` : ''}
      </div>
    </div>

    <!-- Card 2: Items Table -->
    <div style="margin-bottom: 8px;">
      <div style="background-color: #0f172a; color: #ffffff; padding: 6px 10px; border-top-left-radius: 8px; border-top-right-radius: 8px; display: flex; justify-content: space-between; font-weight: 800; font-size: ${sizeXSmall}px; text-transform: uppercase; letter-spacing: 0.5px;">
        <span>CANT / DESCRIPCIÓN</span>
        <span>TOTAL</span>
      </div>
      
      <div style="border: 1px solid #e2e8f0; border-top: none; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; padding: 6px 10px; background-color: #ffffff;">
        ${invoiceData.items.map(item => `
          <div style="padding: 6px 0; border-bottom: 1px dotted #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <div style="font-weight: 800; font-size: ${sizeSmall}px; color: #000000; flex: 1; padding-right: 6px;">
                <span style="background-color: #e2e8f0; color: #000000; padding: 1px 5px; border-radius: 4px; font-weight: 900; font-size: 10px; margin-right: 4px;">${item.quantity}x</span>
                ${item.name}
              </div>
              <div style="font-family: 'JetBrains Mono', 'SF Mono', monospace; font-weight: 900; font-size: ${sizeSmall}px; color: #000000; white-space: nowrap;">
                ${invoiceData.currency} ${item.total.toFixed(2)}
              </div>
            </div>
            <div style="font-size: ${sizeXSmall}px; color: #64748b; margin-top: 2px;">
              ${invoiceData.currency} ${item.price.toFixed(2)} c/u ${item.comment ? `• (${item.comment})` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Card 3: Subtotal / ITBIS / TOTAL A PAGAR -->
    <div style="background-color: #f4f4f6; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; font-size: ${sizeSmall}px; color: #475569; margin-bottom: 3px;">
        <span>Subtotal:</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #000000;">${invoiceData.currency} ${invoiceData.subtotal.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: ${sizeSmall}px; color: #475569; margin-bottom: 4px;">
        <span>ITBIS (${invoiceData.taxRate}%):</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #000000;">${invoiceData.currency} ${invoiceData.tax.toFixed(2)}</span>
      </div>
      
      <div style="border-top: 1px solid #cbd5e1; margin-top: 4px; padding-top: 6px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 900; font-size: ${sizeBase}px; color: #000000; text-transform: uppercase;">TOTAL A PAGAR:</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-weight: 900; font-size: ${Math.round(sizeBase * 1.3)}px; color: #000000;">${invoiceData.currency} ${invoiceData.total.toFixed(2)}</span>
      </div>
    </div>

    <!-- Card 4: Método de Pago -->
    <div style="background-color: #f4f4f6; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="font-weight: 800; font-size: ${sizeXSmall}px; color: #334155; text-transform: uppercase;">MÉTODO DE PAGO:</span>
        <span style="background-color: #000000; color: #ffffff; font-weight: 900; font-size: 10px; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
          ${(invoiceData.paymentMethod || 'EFECTIVO').toUpperCase()}
        </span>
      </div>
      
      <div style="display: flex; justify-content: space-between; font-size: ${sizeSmall}px; color: #475569; margin-top: 3px;">
        <span>Monto Recibido:</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #000000;">${invoiceData.currency} ${(invoiceData.amountPaid !== undefined && invoiceData.amountPaid > 0 ? invoiceData.amountPaid : invoiceData.total).toFixed(2)}</span>
      </div>

      <div style="display: flex; justify-content: space-between; font-size: ${sizeSmall}px; color: #475569; margin-top: 2px;">
        <span>Devuelta:</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-weight: 900; color: #059669;">${invoiceData.currency} ${(invoiceData.change || 0).toFixed(2)}</span>
      </div>
    </div>

    ${(invoiceData.loyaltyPointsEarned !== undefined || invoiceData.loyaltyPoints !== undefined) ? `
      <div style="border-top: 1px dashed #cbd5e1; margin-top: 8px; padding-top: 6px; text-align: center;">
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

    <!-- Barcode & Footer Disclaimer -->
    <div style="border-top: 2px solid #000000; padding-top: 10px; margin-top: 8px; text-align: center;">
      ${invoiceData.showBarcode && invoiceData.barcodeDataUrl && !invoiceData.isElectronic ? `
        <div style="margin-bottom: 6px;">
          <img src="${invoiceData.barcodeDataUrl}" alt="Código de barras" style="max-width: 90%; height: 35px; margin: 0 auto; display: block; filter: grayscale(100%);" />
        </div>
      ` : ''}

      ${invoiceData.isElectronic && invoiceData.qrCodeUrl ? `
        <div style="text-align: center; margin-bottom: 8px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(invoiceData.qrCodeUrl)}" alt="Código QR Fiscal" style="width: 95px; height: 95px; display: block; margin: 0 auto;" />
          
          <div style="font-size: 9px; text-align: left; margin: 6px auto 0 auto; width: fit-content; font-family: 'JetBrains Mono', monospace; line-height: 1.35; color: #334155;">
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
          
          <div style="font-size: 8px; font-weight: 800; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Comprobante Autorizado por la DGII</div>
        </div>
      ` : ''}
      
      <div style="font-weight: 900; font-size: ${sizeSmall}px; color: #000000; text-transform: uppercase; letter-spacing: 0.3px;">
        ¡GRACIAS POR SU COMPRA!
      </div>
      
      ${invoiceData.footerText ? `
        <div style="font-size: ${sizeXSmall}px; color: #64748b; margin-top: 3px; padding: 0 4px;">
          ${invoiceData.footerText}
        </div>
      ` : ''}

      ${invoiceData.paymentTerms ? `
        <div style="font-size: ${sizeXSmall}px; color: #64748b; margin-top: 2px;">
          Términos de pago: ${invoiceData.paymentTerms} días
        </div>
      ` : ''}

      <div style="margin-top: 8px; font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px;">
        ${companyData.name?.toUpperCase() || 'COBRO'} POS
      </div>
    </div>

  </div>
</body>
</html>
  `.trim();
};
