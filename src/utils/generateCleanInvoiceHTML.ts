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
  const logoHeight = companyData.logoSize || 60;
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

  // Helper to format currency with thousands separators (e.g. 1,529.66)
  const fmt = (num: number | undefined): string => {
    return (num || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

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

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura ${displayNCF}</title>
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
    
    <!-- Top Monogram / Logo Section -->
    <div style="text-align: center; margin-bottom: 8px;">
      ${companyData.logo ? `
        <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 4px;">
          <img src="${companyData.logo}" alt="Logo" style="max-height: ${Math.min(logoHeight, 65)}px; max-width: 85%; object-fit: contain; margin: 0 auto; display: block;" />
        </div>
      ` : `
        <div style="display: inline-block; background-color: #09090b; color: #ffffff; padding: 4px 14px; border-radius: 6px; font-weight: 900; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase;">
          ${companyInitials}
        </div>
      `}
    </div>
    
    <!-- Company Header -->
    <div style="text-align: center; margin-bottom: 10px;">
      <div style="font-size: ${sizeH1}px; font-weight: 900; color: #09090b; text-transform: uppercase; letter-spacing: -0.3px; line-height: 1.2;">
        ${companyData.name}
      </div>
      ${(companyData.rnc || companyData.phone) ? `
        <div style="font-size: ${sizeSmall}px; color: #334155; margin-top: 3px; font-weight: 600;">
          ${companyData.rnc ? `RNC: ${companyData.rnc}` : ''} ${companyData.rnc && companyData.phone ? '•' : ''} ${companyData.phone ? `Tel: ${companyData.phone}` : ''}
        </div>
      ` : ''}
      ${companyData.address ? `
        <div style="font-size: ${sizeSmall}px; color: #475569; margin-top: 1px; font-weight: 500;">
          ${companyData.address}
        </div>
      ` : ''}
      <div style="border-bottom: 2px solid #09090b; margin-top: 8px; width: 100%;"></div>
    </div>
    
    <!-- Card 1: Comprobante & Info Card -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 900; font-size: ${sizeSmall}px; color: #0f172a; text-transform: uppercase;">
        <span>${invoiceData.isElectronic ? 'COMPROBANTE ELECTRÓNICO' : 'COMPROBANTE DE VENTA'}</span>
        <span style="font-family: 'JetBrains Mono', 'SF Mono', monospace; font-size: ${sizeSmall}px; background-color: #e2e8f0; padding: 1px 6px; border-radius: 4px; font-weight: 800;">${displayNCF}</span>
      </div>
      
      <!-- Grid layout for Factura/Tipo and Fecha/Hora to prevent text collision -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; font-size: ${sizeXSmall}px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
        <div>
          <div style="color: #64748b; font-weight: 800; text-transform: uppercase; font-size: 9px; letter-spacing: 0.4px;">FACTURA / TIPO</div>
          <div style="font-weight: 800; color: #09090b; margin-top: 2px; line-height: 1.2; word-break: break-word;">
            ${fullInvoiceCode}
          </div>
          <div style="font-weight: 600; color: #475569; font-size: 9px;">(${customerTypeLabel})</div>
        </div>
        <div style="text-align: right;">
          <div style="color: #64748b; font-weight: 800; text-transform: uppercase; font-size: 9px; letter-spacing: 0.4px;">FECHA Y HORA</div>
          <div style="font-weight: 800; color: #09090b; margin-top: 2px; line-height: 1.2;">
            ${formattedTimeStr}
          </div>
          <div style="font-weight: 600; color: #475569; font-size: 9px;">(${formattedDateStr})</div>
        </div>
      </div>

      <div style="border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 6px; font-size: ${sizeXSmall}px; line-height: 1.45;">
        <div><span style="color: #64748b; font-weight: 800; font-size: 9px; text-transform: uppercase;">CLIENTE:</span> <strong style="color: #09090b; font-weight: 800;">${(invoiceData.customerName || 'CONSUMIDOR FINAL').toUpperCase()}</strong></div>
        ${invoiceData.cashierName ? `<div><span style="color: #64748b; font-weight: 800; font-size: 9px; text-transform: uppercase;">CAJERO:</span> <strong style="color: #09090b; font-weight: 800;">${invoiceData.cashierName.toUpperCase()}</strong></div>` : ''}
      </div>
    </div>

    <!-- Card 2: Items Table -->
    <div style="margin-bottom: 8px;">
      <!-- Header Bar with solid dark background and bright white text -->
      <div style="background-color: #09090b; color: #ffffff !important; padding: 6px 10px; border-top-left-radius: 8px; border-top-right-radius: 8px; display: flex; justify-content: space-between; font-weight: 900; font-size: ${sizeXSmall}px; text-transform: uppercase; letter-spacing: 0.8px;">
        <span style="color: #ffffff !important;">CANT / DESCRIPCIÓN</span>
        <span style="color: #ffffff !important;">TOTAL</span>
      </div>
      
      <div style="border: 1px solid #e2e8f0; border-top: none; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; padding: 6px 10px; background-color: #ffffff;">
        ${invoiceData.items && invoiceData.items.length > 0 ? invoiceData.items.map(item => `
          <div style="padding: 6px 0; border-bottom: 1px dotted #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <div style="font-weight: 800; font-size: ${sizeSmall}px; color: #09090b; flex: 1; padding-right: 6px;">
                <span style="background-color: #09090b; color: #ffffff !important; padding: 1px 5px; border-radius: 3px; font-weight: 900; font-size: 9px; margin-right: 4px; display: inline-block;">${item.quantity}x</span>
                ${item.name}
              </div>
              <div style="font-family: 'JetBrains Mono', 'SF Mono', monospace; font-weight: 900; font-size: ${sizeSmall}px; color: #09090b; white-space: nowrap;">
                ${invoiceData.currency} ${fmt(item.total)}
              </div>
            </div>
            <div style="font-size: ${sizeXSmall}px; color: #64748b; margin-top: 2px;">
              ${invoiceData.currency} ${fmt(item.price)} c/u ${item.comment ? `• (${item.comment})` : ''}
            </div>
          </div>
        `).join('') : `
          <div style="padding: 10px 0; text-align: center; color: #64748b; font-size: ${sizeSmall}px;">
            Sin artículos cargados
          </div>
        `}
      </div>
    </div>

    <!-- Card 3: Subtotal / ITBIS / TOTAL A PAGAR -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; font-size: ${sizeSmall}px; color: #475569; margin-bottom: 3px;">
        <span>Subtotal:</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #09090b;">${invoiceData.currency} ${fmt(invoiceData.subtotal)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: ${sizeSmall}px; color: #475569; margin-bottom: 4px;">
        <span>ITBIS (${invoiceData.taxRate}%):</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #09090b;">${invoiceData.currency} ${fmt(invoiceData.tax)}</span>
      </div>
      
      <div style="border-top: 1.5px solid #cbd5e1; margin-top: 4px; padding-top: 6px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 900; font-size: ${sizeBase}px; color: #09090b; text-transform: uppercase;">TOTAL A PAGAR:</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-weight: 900; font-size: ${Math.round(sizeBase * 1.35)}px; color: #09090b;">${invoiceData.currency} ${fmt(invoiceData.total)}</span>
      </div>
    </div>

    <!-- Card 4: Método de Pago -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="font-weight: 800; font-size: ${sizeXSmall}px; color: #334155; text-transform: uppercase;">MÉTODO DE PAGO:</span>
        <span style="background-color: #09090b; color: #ffffff !important; font-weight: 900; font-size: 10px; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
          ${pMethod}
        </span>
      </div>
      
      <div style="display: flex; justify-content: space-between; font-size: ${sizeSmall}px; color: #475569; margin-top: 4px;">
        <span>Monto Recibido:</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #09090b;">${invoiceData.currency} ${fmt(invoiceData.amountPaid !== undefined && invoiceData.amountPaid > 0 ? invoiceData.amountPaid : invoiceData.total)}</span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; font-size: ${sizeSmall}px; color: #475569; margin-top: 3px;">
        <span>Devuelta:</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-weight: 900; color: #059669; background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 1px 6px; border-radius: 4px;">
          ${invoiceData.currency} ${fmt(invoiceData.change || 0)}
        </span>
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
    <div style="border-top: 2px solid #09090b; padding-top: 10px; margin-top: 8px; text-align: center;">
      ${invoiceData.showBarcode && invoiceData.barcodeDataUrl && !invoiceData.isElectronic ? `
        <div style="margin-bottom: 6px;">
          <img src="${invoiceData.barcodeDataUrl}" alt="Código de barras" style="max-width: 90%; height: 38px; margin: 0 auto; display: block; filter: grayscale(100%);" />
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700; color: #475569; margin-top: 2px;">${displayNCF}</div>
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
      
      <div style="font-weight: 900; font-size: ${sizeSmall}px; color: #09090b; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 4px;">
        ¡GRACIAS POR SU COMPRA!
      </div>
      
      ${invoiceData.footerText ? `
        <div style="font-size: ${sizeXSmall}px; color: #475569; margin-top: 3px; padding: 0 4px;">
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
