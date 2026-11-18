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
    items?: any[];
    subtotal?: number;
    tax?: number;
    tax_total?: number;
    paymentMethod?: string;
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
      email?: string;
      logoSize?: number;
    };
  };
  barcodeDataUrl?: string;
  pdfBase64?: string;
  invoiceHtml?: string;
  emailGreeting?: string;
  emailMessage?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, saleData, pdfBase64, invoiceHtml, emailGreeting, emailMessage }: EmailRequest = await req.json();

    const invNum = saleData?.invoiceNumber || 'Factura';
    console.log(`Sending professional invoice ${invNum} to: ${email}`);

    const companyInfo: any = saleData?.companyInfo || {
      name: 'Mi Empresa'
    };

    const attachments: any[] = [];

    if (pdfBase64) {
      attachments.push({
        filename: `${invNum}.pdf`,
        content: pdfBase64,
      });
    }

    // Si se envía el HTML idéntico generado por la aplicación (invoiceHtml), se usa directamente
    // asegurando que el cliente y el usuario vean exactamente la misma factura que se imprime o descarga en PDF.
    let finalHtml = invoiceHtml;

    if (!finalHtml) {
      const items = Array.isArray(saleData?.items) ? saleData.items : [];
      const itemsRows = items.map((it: any) => {
        const desc = it.name || it.product_name || it.description || 'Producto/Servicio';
        const qty = Number(it.quantity || 1);
        const price = Number(it.price ?? it.unit_price ?? 0);
        const total = Number(it.total ?? (qty * price));
        return `
          <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #2d3748;">
              ${desc}
              ${it.comment ? `<div style="font-size: 11px; color: #718096; font-style: italic;">Nota: ${it.comment}</div>` : ''}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #2d3748; text-align: center;">${qty}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #2d3748; text-align: right;">RD$ ${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #1a202c; font-weight: 700; text-align: right;">RD$ ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          </tr>
        `;
      }).join('');

      finalHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.4; color: #333; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; background-color: #f7fafc; }
          .container { max-width: 640px; margin: 20px auto; padding: 0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; background: #ffffff; }
          .header { background: #ffffff; padding: 24px 30px 15px; border-bottom: 1px solid #edf2f7; }
          .logo-text { font-size: 20px; font-weight: 800; color: #1a1a1a; margin: 0; letter-spacing: -0.3px; text-transform: uppercase; }
          .content { background: #ffffff; padding: 24px 30px; }
          .greeting { font-size: 17px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px; }
          .message { font-size: 13px; color: #4a5568; margin-bottom: 20px; line-height: 1.5; }
          .customer-box { background: #f8fafc; border-radius: 8px; padding: 14px 18px; margin-bottom: 18px; border: 1px solid #edf2f7; font-size: 12px; line-height: 1.5; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .items-table th { background: #1a202c; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 9px 12px; text-align: left; }
          .totals-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
          .totals-table td { padding: 5px 0; font-size: 13px; color: #4a5568; }
          .footer { background: #f8fafc; padding: 20px 30px; text-align: center; font-size: 11px; color: #a0aec0; border-top: 1px solid #edf2f7; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              ${companyInfo.logo ? `<img src="${companyInfo.logo}" alt="${companyInfo.name}" style="max-height: 60px; max-width: 180px; margin-bottom: 6px; display: block;" />` : ''}
              <h1 class="logo-text">${companyInfo.name}</h1>
              ${companyInfo.rnc ? `<div style="font-size: 11px; color: #718096;">RNC: ${companyInfo.rnc}</div>` : ''}
            </div>
            <div style="text-align: right;">
              <div style="font-size: 10px; font-weight: 700; color: #718096; text-transform: uppercase;">Factura / Comprobante</div>
              <div style="font-size: 16px; font-weight: 800; color: #2d3748;">${invNum}</div>
            </div>
          </div>
          
          <div class="content">
            <p class="greeting">${emailGreeting || '¡Hola!'}</p>
            <p class="message">
              ${emailMessage || `Le agradecemos sinceramente por elegirnos y por la confianza depositada en <strong>${companyInfo.name}</strong>.`}
            </p>

            ${saleData?.customer ? `
            <div class="customer-box">
              <strong style="color: #2d3748; font-size: 13px;">Cliente: ${saleData.customer.name || 'Consumidor Final'}</strong>
              ${saleData.customer.rnc ? `<div>RNC / Cédula: ${saleData.customer.rnc}</div>` : ''}
              ${saleData.customer.phone ? `<div>Tel: ${saleData.customer.phone}</div>` : ''}
              ${saleData.customer.address ? `<div>Dirección: ${saleData.customer.address}</div>` : ''}
            </div>
            ` : ''}

            ${items.length > 0 ? `
            <table class="items-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th style="text-align: center;">Cant.</th>
                  <th style="text-align: right;">Precio</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>
            ` : ''}

            <table class="totals-table">
              ${saleData?.subtotal !== undefined ? `
              <tr>
                <td>Subtotal:</td>
                <td style="text-align: right; font-weight: 600;">RD$ ${Number(saleData.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              ` : ''}
              ${(saleData?.tax !== undefined || saleData?.tax_total !== undefined) ? `
              <tr>
                <td>ITBIS:</td>
                <td style="text-align: right; font-weight: 600;">RD$ ${Number(saleData.tax ?? saleData.tax_total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              ` : ''}
              <tr style="font-size: 17px; font-weight: 800; color: #1a202c; border-top: 1px solid #e2e8f0;">
                <td style="padding-top: 8px;">TOTAL FACTURADO:</td>
                <td style="text-align: right; padding-top: 8px; color: #15803d;">RD$ ${Number(saleData?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            </table>

            ${saleData?.customerDebt ? `
            <div style="background-color: #fffaf0; border: 1px solid #fdd6b2; border-radius: 8px; padding: 14px; margin-top: 15px;">
              <div style="font-size: 11px; font-weight: 700; color: #c05621; text-transform: uppercase;">Estado de Cuenta</div>
              ${saleData.previousDebt && saleData.previousDebt > 0 ? `
              <div style="display: flex; justify-content: space-between; font-size: 13px; color: #92400e; margin-top: 4px;">
                <span>Balance Anterior:</span>
                <span>RD$ ${Number(saleData.previousDebt).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #b45309; margin-top: 6px;">
                <span>DEUDA TOTAL:</span>
                <span>RD$ ${Number(saleData.customerDebt).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            ` : ''}

            <p style="text-align: center; font-size: 12px; color: #718096; margin-top: 25px; font-style: italic;">
              Hemos adjuntado su factura oficial en formato PDF idéntica a su comprobante impreso.
            </p>
          </div>
          
          <div class="footer">
            ${companyInfo.address ? `<div>${companyInfo.address}</div>` : ''}
            ${companyInfo.phone ? `<div>Tel: ${companyInfo.phone}</div>` : ''}
            <div style="margin-top: 8px; font-size: 10px;">Este es un correo automático generado por nuestro sistema de facturación.</div>
          </div>
        </div>
      </body>
      </html>
      `;
    }

    const emailOptions: any = {
      from: `${companyInfo.name} <facturas@cobroapp.app>`,
      to: [email],
      subject: `Su Factura de ${companyInfo.name} (${invNum})`,
      html: finalHtml,
      reply_to: companyInfo.email || 'no-reply@cobroapp.app',
      headers: {
        'X-Entity-Ref-ID': invNum,
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
