import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-pedidosya-signature, x-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Manejo de preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Ping de salud para verificar que el endpoint esté activo
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "online", service: "pedidosya-webhook", time: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const queryStoreId = url.searchParams.get("store_id");

    const bodyText = await req.text();
    let payload: any = {};
    if (bodyText) {
      try {
        payload = JSON.parse(bodyText);
      } catch (e) {
        console.error("Error parsing JSON webhook body:", e);
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("🛵 [PedidosYa Webhook] Payload recibido:", JSON.stringify(payload));

    // Determinar el store_id
    let targetStoreId = queryStoreId || payload.store_id || payload.storeId;

    // Si viene restaurantId / vendorId de PedidosYa, buscar la tienda correspondiente
    const vendorId = payload.restaurantId || payload.vendorId || payload.store?.id || payload.restaurant_id;
    if (!targetStoreId && vendorId) {
      // Buscar en store_settings o stores
      const { data: storeWithSettings } = await supabase
        .from("stores")
        .select("id, store_settings")
        .limit(50);

      if (storeWithSettings) {
        const matched = storeWithSettings.find((s: any) => {
          const settings = Array.isArray(s.store_settings) ? s.store_settings[0] : s.store_settings;
          return settings?.pedidosya_store_id === String(vendorId);
        });
        if (matched) {
          targetStoreId = matched.id;
        }
      }
    }

    // Si aún no tenemos store_id y sólo hay una tienda en el sistema o viene en query
    if (!targetStoreId) {
      const { data: firstStore } = await supabase.from("stores").select("id").limit(1).maybeSingle();
      targetStoreId = firstStore?.id;
    }

    if (!targetStoreId) {
      console.error("❌ No se encontró store_id para el pedido de PedidosYa");
      return new Response(
        JSON.stringify({ error: "No target store found. Provide ?store_id=UUID in webhook URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extraer datos del pedido de PedidosYa (soporta múltiples estructuras comunes de API de Delivery Hero / PedidosYa)
    const orderData = payload.order || payload.data || payload;
    const rawOrderId = orderData.id || orderData.orderId || orderData.order_id || Math.floor(100000 + Math.random() * 900000);
    const orderNumber = String(rawOrderId).startsWith("PY-") ? String(rawOrderId) : `PY-${rawOrderId}`;

    // Obtener información del cliente
    const customerObj = orderData.customer || {};
    const customerName = customerObj.name || customerObj.fullName || orderData.customer_name || "Cliente PedidosYa";
    const customerPhone = customerObj.phone || customerObj.phoneNumber || orderData.customer_phone || "";

    // Dirección de entrega
    const addressObj = orderData.deliveryAddress || orderData.address || customerObj.address || {};
    let customerAddress = "";
    if (typeof addressObj === "string") {
      customerAddress = addressObj;
    } else if (addressObj) {
      const street = addressObj.street || addressObj.address || "";
      const number = addressObj.number || addressObj.doorNumber || "";
      const notes = addressObj.notes || addressObj.description || "";
      customerAddress = [street, number, notes].filter(Boolean).join(", ");
    }

    // Notas generales
    const orderNotes = orderData.notes || orderData.comments || orderData.specialInstructions || payload.notes || "";

    // Totales
    const total = Number(orderData.total || orderData.totalAmount || orderData.amount || 0);
    const subtotal = Number(orderData.subtotal || orderData.subtotalAmount || total);
    const taxTotal = Number(orderData.tax || orderData.taxAmount || 0);
    const discountTotal = Number(orderData.discount || orderData.discountAmount || 0);

    // Método de pago
    const paymentInfo = orderData.payment || orderData.paymentMethod || {};
    let paymentMethod = "pedidosya_online";
    if (typeof paymentInfo === "string") {
      paymentMethod = paymentInfo.toLowerCase().includes("cash") || paymentInfo.toLowerCase().includes("efectivo") ? "cash" : "pedidosya_online";
    } else if (paymentInfo.type || paymentInfo.method) {
      const pMethod = String(paymentInfo.type || paymentInfo.method).toLowerCase();
      paymentMethod = pMethod.includes("cash") || pMethod.includes("efectivo") ? "cash" : "pedidosya_online";
    }

    // Verificar si ya existe este pedido para no duplicarlo (idempotencia)
    const { data: existingOrder } = await supabase
      .from("open_orders")
      .select("id, order_number")
      .eq("store_id", targetStoreId)
      .eq("order_number", orderNumber)
      .maybeSingle();

    if (existingOrder) {
      console.log(`ℹ️ El pedido ${orderNumber} ya existe en el sistema. ID: ${existingOrder.id}`);
      return new Response(
        JSON.stringify({ success: true, message: "Order already registered", order_id: existingOrder.id, order_number: existingOrder.order_number }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inserción en open_orders
    const { data: insertedOrder, error: insertOrderErr } = await supabase
      .from("open_orders")
      .insert({
        store_id: targetStoreId,
        order_number: orderNumber,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        customer_address: customerAddress || null,
        notes: orderNotes || null,
        source: "pedidosya",
        order_status: "pending",
        payment_method: paymentMethod,
        payment_status: paymentMethod === "cash" ? "pending" : "paid",
        subtotal: subtotal,
        tax_total: taxTotal,
        discount_total: discountTotal,
        total: total,
      })
      .select()
      .single();

    if (insertOrderErr || !insertedOrder) {
      console.error("❌ Error al insertar open_orders:", insertOrderErr);
      throw insertOrderErr || new Error("Failed to insert open_orders");
    }

    // Procesar Items
    const rawItems = orderData.items || orderData.products || orderData.orderItems || [];
    const itemsToInsert = [];

    if (Array.isArray(rawItems) && rawItems.length > 0) {
      for (const item of rawItems) {
        const quantity = Number(item.quantity || item.qty || 1);
        const unitPrice = Number(item.unitPrice || item.price || item.unit_price || 0);
        const itemTotal = Number(item.total || item.totalPrice || unitPrice * quantity);
        let itemName = item.name || item.product_name || item.title || "Producto PedidosYa";

        // Si tiene agregados / modificadores
        if (Array.isArray(item.modifiers || item.options || item.additions) && (item.modifiers || item.options || item.additions).length > 0) {
          const modNames = (item.modifiers || item.options || item.additions).map((m: any) => m.name || m.title).filter(Boolean).join(", ");
          if (modNames) {
            itemName += ` (${modNames})`;
          }
        }

        if (item.notes || item.comments) {
          itemName += ` [Nota: ${item.notes || item.comments}]`;
        }

        itemsToInsert.push({
          order_id: insertedOrder.id,
          product_name: itemName,
          product_id: item.productId || item.product_id || null,
          quantity: quantity,
          unit_price: unitPrice,
          subtotal: itemTotal,
          total: itemTotal,
          tax_percentage: 18,
          tax_amount: 0,
        });
      }
    } else {
      // Fallback si viene sin desglose detallado de items
      itemsToInsert.push({
        order_id: insertedOrder.id,
        product_name: "Pedido PedidosYa",
        product_id: null,
        quantity: 1,
        unit_price: total,
        subtotal: total,
        total: total,
        tax_percentage: 18,
        tax_amount: 0,
      });
    }

    if (itemsToInsert.length > 0) {
      const { error: itemsInsertErr } = await supabase
        .from("open_order_items")
        .insert(itemsToInsert);

      if (itemsInsertErr) {
        console.error("⚠️ Error insertando items del pedido:", itemsInsertErr);
      }
    }

    // Inserción de mensaje inicial en el chat del pedido
    try {
      await supabase.from("chat_messages").insert({
        order_id: insertedOrder.id,
        store_id: targetStoreId,
        sender_role: "store",
        sender_name: "PedidosYa Integration",
        message: `🛵 Pedido #${orderNumber} recibido automáticamente desde PedidosYa. Monto: $${total.toFixed(2)}`,
      });
    } catch (chatErr) {
      console.warn("No se pudo insertar mensaje inicial en chat_messages:", chatErr);
    }

    console.log(`✅ Pedido ${orderNumber} registrado exitosamente para la tienda ${targetStoreId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Order successfully processed",
        order_id: insertedOrder.id,
        order_number: insertedOrder.order_number,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Error en pedidosya-webhook:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
