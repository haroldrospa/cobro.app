import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EmailRequest {
  email: string;
  saleData: {
    total: number;
    items: any[];
    paymentMethod: string;
    change?: number;
    customer?: any;
    customerDebt?: number;
    previousDebt?: number;
    pendingInvoicesCount?: number;
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
  };
  barcodeDataUrl?: string;
  pdfBase64?: string;
  emailGreeting?: string;
  emailMessage?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, saleData, pdfBase64, emailGreeting, emailMessage }: EmailRequest = await req.json();

    console.log(`Sending professional invoice ${saleData.invoiceNumber} to: ${email}`);

    const companyInfo: any = saleData.companyInfo || {
      name: 'Mi Empresa'
    };

    const attachments: any[] = [];

    if (pdfBase64) {
      attachments.push({
        filename: `${saleData.invoiceNumber || 'Factura'}.pdf`,
        content: pdfBase64,
        contentType: 'application/pdf',
      });
    }

    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.4; color: #333; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
          .container { max-width: 600px; margin: 20px auto; padding: 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; }
          .header { background: #ffffff; padding: 20px 20px 15px; text-align: center; }
          .logo-text { font-size: 22px; font-weight: 800; color: #1a1a1a; margin: 0; letter-spacing: -0.3px; text-transform: uppercase; }
          .content { background: #ffffff; padding: 20px 30px 15px; }
          .greeting { font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 12px; }
          .message { font-size: 14px; color: #4a5568; margin-bottom: 20px; line-height: 1.5; }
          .invoice-box { background: #f8fafc; border-radius: 6px; padding: 18px; margin-bottom: 15px; border: 1px solid #edf2f7; text-align: center; }
          .ncf-title { font-size: 11px; font-weight: 700; color: #718096; text-transform: uppercase; margin-bottom: 4px; }
          .ncf-value { font-size: 20px; font-weight: 800; color: #2d3748; margin-bottom: 12px; }
          .total-label { font-size: 12px; color: #718096; margin-bottom: 2px; }
          .total-value { font-size: 26px; font-weight: 800; color: #1a202c; }
          .divider { height: 1px; background: #edf2f7; margin: 15px 0; }
          .footer { background: #ffffff; padding: 0 30px 20px; text-align: center; font-size: 11px; color: #a0aec0; }
          .footer-text { margin-bottom: 8px; }
          .highlight { color: #3182ce; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${companyInfo.logo ? `<img src="${companyInfo.logo}" alt="${companyInfo.name}" style="max-width: 80px; height: auto; margin-bottom: 10px;" />` : ''}
            <h1 class="logo-text">${companyInfo.name}</h1>
          </div>
          
          <div class="content">
            <p class="greeting">${emailGreeting || '¡Hola!'}</p>
            <p class="message">
              ${emailMessage || `Le agradecemos sinceramente por elegirnos y por la confianza depositada en <span class="highlight">${companyInfo.name}</span>. Valoramos enormemente su preferencia y estamos comprometidos con brindarle siempre la mejor calidad y servicio.`}
            </p>

            <div class="invoice-box">
              <div class="ncf-title">Comprobante Fiscal</div>
              <div class="ncf-value">${saleData.invoiceNumber}</div>
              <div class="total-label">Total Facturado</div>
              <div class="total-value">RD$ ${Number(saleData.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            
              ${saleData.customerDebt ? `
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #cbd5e0;">
                <div class="total-label" style="color: #d97706; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Estado de Cuenta</div>
                
                ${saleData.previousDebt && saleData.previousDebt > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 13px; color: #92400e; margin-bottom: 6px; margin-top: 8px;">
                  <span>Balance Anterior:</span>
                  <span style="font-family: monospace; font-size: 14px;">RD$ ${Number(saleData.previousDebt).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                ` : ''}
                
                <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; color: #b45309; margin-top: 8px;">
                  <span>DEUDA TOTAL:</span>
                  <span>RD$ ${Number(saleData.customerDebt).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                
                ${saleData.pendingInvoicesCount ? `
                <div style="text-align: right; font-size: 11px; color: #b45309; margin-top: 4px; font-style: italic;">
                  (${saleData.pendingInvoicesCount} Facturas Pendientes)
                </div>
                ` : ''}
              </div>
              <div style="background-color: #fffaf0; border: 1px solid #fdd6b2; color: #c05621; padding: 8px; font-size: 11px; border-radius: 4px; margin-top: 12px; line-height: 1.3;">
                Nota: El "Total Facturado" corresponde solo a esta factura. "Deuda Total" incluye su balance pendiente acumulado.
              </div>
              ` : ''}
            </div>

            <p class="message" style="text-align: center; font-size: 14px; font-style: italic;">
              Hemos adjuntado su factura oficial en formato PDF para su registro y comodidad.
            </p>
          </div>
          
          <div class="divider"></div>
          
          <div class="footer">
            <p class="footer-text">
              ${companyInfo.address ? `${companyInfo.address}<br>` : ''}
              ${companyInfo.phone ? `Tel: ${companyInfo.phone}` : ''}
            </p>
            <p style="margin-top: 20px;">
              Este es un correo automático generado por nuestro sistema de facturación electrónica.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailOptions: any = {
      from: `${companyInfo.name} <onboarding@resend.dev>`,
      to: [email],
      subject: `Su Factura de ${companyInfo.name} (${saleData.invoiceNumber})`,
      html: invoiceHTML,
      reply_to: companyInfo.email || 'noreply@resend.dev',
      headers: {
        'X-Entity-Ref-ID': saleData.invoiceNumber,
      }
    };

    if (attachments.length > 0) {
      emailOptions.attachments = attachments;
    }

    const emailResponse = await resend.emails.send(emailOptions);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending invoice email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
