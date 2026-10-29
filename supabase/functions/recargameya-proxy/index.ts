import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Generador de firma HMAC-SHA256 usando Web Crypto API
async function generateHmacSignature(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface RechargeRequest {
  action: "recharge" | "query_bill" | "pay_bill" | "get_services";
  carrier: string;
  phone?: string;
  target_number?: string;
  target_name?: string;
  amount: number;
  service_type?: "recharge" | "data_package" | "bill_payment" | "prepaid_power" | "remittance";
  client_reference_id?: string;
  package_id?: string;
  commission?: number;
  cost_amount?: number;
  metadata?: Record<string, any>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Validar autenticación del usuario
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "No autorizado. Inicie sesión en CobroApp." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Token de usuario inválido o expirado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obtener store_id del usuario
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.store_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "No se encontró el comercio asociado a este usuario" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const storeId = profile.store_id;

    // 2. Leer payload del request
    const body: RechargeRequest = await req.json();
    const {
      action = "recharge",
      carrier,
      phone,
      target_number,
      target_name = "",
      amount,
      service_type = "recharge",
      client_reference_id,
      package_id
    } = body;

    const destination = phone || target_number;

    if (action === "recharge") {
      if (!carrier || !destination || !amount || amount <= 0) {
        return new Response(
          JSON.stringify({ ok: false, error: "Faltan parámetros requeridos (carrier, destino, monto)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 3. Obtener configuración de servicios y billetera
      const { data: config } = await supabase
        .from("digital_services_config")
        .select("*")
        .limit(1)
        .single();

      const { data: walletData, error: walletError } = await supabase
        .rpc("get_or_create_store_wallet", { p_store_id: storeId });

      if (walletError || !walletData) {
        return new Response(
          JSON.stringify({ ok: false, error: "No se pudo obtener la billetera del comercio" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Calcular o recibir comisión del comercio (50% de la comisión oficial de RecargameYa)
      let commission = body.commission !== undefined ? Number(body.commission) : 0;
      let costAmount = body.cost_amount !== undefined ? Number(body.cost_amount) : amount;
      const customMetadata = body.metadata || {};

      if (!commission) {
        // Fallback: 50% de la comisión por defecto
        const defaultRate = (walletData.custom_commission_rate ?? config?.default_recharge_commission_rate ?? 5.5) / 2;
        if (service_type === "bill_payment") {
          commission = 2.0; // 50% de RD$ 4.00
          costAmount = Math.max(0, amount - commission);
        } else {
          commission = Math.round((amount * (defaultRate / 100)) * 100) / 100;
          costAmount = Math.round((amount - commission) * 100) / 100;
        }
      }

      // Verificar si tiene saldo suficiente en la billetera
      const availableBalance = Number(walletData.balance) + Number(walletData.credit_limit || 0);
      if (availableBalance < costAmount) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Saldo insuficiente en su billetera de recargas. Saldo disponible: RD$ ${walletData.balance.toFixed(2)}, Costo requerido: RD$ ${costAmount.toFixed(2)}. Por favor recargue su balance.`
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const refId = client_reference_id || `REF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // 4. Conexión con RecargameYa API o Modo Sandbox Simulado
      const apiKey = Deno.env.get("RECARGAMEYA_API_KEY");
      const secretKey = Deno.env.get("RECARGAMEYA_SECRET_KEY");
      const envMode = config?.api_environment || "sandbox";
      const baseUrl = config?.api_base_url || "https://recargameya.com/api/v1/public";

      let externalId = `TXN-SANDBOX-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      let apiResponseData: any = null;

      if (apiKey && secretKey && envMode === "production") {
        // En Producción con credenciales reales configuradas
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const requestPayload = JSON.stringify({
          client_reference_id: refId,
          carrier: carrier.toLowerCase(),
          phone: destination.replace(/\D/g, ""),
          amount: amount,
          package_id: package_id || undefined,
        });

        const signature = await generateHmacSignature(secretKey, `${timestamp}${requestPayload}`);

        const response = await fetch(`${baseUrl}/recharge`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
            "X-API-Timestamp": timestamp,
            "X-API-Signature": signature,
          },
          body: requestPayload,
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: result.message || result.error || "Error al procesar la recarga con el proveedor."
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        apiResponseData = result.data;
        externalId = result.data?.id || externalId;
        if (result.data?.amount_charged) costAmount = Number(result.data.amount_charged);
        if (result.data?.commission) commission = Number(result.data.commission);
      } else {
        // Modo Sandbox / Simulación controlada para pruebas y desarrollo
        await new Promise((r) => setTimeout(r, 600)); // Latencia realista
        apiResponseData = {
          id: externalId,
          status: "completado",
          amount_charged: costAmount,
          commission: commission,
          mode: "sandbox",
          carrier: carrier,
          phone: destination,
          timestamp: new Date().toISOString()
        };
      }

      // 5. Registrar atómicamente la venta en la Base de Datos
      const { data: recordResult, error: recordError } = await supabase.rpc(
        "record_digital_service_sale",
        {
          p_store_id: storeId,
          p_service_type: service_type,
          p_carrier: carrier,
          p_target_number: destination,
          p_target_name: target_name || null,
          p_amount: amount,
          p_amount_charged: costAmount,
          p_commission: commission,
          p_client_reference_id: refId,
          p_external_id: externalId,
          p_metadata: {
            ...apiResponseData,
            ...customMetadata,
            processed_at: new Date().toISOString(),
          }
        }
      );

      if (recordError) {
        return new Response(
          JSON.stringify({ ok: false, error: recordError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            id: externalId,
            transaction_id: recordResult.transaction_id,
            client_reference_id: refId,
            carrier: carrier,
            target_number: destination,
            amount: amount,
            amount_charged: costAmount,
            commission: commission,
            new_wallet_balance: recordResult.new_balance,
            status: "completado",
            created_at: new Date().toISOString()
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: `Acción '${action}' no soportada actualmente.` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Error en recargameya-proxy:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message || "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
