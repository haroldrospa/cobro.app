
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { Resend } from "npm:resend@2.0.0"

const resend = new Resend(Deno.env.get("RESEND_API_KEY"))

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

interface NotificationRequest {
  adminEmail: string;
  storeName: string;
  storeCode: string;
  planName: string;
  amount: number;
  userName: string;
  proofUrl: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body: NotificationRequest = await req.json()
    const { storeName, storeCode, planName, amount, userName, proofUrl } = body
    const adminEmail = body.adminEmail || "haroldrospa@gmail.com"

    console.log(`Sending payment notification for store ${storeName} (${storeCode}) to admin: ${adminEmail}`)

    const adminHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e1e8f0; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; color: white; }
          .content { padding: 40px; color: #334155; line-height: 1.6; }
          .badge { display: inline-block; padding: 6px 12px; border-radius: 9999px; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: 800; color: #1e293b; margin: 0 0 10px 0; }
          .subtitle { font-size: 14px; color: #64748b; margin-bottom: 30px; }
          .data-box { background: #f8fafc; border-radius: 12px; padding: 25px; border: 1px solid #f1f5f9; margin-bottom: 30px; }
          .data-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
          .data-row:last-child { border-bottom: none; }
          .label { font-size: 13px; color: #94a3b8; font-weight: 500; }
          .value { font-size: 14px; color: #1e293b; font-weight: 700; }
          .amount-box { text-align: center; padding: 20px; background: #ecfdf5; border-radius: 10px; border: 1px solid #d1fae5; margin-top: 10px; }
          .amount-label { font-size: 12px; color: #065f46; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
          .amount-value { font-size: 28px; font-weight: 900; color: #059669; }
          .footer { padding: 30px; text-align: center; background: #f8fafc; border-top: 1px solid #f1f5f9; }
          .button { display: inline-block; padding: 14px 28px; background: #2563eb; color: white !important; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2); transition: all 0.2s; }
          .footer-text { font-size: 12px; color: #94a3b8; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
             <h1 style="margin:0; font-size: 24px;">Cobro App</h1>
          </div>
          <div class="content">
            <div class="badge">Pago Pendiente de Verificación</div>
            <h2 class="title">¡Nueva renovación recibida!</h2>
            <p class="subtitle">Una tienda ha reportado un pago que requiere tu validación inmediata en el panel administrativo.</p>
            
            <div class="data-box">
              <div class="data-row">
                <span class="label">Tienda</span>
                <span class="value">${storeName}</span>
              </div>
              <div class="data-row">
                <span class="label">Código de Tienda</span>
                <span class="value" style="color: #2563eb; font-family: monospace;">${storeCode}</span>
              </div>
              <div class="data-row">
                <span class="label">Plan Selecciónado</span>
                <span class="value">${planName}</span>
              </div>
              <div class="data-row">
                <span class="label">Usuario</span>
                <span class="value">${userName}</span>
              </div>
              
              <div class="amount-box">
                <div class="amount-label">Monto Reportado</div>
                <div class="amount-value">RD$ ${amount.toLocaleString()}</div>
              </div>
            </div>
          </div>
          <div class="footer">
            <p style="font-size: 14px; color: #64748b; margin-bottom: 20px;">Accede al panel de SuperAdmin para procesar este pago.</p>
            <a href="https://cobroapp.com/admin/super-panel" class="button">Gestionar en el Panel</a>
            <p class="footer-text">Este es un mensaje automático del sistema Cobro App.</p>
          </div>
        </div>
      </body>
      </html>
    `

    // ENVIAR AL ADMIN
    const emailToAdmin = await resend.emails.send({
      from: "Cobro App <no-reply@cobroapp.app>",
      to: [adminEmail],
      subject: `🚨 VERIFICAR PAGO: La tienda ${storeName} realizó su renovación`,
      html: adminHtml,
    })

    return new Response(JSON.stringify({ success: true, emailId: emailToAdmin.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (error: any) {
    console.error("Error in send-subscription-notification:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
})
