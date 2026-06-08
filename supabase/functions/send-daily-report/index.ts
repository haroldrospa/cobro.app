import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { Resend } from "npm:resend@2.0.0";
import { logoBase64 } from "./logo-base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  store_id?: string;
  recipient_email?: string;
  report_type?: 'daily' | 'weekly';
  scheduled?: boolean;
  session_id?: string;
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
      return new Response(JSON.stringify({ error: "Error interno del servidor (Variables de entorno de Supabase faltantes)" }), { status: 500, headers });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendKey);

    const body: ReportRequest = await req.json().catch(() => ({}));

    if (body.scheduled) {
      console.log("Running scheduled email reports...");
      const { data: storesWithReports, error: storesError } = await supabase
        .from('store_settings')
        .select('store_id, email_reports_recipient, email_reports_frequency, email_reports_last_sent')
        .eq('email_reports_enabled', true)
        .not('email_reports_recipient', 'is', null);

      if (storesError) throw storesError;

      const now = new Date();
      const results = [];

      for (const store of storesWithReports || []) {
        const lastSent = store.email_reports_last_sent ? new Date(store.email_reports_last_sent) : null;
        const frequency = store.email_reports_frequency || 'daily';

        let shouldSend = true;
        if (lastSent) {
          const hoursSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
          if (frequency === 'daily' && hoursSinceLastSent < 20) shouldSend = false;
          else if (frequency === 'weekly' && hoursSinceLastSent < 140) shouldSend = false;
        }

        if (shouldSend && store.store_id && store.email_reports_recipient) {
          try {
            const result = await sendReportForStore(supabase, resend, store.store_id, store.email_reports_recipient, frequency as 'daily' | 'weekly');
            results.push({ store_id: store.store_id, success: true, ...result });
          } catch (err: any) {
            console.error(`Error sending report for store ${store.store_id}:`, err);
            results.push({ store_id: store.store_id, success: false, error: err.message });
          }
        }
      }

      return new Response(JSON.stringify({ scheduled: true, results }), { status: 200, headers });
    }

    const { store_id, recipient_email, report_type, session_id } = body;

    if (!store_id) {
      return new Response(JSON.stringify({ error: "store_id es requerido" }), { status: 400, headers });
    }

    let finalRecipient = recipient_email;

    if (!finalRecipient) {
      console.log(`Buscando destinatario para tienda ${store_id}...`);
      const { data: storeSettings } = await supabase
        .from('store_settings')
        .select('email_reports_recipient, email_reports_enabled')
        .eq('store_id', store_id)
        .maybeSingle();
      
      if (!storeSettings?.email_reports_recipient) {
        const { data: companySettings } = await supabase
          .from('company_settings')
          .select('email')
          .eq('store_id', store_id)
          .maybeSingle();
        
        finalRecipient = companySettings?.email;
        if (!finalRecipient) {
          return new Response(JSON.stringify({ 
            error: "No se encontró un correo configurado. Por favor, especifícalo en Ajustes > Informes o en los ajustes de la empresa." 
          }), { status: 400, headers });
        }
      } else {
        finalRecipient = storeSettings.email_reports_recipient;
      }
    }

    console.log(`Iniciando envío de reporte a: ${finalRecipient}`);

    const result = await sendReportForStore(supabase, resend, store_id, finalRecipient, report_type || 'daily', session_id);
    return new Response(JSON.stringify(result), { status: 200, headers });

  } catch (error: any) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Error interno desconocido", details: error.toString() }), { status: 500, headers });
  }
});

