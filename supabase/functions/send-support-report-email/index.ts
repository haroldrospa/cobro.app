import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { Resend } from "npm:resend@2.0.0"

const resend = new Resend(Deno.env.get("RESEND_API_KEY"))

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

interface SupportReportRequest {
  action?: 'new_report' | 'report_response';
  reportId: string;
  storeName?: string;
  userName?: string;
  contactEmail: string;
  contactPhone?: string;
  reportType?: string;
  reportTypeLabel?: string;
  title: string;
  message?: string;
  adminResponse?: string;
  status?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body: SupportReportRequest = await req.json()
    const {
      action = 'new_report',
      reportId,
      storeName = 'Cobro App Negocio',
      userName = 'Cliente',
      contactEmail,
      contactPhone = 'No especificado',
      reportTypeLabel = 'Consulta de Soporte',
      title,
      message = '',
      adminResponse = '',
      status = 'pending'
    } = body

    if (!reportId || !title) {
      return new Response(JSON.stringify({ error: "reportId and title are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const ticketCode = `TICK-${reportId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
    const adminEmail = "haroldrospa@gmail.com"
    const appUrl = "https://cobroapp.app"
    const logoUrl = "https://cobroapp.app/cobro-logo.png"
    const waLink = `https://wa.me/18099175744?text=Hola%20Harold,%20estoy%20dando%20seguimiento%20al%20ticket%20${ticketCode}`

    console.log(`[send-support-report-email] Action: ${action}, Ticket: ${ticketCode}, Contact: ${contactEmail}`)

    // =========================================================================
    // ACCIÓN 1: NUEVO REPORTE GENERADO POR EL CLIENTE
    // =========================================================================
    if (action === 'new_report') {
      // 1. Correo de confirmación para el CLIENTE
      if (contactEmail && contactEmail.includes('@')) {
        const clientHtml = `
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reporte Recibido - ${ticketCode}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
              table { border-collapse: separate; }
              a { text-decoration: none; }
            </style>
          </head>
          <body style="background-color: #f8fafc; margin: 0; padding: 24px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
              <tr>
                <td align="center" style="padding: 10px 0 30px 0;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
                    <!-- Barra superior esmeralda -->
                    <tr>
                      <td style="background-color: #10b981; height: 5px; line-height: 5px; font-size: 1px;">&nbsp;</td>
                    </tr>
                    
                    <!-- Header -->
                    <tr>
                      <td align="center" style="background-color: #ffffff; padding: 32px 24px 20px 24px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                        <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto 14px auto;">
                          <tr>
                            <td style="vertical-align: middle;">
                              <img src="${logoUrl}" alt="Cobro App Logo" width="44" height="44" style="display: block; width: 44px; height: 44px; border: 0; border-radius: 10px;" />
                            </td>
                            <td style="vertical-align: middle; padding-left: 12px; text-align: left;">
                              <span style="font-size: 24px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">Cobro<span style="color: #10b981;">app</span></span>
                            </td>
                          </tr>
                        </table>
                        
                        <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px;">
                          Ticket Registrado
                        </div>
                        <h1 style="color: #0f172a; margin: 0 0 6px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                          ¡Hemos recibido tu solicitud!
                        </h1>
                        <p style="color: #64748b; font-size: 13px; margin: 0; line-height: 1.4;">
                          Tu caso ha sido asignado al equipo de soporte de Cobro App.
                        </p>
                      </td>
                    </tr>

                    <!-- Contenido principal -->
                    <tr>
                      <td style="padding: 28px 26px; background-color: #ffffff;">
                        <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">
                          Hola, ${userName} 👋
                        </div>
                        <div style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 22px;">
                          Te confirmamos que recibimos tu reporte para el negocio <strong style="color: #059669;">${storeName}</strong>. A continuación tienes los detalles y tu número de ticket para darle seguimiento por correo:
                        </div>

                        <!-- Tarjeta con resumen del Ticket -->
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
                          <table width="100%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="padding-bottom: 10px; font-size: 12px; color: #64748b; font-weight: 600;">Número de Ticket / Caso:</td>
                              <td align="right" style="padding-bottom: 10px; font-size: 13px; font-weight: 800; color: #10b981; font-family: monospace;">${ticketCode}</td>
                            </tr>
                            <tr>
                              <td style="padding-bottom: 10px; font-size: 12px; color: #64748b; font-weight: 600;">Tipo de Solicitud:</td>
                              <td align="right" style="padding-bottom: 10px; font-size: 13px; font-weight: 700; color: #1e293b;">${reportTypeLabel}</td>
                            </tr>
                            <tr>
                              <td style="padding-bottom: 10px; font-size: 12px; color: #64748b; font-weight: 600;">Estado Actual:</td>
                              <td align="right" style="padding-bottom: 10px;">
                                <span style="background-color: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px;">Pendiente de Contacto</span>
                              </td>
                            </tr>
                            <tr>
                              <td colspan="2" style="padding-top: 10px; border-top: 1px solid #e2e8f0;">
                                <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">Asunto:</div>
                                <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 10px;">${title}</div>
                                <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">Tu Mensaje:</div>
                                <div style="font-size: 13px; line-height: 1.5; color: #475569; background-color: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap;">${message}</div>
                              </td>
                            </tr>
                          </table>
                        </div>

                        <!-- Sección de Seguimiento por Correo -->
                        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px 18px; margin-bottom: 22px;">
                          <div style="font-size: 13px; font-weight: 700; color: #166534; margin-bottom: 4px;">
                            ✉️ ¿Cómo darle seguimiento a este caso?
                          </div>
                          <div style="font-size: 12px; color: #15803d; line-height: 1.55;">
                            Puedes <strong>responder directamente a este correo</strong> en cualquier momento para agregar capturas de pantalla, información adicional o consultar el avance. Harold y el equipo te responderán directamente a tu bandeja.
                          </div>
                        </div>

                        <!-- Botón WhatsApp para seguimiento rápido -->
                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0 10px 0;">
                          <tr>
                            <td align="center">
                              <a href="${waLink}" target="_blank" style="background-color: #25D366; color: #ffffff !important; display: inline-block; font-size: 14px; font-weight: 700; text-align: center; padding: 12px 28px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);">
                                📱 Dar seguimiento por WhatsApp (${ticketCode}) &rarr;
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td align="center" style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 20px; text-align: center;">
                        <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; font-weight: 600;">
                          Cobro App &mdash; Soporte y Acompañamiento
                        </p>
                        <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                          Negocio: ${storeName} &bull; Si no reconoces este reporte, puedes ignorar este correo.
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

        await resend.emails.send({
          from: "Cobro App Soporte <no-reply@cobroapp.app>",
          to: [contactEmail],
          reply_to: adminEmail,
          subject: `🎟️ [${ticketCode}] Recibimos tu reporte: ${title}`,
          html: clientHtml,
        })
      }

      // 2. Correo de alerta para el ADMIN (Harold)
      const adminHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #f8fafc; }
            .card { max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 30px; }
            .badge { display: inline-block; padding: 4px 10px; background-color: #f59e0b; color: #000; font-weight: 800; font-size: 11px; border-radius: 20px; text-transform: uppercase; margin-bottom: 12px; }
            .title { font-size: 20px; font-weight: 800; margin: 0 0 8px 0; color: #ffffff; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #334155; font-size: 13px; }
            .label { color: #94a3b8; font-weight: 600; }
            .val { color: #f1f5f9; font-weight: 700; }
            .msg { background-color: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 15px; margin: 15px 0; font-size: 13px; line-height: 1.5; color: #e2e8f0; white-space: pre-wrap; }
            .btn { display: inline-block; background-color: #10b981; color: #ffffff !important; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">Nuevo Reporte de Cliente</div>
            <h2 class="title">🚨 ${title}</h2>
            <p style="color: #94a3b8; font-size: 13px; margin-top: 0;">Un cliente necesita soporte o seguimiento en Cobro App.</p>

            <div style="background-color: #0f172a; border-radius: 12px; padding: 16px; border: 1px solid #334155; margin: 16px 0;">
              <table width="100%" style="border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8;">Ticket:</td>
                  <td align="right" style="color: #10b981; font-weight: 800; font-family: monospace;">${ticketCode}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8;">Tienda / Negocio:</td>
                  <td align="right" style="color: #ffffff; font-weight: 700;">${storeName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8;">Usuario:</td>
                  <td align="right" style="color: #ffffff; font-weight: 700;">${userName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8;">Teléfono / WhatsApp:</td>
                  <td align="right" style="color: #38bdf8; font-weight: 700;">${contactPhone}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8;">Correo de Contacto:</td>
                  <td align="right" style="color: #38bdf8; font-weight: 700;">${contactEmail || 'No provisto'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8;">Tipo:</td>
                  <td align="right" style="color: #cbd5e1; font-weight: 600;">${reportTypeLabel}</td>
                </tr>
              </table>
            </div>

            <div style="font-size: 12px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Mensaje del Cliente:</div>
            <div class="msg">${message}</div>

            <p style="font-size: 12px; color: #94a3b8;">
              💡 <em>Puedes responder directamente a este correo para escribirle al cliente (${contactEmail}), o acceder al SuperAdmin.</em>
            </p>

            <center>
              <a href="https://cobroapp.app/admin/super-panel" class="btn">Abrir en Panel SuperAdmin &rarr;</a>
            </center>
          </div>
        </body>
        </html>
      `

      await resend.emails.send({
        from: "Cobro App Alertas <no-reply@cobroapp.app>",
        to: [adminEmail],
        reply_to: contactEmail || adminEmail,
        subject: `🚨 [${ticketCode}] ${storeName}: ${title}`,
        html: adminHtml,
      })

      return new Response(JSON.stringify({ success: true, ticketCode }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    // =========================================================================
    // ACCIÓN 2: ACTUALIZACIÓN / RESPUESTA DEL ADMIN AL REPORTE
    // =========================================================================
    if (action === 'report_response') {
      if (!contactEmail || !contactEmail.includes('@')) {
        return new Response(JSON.stringify({ error: "contactEmail is required for response" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        })
      }

      const isResolved = status === 'resolved'
      const statusLabel = isResolved ? 'Resuelto' : 'En Proceso / Actualizado'
      const statusBadgeBg = isResolved ? '#ecfdf5' : '#eff6ff'
      const statusBadgeColor = isResolved ? '#065f46' : '#1e40af'

      const updateHtml = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Actualización de tu Reporte - ${ticketCode}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
            table { border-collapse: separate; }
            a { text-decoration: none; }
          </style>
        </head>
        <body style="background-color: #f8fafc; margin: 0; padding: 24px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
            <tr>
              <td align="center" style="padding: 10px 0 30px 0;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
                  <!-- Barra superior -->
                  <tr>
                    <td style="background-color: ${isResolved ? '#10b981' : '#3b82f6'}; height: 5px; line-height: 5px; font-size: 1px;">&nbsp;</td>
                  </tr>
                  
                  <!-- Header -->
                  <tr>
                    <td align="center" style="background-color: #ffffff; padding: 32px 24px 20px 24px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                      <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto 14px auto;">
                        <tr>
                          <td style="vertical-align: middle;">
                            <img src="${logoUrl}" alt="Cobro App Logo" width="44" height="44" style="display: block; width: 44px; height: 44px; border: 0; border-radius: 10px;" />
                          </td>
                          <td style="vertical-align: middle; padding-left: 12px; text-align: left;">
                            <span style="font-size: 24px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">Cobro<span style="color: #10b981;">app</span></span>
                          </td>
                        </tr>
                      </table>
                      
                      <div style="display: inline-block; background-color: ${statusBadgeBg}; color: ${statusBadgeColor}; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px;">
                        ${statusLabel}
                      </div>
                      <h1 style="color: #0f172a; margin: 0 0 6px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                        Actualización sobre tu caso
                      </h1>
                      <p style="color: #64748b; font-size: 13px; margin: 0; line-height: 1.4;">
                        Ticket: <strong style="color: #10b981; font-family: monospace;">${ticketCode}</strong> &bull; ${title}
                      </p>
                    </td>
                  </tr>

                  <!-- Contenido principal -->
                  <tr>
                    <td style="padding: 28px 26px; background-color: #ffffff;">
                      <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">
                        Hola, ${userName} 👋
                      </div>
                      <div style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
                        Harold y el equipo de Cobro App han respondido a tu reporte de soporte para <strong style="color: #059669;">${storeName}</strong>:
                      </div>

                      <!-- Caja destacada con la respuesta de Harold -->
                      <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
                        <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #166534; letter-spacing: 0.5px; margin-bottom: 8px;">
                          💬 Respuesta del equipo de Cobro App:
                        </div>
                        <div style="font-size: 14px; line-height: 1.65; color: #14532d; font-weight: 600; white-space: pre-wrap;">
                          ${adminResponse || 'Tu reporte ha sido atendido y marcado como resuelto. Si requieres más asistencia no dudes en respondernos.'}
                        </div>
                      </div>

                      <!-- Detalle del ticket original -->
                      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 22px;">
                        <div style="font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 4px;">Detalle de tu consulta original:</div>
                        <div style="font-size: 13px; color: #475569; font-style: italic; line-height: 1.5;">"${message || title}"</div>
                      </div>

                      <!-- Opciones de seguimiento -->
                      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px 18px; margin-bottom: 22px;">
                        <div style="font-size: 13px; font-weight: 700; color: #1e40af; margin-bottom: 4px;">
                          ✉️ ¿Necesitas algo más o quieres continuar la conversación?
                        </div>
                        <div style="font-size: 12px; color: #1d4ed8; line-height: 1.55;">
                          Solo debes <strong>responder a este correo electrónico</strong> y tu mensaje llegará de inmediato a Harold para darte seguimiento continuo.
                        </div>
                      </div>

                      <!-- CTA WhatsApp y Aplicación -->
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 15px 0 10px 0;">
                        <tr>
                          <td align="center">
                            <a href="${waLink}" target="_blank" style="background-color: #25D366; color: #ffffff !important; display: inline-block; font-size: 13px; font-weight: 700; text-align: center; padding: 11px 22px; border-radius: 10px; text-decoration: none; margin-right: 8px; box-shadow: 0 4px 10px rgba(37, 211, 102, 0.25);">
                              📱 Contactar por WhatsApp
                            </a>
                            <a href="${appUrl}" target="_blank" style="background-color: #10b981; color: #ffffff !important; display: inline-block; font-size: 13px; font-weight: 700; text-align: center; padding: 11px 22px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25);">
                              Ir a Cobro App &rarr;
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td align="center" style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 20px; text-align: center;">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; font-weight: 600;">
                        Cobro App &mdash; Soporte y Acompañamiento
                      </p>
                      <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                        Negocio: ${storeName} &bull; Ticket: ${ticketCode}
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

      await resend.emails.send({
        from: "Cobro App Soporte <no-reply@cobroapp.app>",
        to: [contactEmail],
        reply_to: adminEmail,
        subject: `💬 [${ticketCode}] Actualización de tu caso: ${title}`,
        html: updateHtml,
      })

      return new Response(JSON.stringify({ success: true, ticketCode }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })

  } catch (error: any) {
    console.error("Error in send-support-report-email:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
})
