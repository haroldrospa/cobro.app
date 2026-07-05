import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Environment, Paddle } from 'npm:@paddle/paddle-node-sdk@^1.2.1';

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Inicializamos el SDK de Paddle (Backend)
const paddleApiKey = Deno.env.get("PADDLE_API_KEY") || "";
const paddleWebhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET") || "";

const paddle = new Paddle(paddleApiKey, {
  environment: Environment.production, // Entorno en vivo
});

serve(async (req) => {
  try {
    // Solo aceptamos POST
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const signature = req.headers.get('paddle-signature') || '';
    const bodyText = await req.text();

    // Verificamos la firma usando el SDK de Paddle
    if (!signature) {
      console.error('Missing Paddle signature');
      return new Response('Missing signature', { status: 400 });
    }

    let eventData;
    try {
      eventData = paddle.webhooks.unmarshal(bodyText, paddleWebhookSecret, signature);
    } catch (e) {
      console.error('Signature validation failed:', e);
      return new Response('Invalid signature', { status: 400 });
    }

    console.log(`Evento recibido: ${eventData.eventType}`);

    // Solo nos interesan los eventos de transacciones completadas
    if (eventData.eventType === 'transaction.completed') {
      const transaction = eventData.data;
      
      // En el checkout enviamos el custom_data con el ID de la empresa y plan
      const customData = transaction.customData as Record<string, any>;
      const companyId = customData?.company_id;
      const targetPlanId = customData?.target_plan_id;

      if (companyId) {
        console.log(`Activando suscripción para company_id: ${companyId}`);
        
        // Ejecutamos la activación en Supabase (llamando al mismo RPC que usamos)
        const { data, error } = await supabase.rpc('submit_payment_and_activate', {
            p_company_id: companyId,
            p_amount: parseInt(transaction.details?.totals?.total || '0') / 100, // Paddle envía en centavos
            p_currency: transaction.currencyCode || 'USD',
            p_bank_name: 'Paddle Card',
            p_proof_url: `txn_${transaction.id}`,
            p_target_plan_id: targetPlanId || 'basic'
        });

        if (error) {
          console.error('Error al activar suscripción en DB:', error);
          throw error;
        }

        console.log('Suscripción activada con éxito');
      } else {
        console.warn('Transacción exitosa pero sin company_id en el custom_data');
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
