export interface WhatsAppApiConfig {
  provider: 'meta' | 'ultramsg' | 'evolution';
  apiUrl?: string;
  phoneNumberId?: string; // Para Meta
  token: string;          // Token / API Key
  instanceId?: string;     // Para UltraMsg / Evolution
}

/**
 * Normaliza número E.164 (ej: 18099175744)
 */
export const formatPhoneE164 = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    cleaned = `1${cleaned}`;
  }
  return cleaned;
};

/**
 * Envia mensajes de WhatsApp vía API Oficial Meta Cloud API o UltraMsg
 */
export const sendWhatsAppApiMessage = async (
  phone: string,
  message: string,
  config: WhatsAppApiConfig
): Promise<boolean> => {
  const formattedPhone = formatPhoneE164(phone);

  // 1. META WHATSAPP OFFICIAL CLOUD API
  if (config.provider === 'meta' || config.apiUrl?.includes('facebook.com') || config.apiUrl?.includes('graph.facebook')) {
    const phoneNumberId = config.phoneNumberId || config.instanceId;
    if (!phoneNumberId || !config.token) {
      throw new Error('Meta WhatsApp API requiere Phone Number ID y Access Token.');
    }

    const endpoint = config.apiUrl || `https://graph.facebook.com/v18.0/${phoneNumberId.trim()}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: message
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token.trim()}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Meta WhatsApp API Error]:', errorText);
      throw new Error(`Meta API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log('[Meta WhatsApp API Success]:', data);
    return true;
  }

  // 2. ULTRAMSG WHATSAPP API
  if (config.provider === 'ultramsg' || config.apiUrl?.includes('ultramsg.com')) {
    const instanceId = config.instanceId || config.phoneNumberId;
    if (!instanceId || !config.token) {
      throw new Error('UltraMsg API requiere Instance ID y Token.');
    }

    const baseUrl = config.apiUrl || `https://api.ultramsg.com/${instanceId.trim()}/messages/chat`;

    const payload = {
      token: config.token.trim(),
      to: formattedPhone,
      body: message
    };

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`UltraMsg Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`UltraMsg Error: ${data.error}`);
    }
    return true;
  }

  throw new Error('Proveedor de WhatsApp API no soportado.');
};