async function sendReportForStore(
  supabase: any,
  resend: Resend,
  store_id: string,
  recipient_email: string,
  report_type: 'daily' | 'weekly',
  session_id?: string
) {
  try {
    const reportLabel = report_type === 'weekly' ? 'Semanal' : 'Diario';
    const now = new Date();
    
    // Ensure logo exists in public storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const logoUrl = `${supabaseUrl}/storage/v1/object/public/product-images/cobro-logo.png`;

    try {
      const { data: logoExists } = await supabase.storage
        .from('product-images')
        .list('', {
          limit: 1,
          search: 'cobro-logo.png'
        });

      if (!logoExists || logoExists.length === 0) {
        console.log("Logo not found in storage, uploading...");
        const binaryString = atob(logoBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload('cobro-logo.png', bytes.buffer, {
            contentType: 'image/png',
            upsert: true
          });
          
        if (uploadError) {
          console.error("Error uploading logo to storage:", uploadError);
        } else {
          console.log("Logo uploaded successfully to product-images/cobro-logo.png");
        }
      }
    } catch (err) {
      console.error("Failed to verify/upload logo:", err);
    }
    const nowLocal = new Date(now.getTime() - (4 * 60 * 60 * 1000));
    
    // Default Dates
    let currentStart = new Date(now);
    if (report_type === 'weekly') currentStart.setDate(currentStart.getDate() - 7);
    else currentStart.setHours(0, 0, 0, 0);

    let currentEnd = new Date(now);

    const prevStart = new Date(currentStart);
    if (report_type === 'weekly') prevStart.setDate(prevStart.getDate() - 7);
    else prevStart.setDate(prevStart.getDate() - 1);

    const prevEnd = new Date(currentStart);

    // Fetch Session Detail if available
    let sessionData = null;
    if (session_id) {
      const { data: sd } = await supabase
        .from('cash_sessions')
        .select('*, opener:opened_by(full_name), closer:closed_by(full_name)')
        .eq('id', session_id)
        .maybeSingle();
      
      if (sd) {
        sessionData = sd;
        currentStart = new Date(sd.opened_at);
        if (sd.closed_at) currentEnd = new Date(sd.closed_at);
      }
    } else {
      // Get last session even if no ID provided for "closure information" section
      const { data: lastSd } = await supabase
        .from('cash_sessions')
        .select('*, opener:opened_by(full_name), closer:closed_by(full_name)')
        .eq('store_id', store_id)
        .order('closed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      sessionData = lastSd;
    }

    // Fetch Stats
    const { data: currentSales } = await supabase.from('sales').select('id, total').eq('store_id', store_id).gte('created_at', currentStart.toISOString()).lte('created_at', currentEnd.toISOString());
    const { data: prevSales } = await supabase.from('sales').select('total').eq('store_id', store_id).gte('created_at', prevStart.toISOString()).lt('created_at', prevEnd.toISOString());

    const totalSales = (currentSales || []).reduce((acc: number, s: any) => acc + (s.total || 0), 0);
    const prevTotalSales = (prevSales || []).reduce((acc: number, s: any) => acc + (s.total || 0), 0);
    const totalOrders = currentSales?.length || 0;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
    const salesChange = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0;

    // Payment Methods
    const { data: methods } = await supabase.from('sales').select('id, total, payment_method').eq('store_id', store_id).gte('created_at', currentStart.toISOString()).lte('created_at', currentEnd.toISOString());
    const cashSales = (methods || []).filter((s: any) => s.payment_method === 'cash').reduce((a: number, s: any) => a + (s.total || 0), 0);
    const cardSales = (methods || []).filter((s: any) => s.payment_method === 'card').reduce((a: number, s: any) => a + (s.total || 0), 0);
    const xfSales = (methods || []).filter((s: any) => s.payment_method === 'transfer').reduce((a: number, s: any) => a + (s.total || 0), 0);
    const creditSales = (methods || []).filter((s: any) => s.payment_method === 'credit').reduce((a: number, s: any) => a + (s.total || 0), 0);

    // Fetch Store Name
    const { data: storeInfo } = await supabase.from('stores').select('store_name').eq('id', store_id).maybeSingle();
    const companyName = storeInfo?.store_name || "Mi Empresa";

    // Weekly breakdown (Always global for the store)
    const weeklyBreakdown = [];
    let weekTotal = 0;
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const { data: weekSales } = await supabase.from('sales').select('total, created_at').eq('store_id', store_id).gte('created_at', weekStart.toISOString());

    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const daySales = (weekSales || []).filter((s: any) => new Date(s.created_at).toDateString() === d.toDateString());
      const total = daySales.reduce((a, s) => a + s.total, 0);
      weekTotal += total;
      weeklyBreakdown.push({
        fullName: days[d.getDay()],
        date: d,
        total,
        orders: daySales.length,
        isToday: d.toDateString() === nowLocal.toDateString(),
        isPast: d < nowLocal
      });
    }
    const maxWeekDay = Math.max(...weeklyBreakdown.map(d => d.total), 1);
    const bestDay = weeklyBreakdown.reduce((prev, curr) => (prev.total > curr.total) ? prev : curr);

    // Top Products (Specific to session if session_id provided)
    const currentSalesIds = (currentSales || []).map((s: any) => s.id);
    let currentItems: any[] = [];
    if (currentSalesIds.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < currentSalesIds.length; i += chunkSize) {
        const chunk = currentSalesIds.slice(i, i + chunkSize);
        const { data } = await supabase.from('sale_items').select('quantity, total, product_id, sale_id').in('sale_id', chunk);
        if (data) currentItems.push(...data);
      }
    }
    const productMap = new Map();
    (currentItems || []).forEach((item: any) => {
      if (item.product_id) {
        const existing = productMap.get(item.product_id) || { quantity: 0, total: 0 };
        existing.quantity += item.quantity;
        existing.total += item.total;
        productMap.set(item.product_id, existing);
      }
    });
    
    const topIds = Array.from(productMap.entries()).sort((a,b) => b[1].quantity - a[1].quantity).slice(0, 5);
    let topProducts: any[] = [];
    if (topIds.length > 0) {
      const { data: prods } = await supabase.from('products').select('id, name').in('id', topIds.map(p => p[0]));
      topProducts = topIds.map(([id, stats]) => ({
        ...stats,
        name: prods?.find((p:any) => p.id === id)?.name || 'Producto'
      }));
    }

    // Low stock alerts & product cost mapping
    const { data: allProds } = await supabase.from('products').select('id, name, stock, min_stock, sku, track_inventory, cost, status').eq('store_id', store_id);
    const lowStock = (allProds || [])
      .filter((p: any) => p.status === 'active' && p.track_inventory !== false && p.stock <= (p.min_stock || 5))
      .sort((a: any, b: any) => a.stock - b.stock)
      .slice(0, 8);

    // Calculate cash & card sales reinvestment (cost) and net profit
    const cashAndCardSales = cashSales + cardSales;
    const cashAndCardSalesIds = (methods || []).filter((s: any) => s.payment_method === 'cash' || s.payment_method === 'card').map((s: any) => s.id);
    const productsMap = new Map();
    (allProds || []).forEach((p: any) => {
      productsMap.set(p.id, p);
    });

    let cashAndCardCost = 0;
    (currentItems || []).forEach((item: any) => {
      if (item.sale_id && cashAndCardSalesIds.includes(item.sale_id)) {
        const product = productsMap.get(item.product_id);
        if (product && product.cost) {
          cashAndCardCost += (product.cost as number) * (item.quantity || 0);
        }
      }
    });

    const cashAndCardProfit = cashAndCardSales - cashAndCardCost;
    const cashAndCardCostPct = cashAndCardSales > 0 ? (cashAndCardCost / cashAndCardSales) * 100 : 0;
    const cashAndCardProfitPct = cashAndCardSales > 0 ? (cashAndCardProfit / cashAndCardSales) * 100 : 0;


    // Helpers
    const formatCurrency = (val: number) => `RD$ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatCompact = (val: number) => `RD$ ${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    const changeIcon = salesChange >= 0 ? '↗' : '↘';
    const compLabel = report_type === 'weekly' ? 'semana anterior' : 'día anterior';

    // Session section HTML
    const closingSection = sessionData ? (() => {
      const c = sessionData;
      const closedAt = c.closed_at ? new Date(c.closed_at).toLocaleString('es-DO') : '—';
      const closingTotal = (c.total_sales_cash || 0) + (c.total_sales_card || 0) + (c.total_sales_transfer || 0) + (c.total_sales_other || 0);
      const diffColor = (c.difference || 0) >= 0 ? '#10b981' : '#ef4444';
      const diffBg = (c.difference || 0) >= 0 ? '#f0fdf4' : '#fef2f2';
      const cashierName = c.closer?.full_name || c.opener?.full_name || 'Personal';

      return `
      <div style="margin-bottom:48px;">
        <div style="font-size:16px; font-weight:800; color:#0f172a; margin-bottom:20px; display:flex; align-items:center;">
          <span style="background:#15803d; width:4px; height:18px; border-radius:4px; margin-right:10px; display:inline-block;"></span>
          Detalles del Cierre (Cajero/a: ${cashierName})
        </div>
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:32px; overflow:hidden;">
          <div style="background:#f8fafc; padding:24px 32px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between;">
            <div><div style="font-size:10px; color:#64748b; font-weight:800; text-transform:uppercase; margin-bottom:4px;">FECHA CIERRE</div><div style="font-size:15px; font-weight:900;">${closedAt}</div></div>
            <div style="text-align:right;"><div style="font-size:10px; color:#64748b; font-weight:800; text-transform:uppercase; margin-bottom:4px;">RESPONSABLE</div><div style="font-size:15px; font-weight:900; color:#15803d;">${cashierName}</div></div>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding:28px 32px; border-right:1px solid #f1f5f9; border-bottom:1px solid #f1f5f9; width:50%;">
                <div style="font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:8px;">Ventas de Sesión</div>
                <div style="font-size:26px; font-weight:950; color:#0f172a;">${formatCurrency(closingTotal)}</div>
              </td>
              <td style="padding:28px 32px; border-bottom:1px solid #f1f5f9;">
                <div style="font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:8px;">Efectivo Esperado</div>
                <div style="font-size:26px; font-weight:950; color:#0f172a;">${formatCurrency(c.expected_cash || 0)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px; border-right:1px solid #f1f5f9;">
                <div style="font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:8px;">Efectivo Real</div>
                <div style="font-size:22px; font-weight:900; color:#0f172a;">${formatCurrency(c.actual_cash || 0)}</div>
              </td>
              <td style="padding:28px 32px; background:${diffBg};">
                <div style="font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:8px;">Diferencia</div>
                <div style="font-size:22px; font-weight:950; color:${diffColor};">${(c.difference || 0) >= 0 ? '+' : ''}${formatCurrency(c.difference || 0)}</div>
              </td>
            </tr>
          </table>
          ${c.notes ? `<div style="padding:20px 32px; background:#f9fafb; border-top:1px solid #f1f5f9; font-size:13px; color:#475569; line-height:1.5;"><strong>Observaciones:</strong> ${c.notes}</div>` : ''}
        </div>
      </div>`;
    })() : `<div style="margin-bottom:48px; padding:32px; background:#f8fafc; border:3px dashed #e2e8f0; border-radius:32px; text-align:center; color:#64748b; font-weight:600;">No se encontró registro de sesión para este reporte</div>`;

    // Weekly rows HTML
    const weeklyRows = weeklyBreakdown.map(d => {
      const barWidth = Math.round((d.total / maxWeekDay) * 100);
      const color = d.isToday ? '#16a34a' : '#cbd5e1';
      const weight = d.isToday ? '900' : '600';
      return `
      <tr style="border-top:1px solid #f8fafc;">
        <td style="padding:18px 24px; font-size:14px; font-weight:${weight}; color:${d.isToday ? '#0f172a' : '#64748b'};">${d.fullName}</td>
        <td style="padding:18px 0; width:100%;">
          <div style="height:10px; background:#f1f5f9; border-radius:100px; width:100%; max-width:180px;"><div style="width:${barWidth}%; height:100%; background:${color}; border-radius:100px;"></div></div>
        </td>
        <td style="padding:18px 24px; text-align:right; font-size:15px; font-weight:900; color:#0f172a;">${d.total > 0 ? formatCompact(d.total) : '—'}</td>
      </tr>`;
    }).join('');

    // Top Products rows
    const topProdRows = topProducts.map(p => `
      <tr style="border-top:1px solid #f8fafc;">
        <td style="padding:24px; display:flex; align-items:center;">
          <div style="background:#f0fdf4; color:#166534; width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:900; margin-right:16px;">P</div>
          <div style="font-size:15px; font-weight:800; color:#0f172a;">${p.name}</div>
        </td>
        <td style="padding:24px; text-align:right;">
          <div style="font-size:18px; font-weight:950; color:#15803d;">${p.quantity} <span style="font-size:11px; color:#94a3b8; font-weight:700;">UND</span></div>
        </td>
      </tr>`).join('');

    // Low stock rows
    const lowStockRows = lowStock.map(p => `
      <tr style="border-top:1px solid #f8fafc; background:${p.stock <= 0 ? '#fef2f2' : '#ffffff'};">
        <td style="padding:20px 24px;">
          <div style="font-size:14px; font-weight:800; color:#1e293b;">${p.name}</div>
          <div style="font-size:11px; color:#94a3b8; font-weight:700; margin-top:4px;">REF: ${p.sku || 'N/D'}</div>
        </td>
        <td style="padding:20px 24px; text-align:right;">
          <div style="font-size:18px; font-weight:950; color:${p.stock <= 0 ? '#ef4444' : '#f59e0b'};">${p.stock}</div>
        </td>
      </tr>`).join('');

    // Full Email HTML
    const emailHTML = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; background-color:#f8fafc; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e293b;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc; padding:40px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:32px; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.08);">
            
            <!-- ▬▬ HEADER ▬▬ -->
            <tr><td style="padding:48px 40px; text-align:center; border-bottom:1px solid #f1f5f9; background: linear-gradient(to bottom, #ffffff, #fdfdfd);">
              <div style="display:inline-block; background-color:rgba(22, 163, 74, 0.1); border:1px solid rgba(22, 163, 74, 0.2); border-radius:100px; padding:8px 16px; font-size:11px; font-weight:800; color:#15803d; letter-spacing:1px; text-transform:uppercase; margin-bottom:20px;">
                ${session_id ? '🔒 CIERRE DE CAJA' : `REPORTE ${reportLabel.toUpperCase()}`}
              </div>
              <h1 style="margin:0; font-size:32px; font-weight:900; color:#0f172a; letter-spacing:-1px;">${companyName}</h1>
              <div style="margin-top:16px; color:#64748b; font-size:14px; display:flex; align-items:center; justify-content:center; gap:8px;">
                <span style="background:#f1f5f9; padding:4px 10px; border-radius:6px; font-weight:600;">📅 ${nowLocal.toLocaleDateString('es-DO', { day: 'numeric', month: 'long' })}</span>
                <span style="background:#f1f5f9; padding:4px 10px; border-radius:6px; font-weight:600;">⏰ ${nowLocal.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </td></tr>

            <!-- ▬▬ MAIN STAT ▬▬ -->
            <tr><td style="padding:48px 40px 0;">
              <div style="background:linear-gradient(135deg, #166534, #15803d); border-radius:28px; padding:40px 32px; text-align:center; color:#ffffff; box-shadow:0 12px 24px rgba(22, 163, 74, 0.2);">
                <div style="font-size:13px; font-weight:700; opacity:0.9; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">Ventas Totales del Periodo</div>
                <div style="font-size:52px; font-weight:950; margin:0; letter-spacing:-1.5px;">${formatCurrency(totalSales)}</div>
                <div style="margin-top:20px;">
                  <span style="background:rgba(255,255,255,0.2); backdrop-filter:blur(10px); color:#ffffff; padding:8px 16px; border-radius:100px; font-size:14px; font-weight:700;">
                    ${changeIcon} ${salesChange >= 0 ? '+' : ''}${salesChange.toFixed(1)}% vs. ${compLabel}
                  </span>
                </div>
              </div>
            </td></tr>

            <!-- ▬▬ SECONDARY STATS ▬▬ -->
            <tr><td style="padding:32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:40px;">
                <tr>
                  <td width="48%" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:20px; padding:20px; text-align:center;">
                    <div style="font-size:10px; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:6px;">Órdenes</div>
                    <div style="font-size:24px; font-weight:900; color:#0f172a;">${totalOrders}</div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:20px; padding:20px; text-align:center;">
                    <div style="font-size:10px; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:6px;">Ticket Promedio</div>
                    <div style="font-size:24px; font-weight:900; color:#0f172a;">${formatCompact(avgTicket)}</div>
                  </td>
                </tr>
              </table>

              <!-- Métodos de Pago -->
              <div style="margin-bottom:48px;">
                <div style="font-size:16px; font-weight:800; color:#0f172a; margin-bottom:20px; display:flex; align-items:center;">
                  <span style="background:#15803d; width:4px; height:18px; border-radius:4px; margin-right:10px; display:inline-block;"></span>
                  Métodos de Pago
                </div>
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:24px; overflow:hidden;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="25%" align="center" style="padding:24px 16px; border-right:1px solid #f1f5f9;"><div style="font-size:11px; font-weight:800; color:#64748b; margin-bottom:8px;">EFECTIVO</div><div style="font-size:16px; font-weight:800; color:#0f172a;">${formatCompact(cashSales)}</div></td>
                      <td width="25%" align="center" style="padding:24px 16px; border-right:1px solid #f1f5f9;"><div style="font-size:11px; font-weight:800; color:#64748b; margin-bottom:8px;">TARJETA</div><div style="font-size:16px; font-weight:800; color:#0f172a;">${formatCompact(cardSales)}</div></td>
                      <td width="25%" align="center" style="padding:24px 16px; border-right:1px solid #f1f5f9;"><div style="font-size:11px; font-weight:800; color:#64748b; margin-bottom:8px;">TRANSF.</div><div style="font-size:16px; font-weight:800; color:#0f172a;">${formatCompact(xfSales)}</div></td>
                      <td width="25%" align="center" style="padding:24px 16px;"><div style="font-size:11px; font-weight:800; color:#64748b; margin-bottom:8px;">CRÉDITO</div><div style="font-size:16px; font-weight:800; color:#ef4444;">${formatCompact(creditSales)}</div></td>
                    </tr>
                  </table>
                </div>
              </div>

              <!-- Cierre de Caja Info -->
              ${closingSection}

              <!-- Gráfico Semanal -->
              <div style="margin-bottom:48px;">
                <div style="font-size:16px; font-weight:800; color:#0f172a; margin-bottom:20px; display:flex; align-items:center;">
                  <span style="background:#15803d; width:4px; height:18px; border-radius:4px; margin-right:10px; display:inline-block;"></span>
                  Resumen de la Semana (Global)
                </div>
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:24px; padding:8px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    ${weeklyRows}
                  </table>
                  <div style="padding:16px; background:#f0fdf4; border-radius:16px; margin:8px; display:flex; align-items:center;">
                    <span style="font-size:18px; margin-right:10px;">⭐</span>
                    <div style="font-size:13px; color:#166534;">El mejor día fue el <strong>${bestDay.fullName}</strong> con un total de <strong>${formatCurrency(bestDay.total)}</strong>.</div>
                  </div>
                </div>
              </div>

              <!-- Top Productos -->
              ${topProducts.length > 0 ? `
              <div style="margin-bottom:48px;">
                <div style="font-size:16px; font-weight:800; color:#0f172a; margin-bottom:20px; display:flex; align-items:center;">
                  <span style="background:#15803d; width:4px; height:18px; border-radius:4px; margin-right:10px; display:inline-block;"></span>
                  Productos Más Vendidos (Sesión)
                </div>
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:24px; overflow:hidden;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">${topProdRows}</table>
                </div>
              </div>` : ''}

              <!-- Análisis de Rentabilidad (Efectivo + Tarjeta) -->
              <div style="margin-bottom:48px;">
                <div style="font-size:16px; font-weight:800; color:#0f172a; margin-bottom:20px; display:flex; align-items:center;">
                  <span style="background:#15803d; width:4px; height:18px; border-radius:4px; margin-right:10px; display:inline-block;"></span>
                  Análisis de Rentabilidad (Efectivo + Tarjeta)
                </div>
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:24px; overflow:hidden;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="padding:24px; border-bottom:1px solid #f1f5f9; background:#f8fafc;" colspan="2">
                        <div style="font-size:10px; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:4px;">TOTAL VENDIDO (EFECTIVO + TARJETA)</div>
                        <div style="font-size:28px; font-weight:950; color:#0f172a;">${formatCurrency(cashAndCardSales)}</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:24px; border-right:1px solid #f1f5f9; width:50%;">
                        <div style="font-size:10px; font-weight:800; color:#3b82f6; text-transform:uppercase; margin-bottom:6px;">Reinversión (Costo)</div>
                        <div style="font-size:20px; font-weight:900; color:#1e293b;">${formatCurrency(cashAndCardCost)}</div>
                        <div style="font-size:12px; color:#64748b; margin-top:4px; font-weight:600;">${cashAndCardCostPct.toFixed(1)}% de la venta</div>
                      </td>
                      <td style="padding:24px; background:#f0fdf4;">
                        <div style="font-size:10px; font-weight:800; color:#16a34a; text-transform:uppercase; margin-bottom:6px;">Ganancia Neta</div>
                        <div style="font-size:20px; font-weight:900; color:#15803d;">${formatCurrency(cashAndCardProfit)}</div>
                        <div style="font-size:12px; color:#166534; margin-top:4px; font-weight:600;">${cashAndCardProfitPct.toFixed(1)}% de la venta</div>
                      </td>
                    </tr>
                  </table>
                  ${cashAndCardCost === 0 && cashAndCardSales > 0 ? `
                  <div style="padding:16px 24px; background:#fffbeb; border-top:1px solid #fef3c7; font-size:12px; color:#b45309; line-height:1.5; font-weight:600;">
                    ⚠️ Nota: Los productos vendidos no tienen costo de compra registrado. Registra los costos de tus productos en el inventario para calcular la ganancia real.
                  </div>
                  ` : ''}
                </div>
              </div>

              <!-- Alertas Inventario -->
              <div style="margin-bottom:8px;">
                <div style="font-size:16px; font-weight:800; color:#0f172a; margin-bottom:20px; display:flex; align-items:center;">
                  <span style="background:#ef4444; width:4px; height:18px; border-radius:4px; margin-right:10px; display:inline-block;"></span>
                  Alertas de Inventario Crítico
                </div>
                ${lowStock.length > 0 ? `
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:24px; overflow:hidden;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">${lowStockRows}</table>
                </div>` : `
                <div style="text-align:center; padding:32px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:24px; color:#166534; font-weight:700;">
                  ✨ Todo el stock está al día. No hay alertas pendientes.
                </div>`}
              </div>

            </td></tr>

            <!-- ▬▬ FOOTER ▬▬ -->
            <tr><td style="background-color:#0f172a; padding:48px 40px; text-align:center;">
              <div style="display:inline-flex; align-items:center; justify-content:center; gap:8px; margin-bottom:16px;">
                <img src="${logoUrl}" alt="Cobro" style="height:28px; width:auto; vertical-align:middle; display:inline-block;" />
                <span style="font-size:20px; font-weight:900; color:#ffffff; letter-spacing:-0.5px;">Cobro<span style="color:#10b981;">app</span></span>
              </div>
              <div style="margin-top:8px; display:flex; justify-content:center; gap:20px;">
                <p style="margin:0; font-size:12px; color:#94a3b8; font-weight:500;">
                  © ${new Date().getFullYear()} ${companyName}.<br>Desarrollado para la eficiencia de tu negocio.
                </p>
              </div>
            </td></tr>

          </table>
          <div style="padding:32px; text-align:center; font-size:12px; color:#94a3b8; line-height:1.6;">
            Este es un reporte automático generado por el sistema de Cobroapp.<br>
            No respondas a este correo.
          </div>
        </td></tr>
      </table>
    </body>
    </html>`;

    const subjectPrefix = session_id ? "🔒 Cierre de Caja" : `📊 Informe ${reportLabel}`;
    
    const { data: resData, error: resError } = await resend.emails.send({
      from: `${companyName} <reportes@cobroapp.app>`,
      to: [recipient_email],
      subject: `${subjectPrefix} — ${companyName}`,
      html: emailHTML,
    });

    if (resError) {
      console.error("Resend Error Detail:", resError);
      throw new Error(`Resend Error: ${JSON.stringify(resError)}`);
    }

    // Mark as sent
    await supabase.from('store_settings').update({ email_reports_last_sent: now.toISOString() }).eq('store_id', store_id);

    return { success: true, emailId: resData?.id };

  } catch (err: any) {
    console.error("sendReportForStore Error:", err);
    throw err;
  }
}
