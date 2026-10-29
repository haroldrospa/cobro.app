import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Generador de SHA-256 en hexadecimal (minúsculas)
async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Generador de firma HMAC-SHA256 (minúsculas)
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
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

// Cliente autenticado con la API oficial de RecargameYa según especificación (PDF v1)
async function callRecargameYaApi(params: {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  endpoint: string; // e.g. "/recharge" o "/invoice/query"
  method: "GET" | "POST";
  queryParams?: Record<string, string>;
  body?: any;
}) {
  const { apiKey, secretKey, baseUrl, endpoint, method, queryParams, body } = params;

  // 1. URL limpia y request path canónico
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  let url = `${cleanBase}${normalizedEndpoint}`;

  if (queryParams && Object.keys(queryParams).length > 0) {
    const searchParams = new URLSearchParams(queryParams);
    url += `?${searchParams.toString()}`;
  }

  // El request_path canónico no incluye query parameters ni host
  const parsedUrl = new URL(url);
  const requestPath = parsedUrl.pathname;

  // 2. Timestamp actual en segundos (Unix time)
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // 3. Hash del cuerpo (para GET o vacío es el hash SHA-256 de "")
  let bodyBytesStr = "";
  if (method === "POST" && body !== undefined && body !== null) {
    bodyBytesStr = typeof body === "string" ? body : JSON.stringify(body);
  }

  const sha256Body = bodyBytesStr
    ? await sha256Hex(bodyBytesStr)
    : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  // 4. Cadena canónica según especificación oficial RecargameYa (separada estrictamente por \n LF)
  const canonicalString = `${timestamp}\n${method}\n${requestPath}\n${sha256Body}`;
  const signature = await hmacSha256Hex(secretKey, canonicalString);

  // 5. Ejecutar petición HTTP
  const headers: Record<string, string> = {
    "X-API-Key": apiKey,
    "X-API-Timestamp": timestamp,
    "X-API-Signature": signature,
  };

  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: method === "POST" && bodyBytesStr ? bodyBytesStr : undefined,
  });

  const responseText = await response.text();
  let responseJson: any = null;
  try {
    responseJson = JSON.parse(responseText);
  } catch (_e) {
    responseJson = { raw: responseText };
  }

  return {
    status: response.status,
    ok: response.ok,
    data: responseJson,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Validar autenticación del usuario CobroApp
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

    // 2. Leer configuración de servicios y credenciales
    const { data: config } = await supabase
      .from("digital_services_config")
      .select("*")
      .limit(1)
      .single();

    const apiKey = Deno.env.get("RECARGAMEYA_API_KEY") || config?.api_key || "";
    const secretKey = Deno.env.get("RECARGAMEYA_SECRET_KEY") || config?.api_secret || "";
    const baseUrl = config?.api_base_url || "https://recargameya.com/api/v1/public";
    const hasLiveKeys = !!(apiKey && secretKey);

    // 3. Procesar payload del request
    const body = await req.json();
    const action = body.action || "recharge";

    // A. TEST HEALTH / BALANCE (Para Dashboard del Administrador)
    if (action === "check_health" || action === "get_balance") {
      if (!hasLiveKeys) {
        return new Response(
          JSON.stringify({
            ok: true,
            mode: "sandbox_simulated",
            data: {
              status: "healthy",
              connected: false,
              balance: 10000.0,
              currency: "DOP",
              message: "Modo Sandbox local. Configure sus llaves de RecargameYa para conectar en vivo.",
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const endpoint = action === "check_health" ? "/health" : "/balance";
      const apiRes = await callRecargameYaApi({
        apiKey,
        secretKey,
        baseUrl,
        endpoint,
        method: "GET",
      });

      return new Response(
        JSON.stringify({
          ok: apiRes.ok,
          mode: apiKey.startsWith("pk_live_") ? "production" : "sandbox",
          data: apiRes.data,
          status: apiRes.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // B. CONSULTA DE FACTURA (/invoice/query)
    if (action === "query_bill" || action === "query_invoice") {
      const { company_id, contract_number } = body;
      if (!company_id || !contract_number) {
        return new Response(
          JSON.stringify({ ok: false, error: "Se requiere compañía y número de contrato/referencia" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (hasLiveKeys) {
        const apiRes = await callRecargameYaApi({
          apiKey,
          secretKey,
          baseUrl,
          endpoint: "/invoice/query",
          method: "POST",
          body: { company_id, contract_number },
        });

        if (apiRes.ok && apiRes.data) {
          return new Response(
            JSON.stringify({ ok: true, data: apiRes.data.data || apiRes.data }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Simulación de factura para sandbox
      await new Promise((r) => setTimeout(r, 450));
      return new Response(
        JSON.stringify({
          ok: true,
          mode: "sandbox",
          data: {
            contract_number,
            company_id,
            subscriber_name: "JUAN PEREZ (DEMO)",
            amount_due: 1250.0,
            minimum_amount: 500.0,
            due_date: new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0],
            invoice_id: `INV-${Date.now().toString().slice(-6)}`,
            status: "pending",
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // C. CONSULTA DE LUZ PREPAGO (/light/prepaid/account)
    if (action === "query_prepaid_account") {
      const { provider, contract } = body;
      if (!provider || !contract) {
        return new Response(
          JSON.stringify({ ok: false, error: "Se requiere proveedor y número de medidor/contrato" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (hasLiveKeys) {
        const apiRes = await callRecargameYaApi({
          apiKey,
          secretKey,
          baseUrl,
          endpoint: "/light/prepaid/account",
          method: "GET",
          queryParams: { provider, contract },
        });

        if (apiRes.ok && apiRes.data) {
          return new Response(
            JSON.stringify({ ok: true, data: apiRes.data.data || apiRes.data }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Simulación sandbox
      await new Promise((r) => setTimeout(r, 400));
      return new Response(
        JSON.stringify({
          ok: true,
          mode: "sandbox",
          data: {
            provider,
            contract,
            subscriber_name: "MARIA RODRIGUEZ (MEDIDOR DEMO)",
            meter_number: contract,
            address: "Av. Principal #45, Sto. Dgo.",
            status: "active",
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // D. TASA DE CAMBIO DE REMESA (/remittance/rate)
    if (action === "query_remittance_rate") {
      const { wallet_type = "moncash" } = body;

      if (hasLiveKeys) {
        const apiRes = await callRecargameYaApi({
          apiKey,
          secretKey,
          baseUrl,
          endpoint: "/remittance/rate",
          method: "GET",
          queryParams: { wallet_type },
        });

        if (apiRes.ok && apiRes.data) {
          return new Response(
            JSON.stringify({ ok: true, data: apiRes.data.data || apiRes.data }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Tasa simulada estimada (1 DOP aprox = 2.25 HTG)
      return new Response(
        JSON.stringify({
          ok: true,
          mode: "sandbox",
          data: {
            wallet_type,
            exchange_rate: 2.25,
            currency_from: "DOP",
            currency_to: "HTG",
            updated_at: new Date().toISOString(),
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // E. TRANSACCIONES FINANCIERAS (Recargas, Paquetes, Facturas, Luz Prepago, Remesas)
    if (
      action === "recharge" ||
      action === "pay_bill" ||
      action === "charge_prepaid_power" ||
      action === "send_remittance"
    ) {
      const {
        carrier,
        phone,
        target_number,
        target_name = "",
        amount,
        service_type = "recharge",
        client_reference_id,
        package_id,
      } = body;

      const destination = phone || target_number;

      if (!carrier || !destination || !amount || amount <= 0) {
        return new Response(
          JSON.stringify({ ok: false, error: "Faltan parámetros requeridos (proveedor, destino o monto)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Obtener billetera del comercio
      const { data: walletData, error: walletError } = await supabase
        .rpc("get_or_create_store_wallet", { p_store_id: storeId });

      if (walletError || !walletData) {
        return new Response(
          JSON.stringify({ ok: false, error: "No se pudo obtener la billetera del comercio" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Calcular comisiones (Regla de 50% de ganancia para el comercio)
      let commission = body.commission !== undefined ? Number(body.commission) : 0;
      let costAmount = body.cost_amount !== undefined ? Number(body.cost_amount) : amount;
      const customMetadata = body.metadata || {};

      if (!commission) {
        const defaultRate = (walletData.custom_commission_rate ?? config?.default_recharge_commission_rate ?? 5.5) / 2;
        if (service_type === "bill_payment") {
          commission = 2.0; // 50% de RD$ 4.00
          costAmount = Math.max(0, amount - commission);
        } else {
          commission = Math.round((amount * (defaultRate / 100)) * 100) / 100;
          costAmount = Math.round((amount - commission) * 100) / 100;
        }
      }

      // Validar saldo disponible en la billetera de servicios
      const availableBalance = Number(walletData.balance) + Number(walletData.credit_limit || 0);
      if (availableBalance < costAmount) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Saldo insuficiente en su billetera de servicios. Saldo: RD$ ${Number(walletData.balance).toFixed(2)}, Costo requerido: RD$ ${costAmount.toFixed(2)}. Por favor recargue su balance.`
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const refId = client_reference_id || `REF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      let externalId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      let apiResponseData: any = null;

      // 4. Conexión con RecargameYa según el tipo de servicio
      if (hasLiveKeys) {
        let endpoint = "/recharge";
        let apiPayload: any = {
          client_reference_id: refId,
          carrier: carrier.toLowerCase(),
          phone: destination.replace(/\D/g, ""),
          amount: amount,
        };

        if (service_type === "data_package" && package_id) {
          endpoint = "/data-package";
          apiPayload = {
            client_reference_id: refId,
            carrier: carrier.toLowerCase(),
            phone: destination.replace(/\D/g, ""),
            package_id: package_id,
          };
        } else if (service_type === "bill_payment") {
          endpoint = "/invoice/pay";
          apiPayload = {
            client_reference_id: refId,
            company_id: carrier,
            contract_number: destination,
            amount: amount,
          };
        } else if (service_type === "prepaid_power") {
          endpoint = "/light/prepaid/charge";
          apiPayload = {
            client_reference_id: refId,
            provider: carrier,
            contract: destination,
            amount: amount,
          };
        } else if (service_type === "remittance") {
          endpoint = "/remittance/send";
          apiPayload = {
            client_reference_id: refId,
            wallet_type: carrier.toLowerCase(),
            phone: destination.replace(/\D/g, ""),
            amount: amount,
            recipient_name: target_name || "Cliente Remesa",
          };
        }

        const apiRes = await callRecargameYaApi({
          apiKey,
          secretKey,
          baseUrl,
          endpoint,
          method: "POST",
          body: apiPayload,
        });

        if (!apiRes.ok || !apiRes.data || apiRes.data.ok === false) {
          const errMsg = apiRes.data?.message || apiRes.data?.error || `Error ${apiRes.status} al procesar con RecargameYa.`;
          return new Response(
            JSON.stringify({ ok: false, error: errMsg }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        apiResponseData = apiRes.data.data || apiRes.data;
        if (apiResponseData?.id) externalId = apiResponseData.id;
        if (apiResponseData?.pin) customMetadata.pin = apiResponseData.pin;
        if (apiResponseData?.token) customMetadata.token = apiResponseData.token;
        if (apiResponseData?.kwh) customMetadata.kwh = apiResponseData.kwh;
      } else {
        // Simulación Sandbox realista
        await new Promise((r) => setTimeout(r, 650));
        apiResponseData = {
          id: externalId,
          status: "completado",
          mode: "sandbox",
          amount: amount,
          carrier: carrier,
          destination: destination,
          timestamp: new Date().toISOString(),
        };

        if (service_type === "prepaid_power") {
          const pinDigits = Array.from({ length: 20 }, () => Math.floor(Math.random() * 10)).join("");
          const formattedPin = pinDigits.match(/.{1,4}/g)?.join("-") || pinDigits;
          customMetadata.pin = formattedPin;
          customMetadata.token = formattedPin;
          customMetadata.kwh = (amount / 8.5).toFixed(1);
        }
      }

      // 5. Registrar venta en la base de datos de manera atómica
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
          },
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
            target_name: target_name || null,
            amount: amount,
            amount_charged: costAmount,
            commission: commission,
            new_wallet_balance: recordResult.new_balance,
            status: "completado",
            pin: customMetadata.pin || null,
            token: customMetadata.token || null,
            kwh: customMetadata.kwh || null,
            created_at: new Date().toISOString(),
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: `Acción '${action}' no soportada.` }),
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
