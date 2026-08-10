import { toast } from 'sonner';

export interface SmsApiConfig {
  url?: string;
  apiKey?: string;
  senderId?: string;
}

/**
 * Envia un mensaje SMS a traves de una API de proveedor SMS local (ej. MiSMS, SMS Dominicana, Soluciones SMS, etc.)
 */
export async function sendSmsApiMessage(
  phone: string,
  message: string,
  config: SmsApiConfig
): Promise<{ success: boolean; data?: any }> {
  const apiUrl = config.url?.trim();
  const apiKey = config.apiKey?.trim();

  if (!apiUrl || !apiKey) {
    throw new Error('API de SMS no configurada. Ingresa la URL y tu API Key en los Ajustes del sistema.');
  }

  // Normalizar número de teléfono para RD / internacional (10 dígitos -> 1809...)
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = `1${cleanPhone}`;
  }

  if (!cleanPhone) {
    throw new Error('Número de teléfono inválido');
  }

  // Prepara payload estándar para proveedores SMS
  const payload = {
    apiKey: apiKey,
    api_key: apiKey,
    key: apiKey,
    token: apiKey,
    to: cleanPhone,
    phone: cleanPhone,
    mobile: cleanPhone,
    destination: cleanPhone,
    message: message,
    text: message,
    body: message,
    sender: config.senderId || 'CobroApp',
    from: config.senderId || 'CobroApp'
  };

  try {
    // Si la URL es de ClickSend (ClickSend API v3)
    if (apiUrl.includes('clicksend.com')) {
      // Normalizar número E.164 (+1809...)
      const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
      
      // Credenciales Basic Auth (Username:APIKey) o Token
      let authHeader = apiKey.trim();
      if (!authHeader.startsWith('Basic ') && !authHeader.startsWith('Bearer ')) {
        authHeader = `Basic ${btoa(authHeader)}`;
      }

      const clickSendPayload = {
        messages: [
          {
            to: formattedPhone,
            body: message,
            from: config.senderId || 'CobroApp'
          }
        ]
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(clickSendPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ClickSend Error (${response.status}): ${errorText}`);
      }

      const data = await response.json().catch(() => ({}));
      return { success: true, data };
    }

    // Si la URL contiene marcadores de posición ej. {phone} y {message}
    let finalUrl = apiUrl;
    if (finalUrl.includes('{phone}') || finalUrl.includes('{message}')) {
      finalUrl = finalUrl
        .replace('{phone}', encodeURIComponent(cleanPhone))
        .replace('{message}', encodeURIComponent(message))
        .replace('{apikey}', encodeURIComponent(apiKey))
        .replace('{key}', encodeURIComponent(apiKey));

      const response = await fetch(finalUrl, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${await response.text()}`);
      }
      const data = await response.json().catch(() => ({}));
      return { success: true, data };
    }

    // Petición POST Estándar JSON
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Respuesta de error (${response.status}): ${errorText}`);
    }

    const data = await response.json().catch(() => ({}));
    return { success: true, data };
  } catch (error: any) {
    console.error('Error al enviar SMS vía API:', error);
    throw new Error(error.message || 'Error de conexión con el proveedor de SMS.');
  }
}
