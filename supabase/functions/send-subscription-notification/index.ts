
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { Resend } from "npm:resend@2.0.0"

const resend = new Resend(Deno.env.get("RESEND_API_KEY"))

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

interface NotificationRequest {
  adminEmail?: string;
  storeName: string;
  storeCode?: string;
  planName: string;
  amount: number;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  proofUrl?: string;
  bankName?: string;
}

const cleanPhoneForWhatsApp = (phoneStr?: string): string => {
  if (!phoneStr) return "";
  const cleaned = phoneStr.replace(/\D/g, "");
  if (!cleaned) return "";
  // Si es un número dominicano / norteamericano de 10 dígitos (809, 829, 849), agregar prefijo 1
  if (cleaned.length === 10 && (cleaned.startsWith("809") || cleaned.startsWith("829") || cleaned.startsWith("849"))) {
    return `1${cleaned}`;
  }
  return cleaned;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body: NotificationRequest = await req.json()
    const {
      adminEmail,
      storeName,
      storeCode = "N/A",
      planName,
      amount,
      userName,
      userEmail,
      userPhone,
      proofUrl,
      bankName = "Banreservas"
    } = body

    const recipients = Array.from(new Set([
      "romargroup.do@gmail.com",
      "haroldrospa@gmail.com",
      ...(adminEmail ? [adminEmail] : [])
    ])).filter(Boolean)

    const formattedAmount = Number(amount || 0).toLocaleString("es-DO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })

    const whatsAppNumber = cleanPhoneForWhatsApp(userPhone)
    const logoUrl = "https://cobroapp.app/cobro-logo.png"
    const panelUrl = "https://cobroapp.app/admin/super-panel"
    const supportWhatsApp = "18099175744"

    console.log(`[send-subscription-notification] Processing payment for: ${storeName} (${storeCode}), amount: RD$ ${formattedAmount}`)
    console.log(`[send-subscription-notification] Client details: ${userName} | ${userEmail || 'No email'} | ${userPhone || 'No phone'}`)

    // =========================================================================
    // 1. PLANTILLA PARA EL ADMINISTRADOR (Diseño limpio con tablas HTML)
    // =========================================================================
    const adminHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Notificación de Pago - Cobro App</title>
      </head>
      <body style="background-color: #f1f5f9; margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.06);">
                
                <!-- Barra superior de acento -->
                <tr>
                  <td style="background-color: #2563eb; height: 6px; line-height: 6px; font-size: 1px;">&nbsp;</td>
                </tr>

                <!-- Encabezado con Logo y Marca -->
                <tr>
                  <td style="padding: 28px 32px 20px 32px; background-color: #ffffff; text-align: left; border-bottom: 1px solid #f1f5f9;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align: middle;">
                          <table border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="vertical-align: middle;">
                                <img src="${logoUrl}" alt="Cobro App" width="40" height="40" style="display: block; border-radius: 8px;" />
                              </td>
                              <td style="vertical-align: middle; padding-left: 12px;">
                                <span style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Cobro<span style="color: #2563eb;">app</span></span>
                                <span style="display: block; font-size: 11px; color: #64748b; font-weight: 500;">Panel de Administración</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td align="right" style="vertical-align: middle;">
                          <span style="display: inline-block; padding: 6px 12px; background-color: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #fde68a;">
                            ⏳ En Revisión
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Cuerpo Principal -->
                <tr>
                  <td style="padding: 32px 32px 24px 32px;">
                    <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
                      ¡Nueva renovación reportada!
                    </h2>
                    <p style="margin: 0 0 24px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                      La tienda <strong style="color: #0f172a;">${storeName}</strong> ha subido un comprobante de pago por transferencia bancaria que requiere tu verificación.
                    </p>

                    <!-- Caja Destacada de Monto -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px;">
                      <tr>
                        <td style="padding: 20px; text-align: center;">
                          <div style="font-size: 11px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
                            Monto Reportado
                          </div>
                          <div style="font-size: 32px; font-weight: 900; color: #059669; letter-spacing: -1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                            RD$ ${formattedAmount}
                          </div>
                          <div style="font-size: 12px; color: #047857; margin-top: 4px; font-weight: 500;">
                            Plan solicitado: <strong style="color: #065f46;">${planName}</strong>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Tabla de Detalles de la Tienda -->
                    <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 10px;">
                      Detalles de la Suscripción
                    </div>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; border: 1px solid #f1f5f9; border-radius: 10px; overflow: hidden; background-color: #f8fafc;">
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #64748b; width: 40%; font-weight: 500;">
                          Tienda
                        </td>
                        <td align="right" style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #0f172a; font-weight: 700;">
                          ${storeName}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #64748b; font-weight: 500;">
                          Código de Tienda
                        </td>
                        <td align="right" style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #2563eb; font-weight: 700; font-family: monospace;">
                          ${storeCode}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #64748b; font-weight: 500;">
                          Plan Seleccionado
                        </td>
                        <td align="right" style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #0f172a; font-weight: 700;">
                          ${planName}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; font-size: 13px; color: #64748b; font-weight: 500;">
                          Banco Receptor
                        </td>
                        <td align="right" style="padding: 12px 16px; font-size: 14px; color: #0f172a; font-weight: 700;">
                          ${bankName}
                        </td>
                      </tr>
                    </table>

                    <!-- Tarjeta de Contacto Directo con el Cliente -->
                    <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 10px;">
                      Datos de Contacto del Cliente
                    </div>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px; border: 1px solid #dbeafe; border-radius: 12px; overflow: hidden; background-color: #eff6ff;">
                      <tr>
                        <td style="padding: 16px 20px;">
                          <table width="100%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="padding-bottom: 10px; font-size: 13px; color: #1e40af; font-weight: 500; width: 35%;">
                                👤 Nombre / Titular
                              </td>
                              <td align="right" style="padding-bottom: 10px; font-size: 14px; color: #0f172a; font-weight: 700;">
                                ${userName || "No especificado"}
                              </td>
                            </tr>
                            <tr>
                              <td style="padding-bottom: 10px; font-size: 13px; color: #1e40af; font-weight: 500;">
                                ✉️ Correo Electrónico
                              </td>
                              <td align="right" style="padding-bottom: 10px;">
                                ${
                                  userEmail 
                                    ? `<a href="mailto:${userEmail}" style="font-size: 13px; color: #2563eb; font-weight: 700; text-decoration: underline;">${userEmail}</a>`
                                    : `<span style="font-size: 13px; color: #94a3b8; font-style: italic;">No registrado</span>`
                                }
                              </td>
                            </tr>
                            <tr>
                              <td style="font-size: 13px; color: #1e40af; font-weight: 500;">
                                📱 Teléfono / WhatsApp
                              </td>
                              <td align="right">
                                ${
                                  userPhone 
                                    ? `<a href="tel:${userPhone}" style="font-size: 14px; color: #059669; font-weight: 700; text-decoration: none;">${userPhone}</a>`
                                    : `<span style="font-size: 13px; color: #94a3b8; font-style: italic;">No registrado</span>`
                                }
                              </td>
                            </tr>
                          </table>

                          <!-- Botón directo de WhatsApp si tiene teléfono -->
                          ${
                            whatsAppNumber ? `
                              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 14px; padding-top: 14px; border-top: 1px dashed #bfdbfe;">
                                <tr>
                                  <td align="center">
                                    <a href="https://wa.me/${whatsAppNumber}?text=Hola%20${encodeURIComponent(userName)},%20te%20escribimos%20del%20equipo%20de%20Cobro%20App%20sobre%20tu%20reporte%20de%20pago%20para%20${encodeURIComponent(storeName)}." target="_blank" style="display: inline-block; background-color: #25d366; color: #ffffff !important; font-size: 12px; font-weight: 700; padding: 8px 16px; border-radius: 8px; text-decoration: none;">
                                      💬 Escribir al Cliente por WhatsApp
                                    </a>
                                  </td>
                                </tr>
                              </table>
                            ` : ''
                          }
                        </td>
                      </tr>
                    </table>

                    <!-- Botones de Acción para el Administrador -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center">
                          <table border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td align="center" style="border-radius: 10px; background-color: #2563eb;">
                                <a href="${panelUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 10px rgba(37,99,235,0.25);">
                                  Gestionar en el Panel SuperAdmin
                                </a>
                              </td>
                              ${
                                proofUrl ? `
                                  <td style="padding-left: 12px;" align="center">
                                    <a href="${proofUrl}" target="_blank" style="display: inline-block; padding: 13px 20px; font-size: 13px; font-weight: 700; color: #334155; text-decoration: none; border-radius: 10px; border: 1px solid #cbd5e1; background-color: #ffffff;">
                                      📎 Ver Comprobante
                                    </a>
                                  </td>
                                ` : ''
                              }
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- Pie de página -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                      Este es un correo automático enviado por <strong>Cobro App</strong> cuando un usuario sube un comprobante de transferencia.<br>
                      Puedes responder directamente a este correo para escribirle al cliente si registró su email.
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

    // =========================================================================
    // 2. PLANTILLA PARA EL CLIENTE (Confirmación de pago en revisión)
    // =========================================================================
    const clientHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Comprobante de Pago Recibido - Cobro App</title>
      </head>
      <body style="background-color: #f8fafc; margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
                
                <!-- Barra superior esmeralda -->
                <tr>
                  <td style="background-color: #10b981; height: 5px; line-height: 5px; font-size: 1px;">&nbsp;</td>
                </tr>

                <!-- Encabezado con Logo -->
                <tr>
                  <td align="center" style="padding: 32px 24px 20px 24px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                    <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto 12px auto;">
                      <tr>
                        <td style="vertical-align: middle;">
                          <img src="${logoUrl}" alt="Cobro App Logo" width="44" height="44" style="display: block; border-radius: 10px;" />
                        </td>
                        <td style="vertical-align: middle; padding-left: 12px; text-align: left;">
                          <span style="font-size: 24px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">Cobro<span style="color: #10b981;">app</span></span>
                        </td>
                      </tr>
                    </table>
                    <div style="display: inline-block; padding: 5px 14px; background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px;">
                      ⏳ Comprobante en Revisión
                    </div>
                  </td>
                </tr>

                <!-- Contenido Principal -->
                <tr>
                  <td style="padding: 32px 28px;">
                    <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 12px; letter-spacing: -0.5px;">
                      ¡Hemos recibido tu pago, ${userName || "estimado cliente"}! 👋
                    </div>

                    <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 20px 0;">
                      Te confirmamos que recibimos satisfactoriamente el comprobante de tu transferencia para la tienda <strong style="color: #0f172a;">${storeName}</strong> correspondiente al plan <strong style="color: #059669;">${planName}</strong>.
                    </p>

                    <!-- Caja Explicativa de Revisión -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
                      <tr>
                        <td style="padding: 16px 18px;">
                          <div style="font-size: 13px; font-weight: 700; color: #166534; margin-bottom: 4px;">
                            🔍 ¿Qué está pasando ahora?
                          </div>
                          <div style="font-size: 13px; color: #15803d; line-height: 1.55;">
                            Nuestro equipo administrativo está validando la acreditación del pago en nuestra cuenta bancaria. Este proceso usualmente toma tan solo unos minutos en horario laborable.
                          </div>
                          <div style="font-size: 13px; color: #15803d; line-height: 1.55; margin-top: 8px;">
                            Tan pronto como sea aprobado, tu suscripción se activará <strong>automáticamente</strong> en la aplicación y tendrás acceso total sin interrupciones.
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Resumen del Pago -->
                    <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 10px;">
                      Resumen del Pago Reportado
                    </div>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px; border: 1px solid #f1f5f9; border-radius: 10px; overflow: hidden; background-color: #f8fafc;">
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #64748b; width: 42%; font-weight: 500;">
                          Negocio / Tienda
                        </td>
                        <td align="right" style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #0f172a; font-weight: 700;">
                          ${storeName}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #64748b; font-weight: 500;">
                          Plan Seleccionado
                        </td>
                        <td align="right" style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #0f172a; font-weight: 700;">
                          ${planName}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #64748b; font-weight: 500;">
                          Monto Transferido
                        </td>
                        <td align="right" style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 15px; color: #059669; font-weight: 800;">
                          RD$ ${formattedAmount}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #64748b; font-weight: 500;">
                          Método de Pago
                        </td>
                        <td align="right" style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #0f172a; font-weight: 600;">
                          Transferencia (${bankName})
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; font-size: 13px; color: #64748b; font-weight: 500;">
                          Estado
                        </td>
                        <td align="right" style="padding: 12px 16px; font-size: 13px; color: #d97706; font-weight: 700;">
                          ⏳ En validación bancaria
                        </td>
                      </tr>
                    </table>

                    <!-- Caja de Soporte por WhatsApp -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
                      <tr>
                        <td style="padding: 20px; text-align: center;">
                          <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">
                            ¿Tienes alguna pregunta o necesitas ayuda inmediata?
                          </div>
                          <p style="font-size: 13px; color: #64748b; margin: 0 0 16px 0; line-height: 1.5;">
                            Puedes escribir directamente a nuestro canal de soporte por WhatsApp y te atenderemos enseguida.
                          </p>
                          <a href="https://wa.me/${supportWhatsApp}?text=Hola%20equipo%20de%20Cobro%20App,%20acabo%20de%20subir%20mi%20comprobante%20de%20pago%20para%20la%20tienda%20${encodeURIComponent(storeName)}%20(${encodeURIComponent(storeCode)})." target="_blank" style="display: inline-block; background-color: #25d366; color: #ffffff !important; font-size: 13px; font-weight: 700; padding: 12px 24px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 10px rgba(37,211,102,0.25);">
                            💬 Contactar a Soporte por WhatsApp
                          </a>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- Pie de página -->
                <tr>
                  <td style="padding: 24px 28px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
                    <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #64748b;">
                      Cobro App · Tu negocio en control, en cualquier lugar
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                      Este es un correo informativo generado automáticamente. No es necesario realizar ningún pago adicional.
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

    // =========================================================================
    // 3. ENVÍO DE CORREOS CON RESEND
    // =========================================================================

    // A) Enviar correo al equipo de administración
    console.log(`[send-subscription-notification] Sending admin notification to: ${recipients.join(', ')}`)
    const adminEmailResult = await resend.emails.send({
      from: "Cobro App <no-reply@cobroapp.app>",
      to: recipients,
      reply_to: userEmail || "romargroup.do@gmail.com",
      subject: `🚨 PAGO RECIBIDO (${storeName}): RD$ ${formattedAmount} - En Revisión`,
      html: adminHtml,
    })

    // B) Enviar correo de confirmación al cliente (si tiene un email válido)
    let clientEmailResult = null
    if (userEmail && userEmail.includes("@") && !userEmail.includes("example.com")) {
      try {
        console.log(`[send-subscription-notification] Sending confirmation email to client: ${userEmail}`)
        clientEmailResult = await resend.emails.send({
          from: "Cobro App <no-reply@cobroapp.app>",
          to: [userEmail.trim()],
          reply_to: "romargroup.do@gmail.com",
          subject: `⏳ Recibimos tu comprobante de pago - Cobro App`,
          html: clientHtml,
        })
        console.log(`[send-subscription-notification] Client email sent successfully: ${clientEmailResult?.id}`)
      } catch (clientErr) {
        console.error("[send-subscription-notification] Error sending email to client:", clientErr)
      }
    } else {
      console.log(`[send-subscription-notification] Skipped client email (no valid email provided: "${userEmail}")`)
    }

    return new Response(JSON.stringify({
      success: true,
      adminEmailId: adminEmailResult?.id,
      clientEmailId: clientEmailResult?.id || null
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })

  } catch (error: any) {
    console.error("[send-subscription-notification] Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
})
