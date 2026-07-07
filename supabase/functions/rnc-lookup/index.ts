import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rnc } = await req.json();

    if (!rnc) {
      return new Response(JSON.stringify({ error: "RNC es requerido" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const cleanRnc = rnc.replace(/[^0-9]/g, '');
    let name = null;

    // Timeout helper
    const fetchWithTimeout = async (url: string, ms = 5000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), ms);
      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
      } catch (e) {
        clearTimeout(id);
        throw e;
      }
    };

    // 1. Si es cédula (11 dígitos), intentamos con Adamix
    if (cleanRnc.length === 11) {
      try {
        const adamixRes = await fetchWithTimeout(`https://api.adamix.net/apec/cedula/${cleanRnc}`, 4000);
        if (adamixRes.ok) {
          const adamixData = await adamixRes.json();
          if (adamixData.ok && adamixData.nombres) {
            name = `${adamixData.nombres} ${adamixData.apellido1 || ''} ${adamixData.apellido2 || ''}`.trim();
          }
        }
      } catch (e) { console.error('Adamix API error:', e); }
    }

    // 2. Probamos Marcos API
    if (!name) {
      try {
        const marcosRes = await fetchWithTimeout(`https://api.marcos.do/rnc/${cleanRnc}`, 4000);
        if (marcosRes.ok) {
          const marcosData = await marcosRes.json();
          if (marcosData && marcosData.name) {
            name = marcosData.name.trim();
          }
        }
      } catch (e) { console.error('Marcos API error:', e); }
    }

    // 3. Probamos Statetrack
    if (!name) {
      try {
        const stRes = await fetchWithTimeout(`https://statetrack.do/api/rnc/${cleanRnc}`, 4000);
        if (stRes.ok) {
          const stData = await stRes.json();
          if (stData && stData.name) {
            name = stData.name.trim();
          }
        }
      } catch (e) { console.error('Statetrack API error:', e); }
    }

    if (name) {
      return new Response(JSON.stringify({ success: true, rnc: cleanRnc, name }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({ success: false, error: "RNC no encontrado en ninguna base de datos pública." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
