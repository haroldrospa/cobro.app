import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvoiceData {
  total: number;
  items: any[];
  paymentMethod: string;
  change?: number;
  customer?: any;
  customerDebt?: number;
  date?: string;
  invoiceNumber?: string;
  invoiceType?: string;
  companyInfo?: {
    name: string;
    logo?: string;
    rnc?: string;
    phone?: string;
    website?: string;
    address?: string;
    logoSize?: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { saleData, barcodeDataUrl }: { saleData: InvoiceData; barcodeDataUrl: string } = await req.json();

    console.log('Generating PDF for sale data:', saleData);

    // Get company info from the request or use defaults
    const companyInfo: any = saleData.companyInfo || {
      name: 'Mi Empresa',
      logo: null
    };

    const logoSize = companyInfo.logoInvoiceSize || companyInfo.logoSize || 120;

    // Generate HTML for the invoice with same format as print
    const invoiceHTML = `
      <html>
        <head>
          <title>Factura - ${companyInfo.name}</title>
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              background-color: #f7fafc;
              font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            .invoice-card {
              max-width: 800px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.05);
              border: 1px solid #e2e8f0;
            }
            .header {
              background-color: white;
              color: #1a1a1a;
              padding: 40px;
              text-align: center;
              border-bottom: 2px solid #edf2f7;
            }
            .header img {
              display: block;
              margin: 0 auto 20px auto;
            }
            .header h1 {
              margin: 0;
              font-size: 32px;
              font-weight: 800;
              text-transform: uppercase;
            }
            .content {
              padding: 40px;
            }
            .invoice-title-box {
              background-color: #f8fafc;
              border: 1px solid #edf2f7;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              margin-bottom: 40px;
            }
            .section-title {
              color: #718096;
              font-size: 12px;
              text-transform: uppercase;
              font-weight: 700;
              letter-spacing: 0.05em;
              margin-bottom: 10px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-bottom: 40px;
            }
            .info-block p {
              margin: 4px 0;
              font-size: 14px;
              color: #4a5568;
            }
            .info-block strong {
              color: #1a202c;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 40px;
            }
            .items-table th {
              text-align: left;
              padding: 12px 0;
              border-bottom: 2px solid #edf2f7;
              color: #718096;
              font-size: 12px;
              text-transform: uppercase;
            }
            .items-table td {
              padding: 16px 0;
              border-bottom: 1px solid #edf2f7;
              font-size: 14px;
              color: #2d3748;
            }
            .items-table .text-right { text-align: right; }
            .items-table .text-center { text-align: center; }
            .totals-container {
              display: flex;
              justify-content: flex-end;
            }
            .totals-table {
              width: 250px;
            }
            .totals-table tr td {
              padding: 8px 0;
              font-size: 14px;
            }
            .total-row {
              font-weight: 800;
              font-size: 20px;
              color: #1a1a1a;
              border-top: 2px solid #1a1a1a;
            }
            .total-row td {
              padding-top: 20px !important;
            }
            .footer {
              background-color: #f8fafc;
              padding: 40px;
              text-align: center;
              border-top: 1px solid #edf2f7;
            }
            .barcode-container {
              margin-top: 30px;
              text-align: center;
            }
            .barcode-img {
              max-height: 60px;
            }
            @media print {
              body { background: white; padding: 0; }
              .invoice-card { box-shadow: none; border: none; width: 100%; max-width: none; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-card">
            <div class="header">
              ${companyInfo.logo ? `<img src="${companyInfo.logo}" style="width: ${logoSize}px; height: auto; margin-bottom: -15px;" />` : ''}
              <h1 style="margin: 0; padding: 0; line-height: 1.0;">${companyInfo.name || 'MI EMPRESA'}</h1>
              <div style="margin-top: 15px; color: #4a5568; font-size: 14px; line-height: 1.6;">
                ${companyInfo.rnc ? `<div>RNC: ${companyInfo.rnc}</div>` : ''}
                ${companyInfo.phone ? `<div>Tel: ${companyInfo.phone}</div>` : ''}
                ${companyInfo.address ? `<div>${companyInfo.address}</div>` : ''}
              </div>
            </div>

            <div class="content">
              <div class="invoice-title-box">
                <div class="section-title">Factura de Venta</div>
                <div style="font-size: 24px; font-weight: 800; color: #1a1a1a;">${saleData.invoiceNumber}</div>
                <div style="font-size: 12px; color: #718096; margin-top: 5px;">Fecha: ${new Date().toLocaleDateString('es-DO')} &bull; Hora: ${new Date().toLocaleTimeString('es-DO')}</div>
              </div>

              <div class="info-grid">
                <div class="info-block">
                  <div class="section-title">Cliente</div>
                  <p><strong>${saleData.customer ? saleData.customer.name : 'Venta al Contado'}</strong></p>
                  <p>Método de Pago: ${saleData.paymentMethod.toUpperCase()}</p>
                </div>
                <div class="info-block" style="text-align: right">
                  <div class="section-title">Detalles Fiscales</div>
                  <p><strong>NCF:</strong> ${saleData.invoiceType || 'B02'}</p>
                </div>
              </div>

              <table class="items-table">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th class="text-center">Cant.</th>
                    <th class="text-right">Precio</th>
                    <th class="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${saleData.items.map(item => `
                    <tr>
                      <td>${item.name}</td>
                      <td class="text-center">${item.quantity}</td>
                      <td class="text-right">$${item.price.toFixed(2)}</td>
                      <td class="text-right" style="font-weight: 700;">$${(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <div class="totals-container">
                <table class="totals-table">
                  <tr>
                    <td>Subtotal</td>
                    <td class="text-right">$${(saleData.total / 1.18).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>ITBIS (18%)</td>
                    <td class="text-right">$${(saleData.total - (saleData.total / 1.18)).toFixed(2)}</td>
                  </tr>
                  <tr class="total-row">
                    <td>TOTAL</td>
                    <td class="text-right">$${saleData.total.toFixed(2)}</td>
                  </tr>
                </table>
              </div>

              ${barcodeDataUrl ? `
                <div class="barcode-container">
                  <img src="${barcodeDataUrl}" class="barcode-img" />
                  <p style="font-family: monospace; font-size: 12px; color: #718096; margin-top: 10px;">${saleData.invoiceNumber}</p>
                </div>
              ` : ''}
            </div>

            <div class="footer">
              <h2 style="margin: 0; font-size: 18px; color: #1a202c;">¡Gracias por preferirnos!</h2>
              <p style="margin: 5px 0 0 0; color: #718096; font-size: 14px;">Conserve este comprobante para sus registros.</p>
              <div style="margin-top: 25px; font-size: 12px; color: #a0aec0; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                 ${companyInfo.website || ''} ${companyInfo.website ? '&bull;' : ''} ${companyInfo.phone || ''}
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // For demo purposes, return the HTML as base64 encoded
    const base64HTML = btoa(unescape(encodeURIComponent(invoiceHTML)));

    return new Response(
      JSON.stringify({
        success: true,
        pdfData: base64HTML,
        format: 'html'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});