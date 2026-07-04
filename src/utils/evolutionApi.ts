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
  
  return `${cleaned}@s.whatsapp.net`;
};

export const sendEvolutionWhatsAppMessage = async (
  phone: string,
  message: string,
  config: EvolutionApiConfig
): Promise<boolean> => {
  if (!config.url || !config.instanceName || !config.apiKey) {
    throw new Error('Configuración de Evolution API incompleta.');
  }

  const formattedPhone = formatPhoneNumber(phone);
  
  // Clean URL (remove trailing slash and ensure protocol)
  let baseUrl = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;
  if (!/^https?:\/\//i.test(baseUrl)) {
    baseUrl = `https://${baseUrl}`;
  }
  const endpoint = `${baseUrl}/message/sendText/${config.instanceName}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message, // For Evolution API v2
        textMessage: {
          text: message // For Evolution API v1
        },
        options: {
          delay: 1200,
          presence: "composing",
          linkPreview: false
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error from Evolution API:', errorData);
      
      let errorMessage = 'Error al enviar mensaje';
      if (errorData?.message) {
        errorMessage = Array.isArray(errorData.message) ? errorData.message.join(', ') : errorData.message;
      } else if (errorData?.error) {
        errorMessage = errorData.error;
      }
      
      throw new Error(`API Error (${response.status}): ${errorMessage}`);
    }

    return true;
  } catch (error) {
    console.error('Evolution API Request failed:', error);
    throw error;
  }
};
