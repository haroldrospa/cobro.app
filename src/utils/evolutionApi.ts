import { supabase } from '@/integrations/supabase/client';

export interface EvolutionApiConfig {
  url: string;
  instanceName: string;
  apiKey: string;
}

/**
 * Formats a phone number for Evolution API.
 * This is kept for local reference only — the actual formatting
 * now happens server-side inside the send-whatsapp Edge Function.
 */
export const sendEvolutionWhatsAppMessage = async (
  phone: string,
  message: string,
  config: EvolutionApiConfig,
  formatOverride?: 'format1' | 'format2' | 'format3'
): Promise<boolean> => {
  if (!config.url || !config.instanceName || !config.apiKey) {
    throw new Error('Configuración de Evolution API incompleta.');
  }

  // Use Supabase Edge Function as proxy to avoid CORS restrictions when
  // calling the Evolution API (Railway) directly from the browser.
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: {
      phone,
      message,
      evolutionUrl: config.url,
      instanceName: config.instanceName,
      apiKey: config.apiKey,
      formatOverride,
    },
  });

  if (error) {
    console.error('[Evolution API] Edge Function error:', error);
    throw new Error(error.message || 'Error enviando mensaje de WhatsApp');
  }

  if (!data?.success) {
    const errMsg = data?.error || 'Respuesta inesperada del servidor';
    console.error('[Evolution API] Server error:', errMsg);
    throw new Error(errMsg);
  }

  console.log('[Evolution API] Message sent successfully via Edge Function');
  return true;
};
