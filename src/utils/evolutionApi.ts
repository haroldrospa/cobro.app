import { supabase } from '@/integrations/supabase/client';

export interface EvolutionApiConfig {
  url: string;
  instanceName: string;
  apiKey: string;
}

/**
 * Sends a WhatsApp message via Evolution API using the Supabase Edge Function as a secure proxy.
 * This completely avoids browser CORS restrictions and keeps credentials safe.
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

  try {
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
      throw new Error(error.message || 'Error comunicándose con el servicio de WhatsApp');
    }

    if (!data?.success) {
      const errMsg = data?.error || 'No se pudo enviar el mensaje por WhatsApp.';
      throw new Error(errMsg);
    }

    return true;
  } catch (err: any) {
    console.warn('[Evolution API Proxy]', err.message || err);
    throw err;
  }
};
