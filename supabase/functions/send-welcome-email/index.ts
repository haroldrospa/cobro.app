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
  phone?: string;
  rnc?: string;
  shopType?: string;
  planName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body: WelcomeEmailRequest = await req.json()
    const { email, fullName, companyName, storeCode, phone, rnc, shopType, planName } = body

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const clientName = fullName?.trim() || "Emprendedor"
    const businessName = companyName?.trim() || "Tu Negocio"
    const appUrl = "https://cobroapp.app"
    const logoUrl = "https://cobroapp.app/cobro-logo.png"

    console.log(`Sending welcome email to: ${email} (${businessName})`)

    const welcomeHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Bienvenido a Cobro App!</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; -webkit-font-smoothing: antialiased; }
          table { border-collapse: separate; }
          a { text-decoration: none; }
        </style>
      </head>
      <body style="background-color: #f8fafc; margin: 0; padding: 24px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 10px 0 30px 0;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
                <!-- Header Top Emerald Bar -->
                <tr>
                  <td style="background-color: #10b981; height: 5px; line-height: 5px; font-size: 1px;">&nbsp;</td>
                </tr>
                
                <!-- Header Content with Logo -->
                <tr>
                  <td align="center" style="background-color: #ffffff; padding: 36px 24px 24px 24px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                    <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto 16px auto;">
                      <tr>
                        <td style="vertical-align: middle;">
                          <img src="${logoUrl}" alt="Cobro App Logo" width="46" height="46" style="display: block; width: 46px; height: 46px; border: 0; border-radius: 10px;" />
                        </td>
                        <td style="vertical-align: middle; padding-left: 12px; text-align: left;">
                          <span style="font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">Cobro<span style="color: #10b981;">app</span></span>
                        </td>
                      </tr>
                    </table>
                    
                    <h1 style="color: #0f172a; margin: 0 0 6px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">¡Te damos la bienvenida!</h1>
                    <p style="color: #64748b; font-size: 14px; margin: 0; line-height: 1.4;">Tu negocio en control, en cualquier lugar</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 32px 28px; background-color: #ffffff;">
                    <div style="font-size: 19px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">
                      ¡Hola, ${clientName}! 👋
                    </div>
                    <div style="font-size: 14px; line-height: 1.65; color: #334155; margin-bottom: 26px;">
                      Nos emociona darte la bienvenida junto a <strong style="color: #059669; font-weight: 700;">${businessName}</strong>. Tu cuenta ha sido activada exitosamente y tienes acceso inmediato a todas las herramientas para organizar tu inventario, registrar ventas y emitir facturas en segundos.
                    </div>

                    <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.8px; margin-bottom: 14px;">
                      Primeros pasos recomendados:
                    </div>

                    <!-- Step 1 -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 12px;">
                      <tr>
                        <td style="padding: 16px; width: 42px; vertical-align: top;">
                          <div style="width: 36px; height: 36px; border-radius: 8px; background-color: #ecfdf5; border: 1px solid #a7f3d0; text-align: center; line-height: 36px; font-size: 18px;">
                            📦
                          </div>
                        </td>
                        <td style="padding: 16px 16px 16px 4px; vertical-align: middle;">
                          <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 3px;">1. Registra tus productos</div>
                          <div style="font-size: 13px; color: #64748b; line-height: 1.45;">Organiza tu inventario por categorías, define precios e ingresa códigos de barra para ventas rápidas.</div>
                        </td>
                      </tr>
                    </table>

                    <!-- Step 2 -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 12px;">
                      <tr>
                        <td style="padding: 16px; width: 42px; vertical-align: top;">
                          <div style="width: 36px; height: 36px; border-radius: 8px; background-color: #ecfdf5; border: 1px solid #a7f3d0; text-align: center; line-height: 36px; font-size: 18px;">
                            ⚡
                          </div>
                        </td>
                        <td style="padding: 16px 16px 16px 4px; vertical-align: middle;">
                          <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 3px;">2. Realiza tu primera venta en el POS</div>
                          <div style="font-size: 13px; color: #64748b; line-height: 1.45;">Prueba nuestro punto de venta táctil, diseñado para ser rápido e intuitivo desde teléfono, tablet o PC.</div>
                        </td>
                      </tr>
                    </table>

                    <!-- Step 3 -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 12px;">
                      <tr>
                        <td style="padding: 16px; width: 42px; vertical-align: top;">
                          <div style="width: 36px; height: 36px; border-radius: 8px; background-color: #ecfdf5; border: 1px solid #a7f3d0; text-align: center; line-height: 36px; font-size: 18px;">
                            🖨️
                          </div>
                        </td>
                        <td style="padding: 16px 16px 16px 4px; vertical-align: middle;">
                          <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 3px;">3. Conecta tu impresora térmica</div>
                          <div style="font-size: 13px; color: #64748b; line-height: 1.45;">Imprime tickets y facturas al instante vía Bluetooth, conexión de red o USB desde cualquier equipo.</div>
                        </td>
                      </tr>
                    </table>

                    <!-- Step 4 -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 16px; width: 42px; vertical-align: top;">
                          <div style="width: 36px; height: 36px; border-radius: 8px; background-color: #ecfdf5; border: 1px solid #a7f3d0; text-align: center; line-height: 36px; font-size: 18px;">
                            🤝
                          </div>
                        </td>
                        <td style="padding: 16px 16px 16px 4px; vertical-align: middle;">
                          <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 3px;">4. Soporte y Acompañamiento Personalizado</div>
                          <div style="font-size: 13px; color: #64748b; line-height: 1.45;">¿Necesitas ayuda configurando tu negocio? Genera un reporte directo en tu panel de Cobro App y nuestro equipo se comunicará contigo de inmediato.</div>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA Button -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 24px 0;">
                      <tr>
                        <td align="center">
                          <a href="${appUrl}" target="_blank" style="background-color: #10b981; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff !important; display: inline-block; font-size: 15px; font-weight: 700; text-align: center; padding: 15px 36px; border-radius: 12px; text-decoration: none; box-shadow: 0 8px 20px rgba(16, 185, 129, 0.35);">
                            Ingresar a mi Negocio en Cobro App &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Support Card -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
                      <tr>
                        <td style="padding: 16px 18px;">
                          <div style="font-size: 13px; font-weight: 700; color: #166534; margin-bottom: 4px;">
                            💬 ¿Tienes dudas o necesitas asistencia?
                          </div>
                          <div style="font-size: 12px; color: #15803d; line-height: 1.5;">
                            Estamos aquí para ayudarte a crecer. Si necesitas ayuda con la configuración o requieres asesoría, puedes generar un reporte desde el menú superior de tu cuenta o contactarnos directamente por WhatsApp o llamada.
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td align="center" style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 22px 20px; text-align: center;">
                    <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; font-weight: 600;">
                      Cobro App &mdash; Sistema de Facturación y Gestión de Negocios
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                      Recibiste este correo porque registraste una cuenta en <a href="${appUrl}" target="_blank" style="color: #059669; text-decoration: none; font-weight: 600;">Cobro App</a>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `

    const emailResponse = await resend.emails.send({
      from: "Cobro App <no-reply@cobroapp.app>",
      to: [email],
      reply_to: "romargroup.do@gmail.com",
      subject: `🎉 ¡Bienvenido a Cobro App, ${clientName}! Tu cuenta para ${businessName} está lista`,
      html: welcomeHtml,
    })

    // Alerta al equipo de Romar Group y Harold sobre el nuevo usuario registrado
    try {
      const adminAlertHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #f8fafc; }
            .card { max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 30px; }
            .badge { display: inline-block; padding: 5px 12px; background-color: #10b981; color: #ffffff; font-weight: 800; font-size: 11px; border-radius: 20px; text-transform: uppercase; margin-bottom: 12px; }
            .title { font-size: 22px; font-weight: 800; margin: 0 0 6px 0; color: #ffffff; }
            .btn { display: inline-block; background-color: #10b981; color: #ffffff !important; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; margin-top: 18px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">Nuevo Registro en Cobro App</div>
            <h2 class="title">🎉 ¡${clientName} ha creado una cuenta!</h2>
            <p style="color: #94a3b8; font-size: 13px; margin-top: 0;">Un nuevo negocio se ha registrado exitosamente en la plataforma.</p>

            <div style="background-color: #0f172a; border-radius: 12px; padding: 16px; border: 1px solid #334155; margin: 16px 0;">
              <table width="100%" style="border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8;">Negocio / Empresa:</td>
                  <td align="right" style="color: #10b981; font-weight: 800;">${businessName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8;">Contacto / Titular:</td>
                  <td align="right" style="color: #ffffff; font-weight: 700;">${clientName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8;">Correo Electrónico:</td>
                  <td align="right" style="color: #38bdf8; font-weight: 700;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8;">Teléfono / WhatsApp:</td>
                  <td align="right" style="color: #38bdf8; font-weight: 700;">${phone || 'No especificado'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8;">RNC o Cédula:</td>
                  <td align="right" style="color: #ffffff; font-weight: 700;">${rnc || 'No especificado'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8;">Tipo de Comercio:</td>
                  <td align="right" style="color: #cbd5e1; font-weight: 600;">${shopType || 'Comercio General'}</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 12px; color: #94a3b8;">
              💡 <em>Puedes responder directamente a este correo para comunicarte de inmediato con el cliente (${email}).</em>
            </p>

            <center>
              <a href="https://cobroapp.app/admin/super-panel" class="btn">Ver en Panel SuperAdmin &rarr;</a>
            </center>
          </div>
        </body>
        </html>
      `

      await resend.emails.send({
        from: "Cobro App Alertas <no-reply@cobroapp.app>",
        to: ["romargroup.do@gmail.com", "haroldrospa@gmail.com"],
        reply_to: email,
        subject: `🎉 [NUEVO REGISTRO] ${clientName} - ${businessName}`,
        html: adminAlertHtml,
      })
    } catch (alertErr) {
      console.warn("Error enviando alerta de nuevo registro a administradores:", alertErr)
    }

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
