import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendWhatsAppRequest {
  phone: string;
  message: string;
  evolutionUrl: string;
  instanceName: string;
  apiKey: string;
  formatOverride?: 'format1' | 'format2' | 'format3';
}

const formatPhoneNumber = (phone: string, formatOverride?: string): string => {
  let cleaned = phone.replace(/\D/g, '');

  if (formatOverride === 'format2') {
    if (cleaned.length === 10) cleaned = `1${cleaned}`;
    return `${cleaned}@s.whatsapp.net`;
  }

  if (formatOverride === 'format3') {
    return phone.replace(/\D/g, '');
  }

  // Default: prepend country code if 10 digits (Dominican Republic)
  if (cleaned.length === 10) cleaned = `1${cleaned}`;
  return cleaned;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth — user must be logged in
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body: SendWhatsAppRequest = await req.json();
    const { phone, message, evolutionUrl, instanceName, apiKey, formatOverride } = body;

    if (!phone || !message || !evolutionUrl || !instanceName || !apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: phone, message, evolutionUrl, instanceName, apiKey" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build the target URL server-side (no CORS restriction here)
    let baseUrl = evolutionUrl.endsWith('/') ? evolutionUrl.slice(0, -1) : evolutionUrl;
    if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `https://${baseUrl}`;

    const endpoint = `${baseUrl}/message/sendText/${instanceName}`;
    const formattedPhone = formatPhoneNumber(phone, formatOverride);

    const payload = {
      number: formattedPhone,
      textMessage: { text: message },
    };

    console.log(`[send-whatsapp] Proxying to ${endpoint}, phone=${formattedPhone}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[send-whatsapp] Evolution API error ${response.status}:`, responseText);
      return new Response(
        JSON.stringify({ error: `Evolution API (${response.status}): ${responseText.slice(0, 200)}` }),
        { status: response.status, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[send-whatsapp] Success:`, responseText);

    return new Response(
      JSON.stringify({ success: true, response: responseText }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[send-whatsapp] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
