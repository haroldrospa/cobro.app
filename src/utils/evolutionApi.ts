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

  const sendWithFormat = async (isV1: boolean) => {
    const payload = isV1 
      ? {
          number: formattedPhone,
          textMessage: { text: message }
        }
      : {
          number: formattedPhone,
          text: message
        };

    console.log(`[Evolution API] Sending to ${endpoint} with format ${isV1 ? 'v1' : 'v2'}:`, JSON.stringify(payload, null, 2));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorData;
      const rawText = await response.text();
      try {
        errorData = JSON.parse(rawText);
      } catch (e) {
        errorData = { rawText };
      }
      console.error(`[Evolution API] Response failed with status ${response.status}. Raw body:`, rawText);
      throw { status: response.status, data: errorData };
    }
    return true;
  };

  try {
    // Try Evolution API v2 format first
    return await sendWithFormat(false);
  } catch (error: any) {
    console.warn('Evolution API v2 format failed, trying v1 format...', error);
    
    try {
      // Fallback to Evolution API v1 format
      return await sendWithFormat(true);
    } catch (fallbackError: any) {
      console.error('Error from Evolution API (both formats failed):', fallbackError);
      
      const errorData = fallbackError.data || {};
      let errorMessage = 'Error al enviar mensaje';
      if (errorData?.message) {
        errorMessage = Array.isArray(errorData.message) ? errorData.message.join(', ') : errorData.message;
      } else if (errorData?.error) {
        errorMessage = errorData.error;
      } else if (Object.keys(errorData).length > 0) {
        errorMessage = JSON.stringify(errorData);
      }
      
      throw new Error(`Evolution API (500): ${errorMessage}`);
    }
  }
};
