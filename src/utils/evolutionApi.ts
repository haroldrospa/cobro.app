export interface EvolutionApiConfig {
  url: string;
  instanceName: string;
  apiKey: string;
}

/**
 * Formats a phone number for Evolution API (needs to end with @s.whatsapp.net)
 * Examples:
 * +1 809 123 4567 -> 18091234567@s.whatsapp.net
 * 809-123-4567 -> 18091234567@s.whatsapp.net (Assumes Dominican Republic +1 if not provided)
 */
const formatPhoneNumber = (phone: string): string => {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If the number is 10 digits (e.g. 8091234567), assume DR and prepend 1
  if (cleaned.length === 10) {
    cleaned = `1${cleaned}`;
  }
  
  return cleaned;
};

export const sendEvolutionWhatsAppMessage = async (
  phone: string,
  message: string,
  config: EvolutionApiConfig,
  formatOverride?: 'format1' | 'format2' | 'format3'
): Promise<boolean> => {
  if (!config.url || !config.instanceName || !config.apiKey) {
    throw new Error('Configuración de Evolution API incompleta.');
  }

  let formattedPhone = formatPhoneNumber(phone);
  if (formatOverride === 'format2') {
    formattedPhone = `${formattedPhone}@s.whatsapp.net`;
  } else if (formatOverride === 'format3') {
    // Return original phone cleaned without prepending 1
    formattedPhone = phone.replace(/\D/g, '');
  }
  
  // Clean URL (remove trailing slash and ensure protocol)
  let baseUrl = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;
  if (!/^https?:\/\//i.test(baseUrl)) {
    baseUrl = `https://${baseUrl}`;
  }
  const endpoint = `${baseUrl}/message/sendText/${config.instanceName}`;

  try {
    // Híbrido: v1 usa textMessage.text, v2 usa text.
    // Enviamos ambos para que funcione sin importar qué versión de Evolution API esté usando.
    const payload = {
      number: formattedPhone,
      options: {
        delay: 1200,
        linkPreview: false
      },
      textMessage: {
        text: message
      },
      text: message
    };

    console.log(`[Evolution API] Sending to ${endpoint}:`, JSON.stringify(payload, null, 2));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Evolution API] Response failed with status ${response.status}. Raw body:`, errorText);
      throw new Error(`Evolution API (${response.status}): ${errorText.slice(0, 100)}`);
    }

    return true;
  } catch (error: any) {
    console.error('[Evolution API] General Error:', error);
    throw error;
  }
};
