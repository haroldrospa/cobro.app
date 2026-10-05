import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { Resend } from "npm:resend@2.0.0"

const resend = new Resend(Deno.env.get("RESEND_API_KEY"))

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

interface WelcomeEmailRequest {
  email: string;
  fullName?: string;
  companyName?: string;
  storeCode?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body: WelcomeEmailRequest = await req.json()
    const { email, fullName, companyName, storeCode } = body

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const clientName = fullName?.trim() || "Emprendedor"
    const businessName = companyName?.trim() || "Tu Negocio"
    const appUrl = "https://cobroapp.com/app"

    console.log(`Sending welcome email to: ${email} (${businessName})`)

    const welcomeHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Bienvenido a Cobro App!</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #059669 0%, #10b981 50%, #047857 100%); padding: 40px 30px; text-align: center; color: white; }
          .logo-badge { display: inline-block; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px); padding: 8px 18px; border-radius: 9999px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px; }
          .header p { margin: 8px 0 0 0; opacity: 0.92; font-size: 15px; font-weight: 400; }
          .content { padding: 36px 30px; }
          .greeting { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 14px; }
          .description { font-size: 15px; line-height: 1.65; color: #475569; margin-bottom: 28px; }
          .card-step { background: #f8fafc; border: 1px solid #edf2f7; border-radius: 14px; padding: 18px; margin-bottom: 14px; display: flex; align-items: flex-start; }
          .step-icon { width: 36px; height: 36px; border-radius: 10px; background: #d1fae5; color: #059669; font-size: 18px; display: flex; align-items: center; justify-content: center; margin-right: 14px; flex-shrink: 0; }
          .step-title { font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 4px; }
          .step-text { font-size: 13px; color: #64748b; line-height: 1.45; }
          .cta-box { text-align: center; margin: 34px 0 20px 0; }
          .btn-primary { display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff !important; font-weight: 700; font-size: 16px; padding: 16px 36px; border-radius: 14px; text-decoration: none; box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3); transition: all 0.2s ease; }
          .support-box { background: #eff6ff; border-radius: 14px; padding: 18px; border: 1px solid #dbeafe; margin-top: 26px; }
          .support-title { font-size: 13px; font-weight: 700; color: #1e40af; margin-bottom: 4px; }
          .support-text { font-size: 12px; color: #3b82f6; line-height: 1.5; }
          .footer { background: #f8fafc; border-top: 1px solid #f1f5f9; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-badge">Cobro App</div>
            <h1>¡Te damos la bienvenida!</h1>
            <p>La plataforma moderna para gestionar las ventas y facturación de tu negocio</p>
          </div>
          
          <div class="content">
            <div class="greeting">¡Hola, ${clientName}! 👋</div>
            <div class="description">
              Nos emociona tener a <strong>${businessName}</strong> a bordo. Tu cuenta ha sido creada exitosamente y ya tienes todo listo para empezar a registrar ventas, emitir comprobantes fiscales y llevar el control total de tu comercio.
            </div>

            <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.8px; margin-bottom: 14px;">
              Primeros pasos recomendados:
            </div>

            <div class="card-step">
              <div class="step-icon">📦</div>
              <div>
                <div class="step-title">1. Registra tus productos</div>
                <div class="step-text">Organiza tu inventario por categorías, agrega precios y códigos de barra para cobrar en segundos.</div>
              </div>
            </div>

            <div class="card-step">
              <div class="step-icon">⚡</div>
              <div>
                <div class="step-title">2. Realiza tu primera venta en el POS</div>
                <div class="step-text">Prueba nuestro punto de venta táctil, rápido y optimizado para teléfonos, tablets o computadoras.</div>
              </div>
            </div>

            <div class="card-step">
              <div class="step-icon">🖨️</div>
              <div>
                <div class="step-title">3. Conecta tu impresora térmica</div>
                <div class="step-text">Imprime tickets y facturas al instante vía Bluetooth o conexión de red desde cualquier dispositivo.</div>
              </div>
            </div>

            <div class="card-step">
              <div class="step-icon">🤝</div>
              <div>
                <div class="step-title">4. Soporte y Acompañamiento Personalizado</div>
                <div class="step-text">¿Necesitas ayuda configurando tu negocio? Genera un reporte directo en tu panel de Cobro App y nuestro equipo se comunicará contigo de inmediato.</div>
              </div>
            </div>

            <div class="cta-box">
              <a href="${appUrl}" class="btn-primary" target="_blank">
                Ingresar a mi Negocio en Cobro App →
              </a>
            </div>

            <div class="support-box">
              <div class="support-title">💬 ¿Tienes dudas o necesitas asistencia?</div>
              <div class="support-text">
                Estamos aquí para ayudarte a crecer. Si necesitas ayuda con la configuración o requieres asesoría, puedes generar un reporte desde el menú superior de tu cuenta o contactar a Harold directamente por WhatsApp o llamada.
              </div>
            </div>
          </div>

          <div class="footer">
            <p style="margin: 0 0 6px 0;">Cobro App — Sistema de Facturación y Gestión de Negocios</p>
            <p style="margin: 0;">Recibiste este correo porque registraste una cuenta en Cobro App.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const emailResponse = await resend.emails.send({
      from: "Cobro App <no-reply@cobroapp.app>",
      to: [email],
      subject: `🎉 ¡Bienvenido a Cobro App, ${clientName}! Tu cuenta para ${businessName} está lista`,
      html: welcomeHtml,
    })

    return new Response(JSON.stringify({ success: true, id: emailResponse.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (error: any) {
    console.error("Error in send-welcome-email:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
})
