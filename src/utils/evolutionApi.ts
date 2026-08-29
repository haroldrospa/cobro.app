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
  // calling the Evolution API directly from the browser.
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
      // Si la Edge Function no está disponible (404), intentar envío directo
      const is404 = error.message?.includes('404') || error.message?.includes('non-2xx') || (error as any).status === 404;
      if (is404) {
        return await sendDirectEvolutionMessage(phone, message, config);
      }
      throw new Error(error.message || 'Error enviando mensaje de WhatsApp');
    }

    if (!data?.success) {
      const errMsg = data?.error || 'Respuesta inesperada del servidor';
      throw new Error(errMsg);
    }

    return true;
  } catch (err: any) {
    if (err.message?.includes('404') || err.message?.includes('non-2xx')) {
      return await sendDirectEvolutionMessage(phone, message, config);
    }
    throw err;
  }
};

const sendDirectEvolutionMessage = async (
  phone: string,
  message: string,
  config: EvolutionApiConfig
): Promise<boolean> => {
  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('1') ? cleanPhone : `1${cleanPhone}`;
  const baseUrl = config.url.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/message/sendText/${config.instanceName}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': config.apiKey,
    },
    body: JSON.stringify({
      number: formattedPhone,
      text: message,
      delay: 1200,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Evolution API (${res.status}): ${errText || 'Instancia no disponible'}`);
  }

  return true;
};
