import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OtpRequest {
  email: string;
  code: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const headers = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("RESEND_API_KEY is not set");
      return new Response(JSON.stringify({ error: "Servidor de correos no configurado (Falta API Key de Resend)" }), { status: 500, headers });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase env vars are missing");
      return new Response(JSON.stringify({ error: "Error interno del servidor (Variables de entorno faltantes)" }), { status: 500, headers });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendKey);

    const body: OtpRequest = await req.json();
    const { email, code } = body;

    if (!email || !code) {
      return new Response(JSON.stringify({ error: "El email y el código son requeridos." }), { status: 400, headers });
    }

    // Get company info for a nicer email
    let companyName = 'Cobro App';
    try {
      const { data: companySettings } = await supabase.from('company_settings').select('name').single();
      if (companySettings?.name) companyName = companySettings.name;
    } catch (e) {
      console.error("Error fetching company info:", e);
    }

    const emailHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #333; text-align: center; margin-bottom: 24px;">Código de Verificación</h2>
        <p style="color: #555; font-size: 16px;">Se ha solicitado eliminar una factura en <strong>${companyName}</strong>.</p>
        <p style="color: #555; font-size: 16px;">Para confirmar esta acción, ingresa el siguiente código de seguridad en la aplicación:</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; margin: 25px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #10b981;">${code}</span>
        </div>
        
        <p style="color: #dc2626; font-size: 14px; font-weight: bold; text-align: center;">Este código expirará en 1 minuto.</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;" />
        <p style="color: #888; font-size: 12px; text-align: center;">Si no has solicitado esta acción, puedes ignorar este correo de forma segura.</p>
      </div>
    `;

    const toEmails = email.split(',').map(e => e.trim()).filter(Boolean);
    if (toEmails.length === 0) {
      return new Response(JSON.stringify({ error: "El email provisto es inválido." }), { status: 400, headers });
    }

    const { data: resData, error: resError } = await resend.emails.send({
      from: 'Cobro App <alertas@cobroapp.app>',
      to: toEmails,
      subject: `Código de Eliminación - ${companyName}`,
      html: emailHTML,
    });

    if (resError) {
      console.error("Resend error:", resError);
      return new Response(JSON.stringify({ error: resError.message || "Error enviando correo" }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ success: true, emailId: resData?.id }), { status: 200, headers });
    
  } catch (error: any) {
    console.error("Internal error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), { status: 500, headers });
  }
});
