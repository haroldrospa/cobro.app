/**
 * AI Service for Groq Vision and OCR capabilities across Cobro App
 * Handles API key resolution, validation/testing, image optimization,
 * exponential backoff retry logic, and structured JSON parsing.
 */

export interface AiApiKeyTestResult {
  success: boolean;
  message: string;
  models?: string[];
  activeModel?: string;
  errorDetails?: string;
}

export interface InvoiceExpenseData {
  date: string | null;
  description: string | null;
  amount: number | null;
  supplier_name: string | null;
  invoice_number: string | null;
  category: string | null;
}

export interface InvoiceStockItem {
  name: string;
  quantity: number;
  cost: number;
  unit?: string | null;
  tax_percentage?: number;
}

export interface InvoiceStockData {
  items: InvoiceStockItem[];
  invoice_subtotal: number;
  invoice_tax: number;
  invoice_total: number;
  isTaxInclusive?: boolean;
}

/**
 * Normalizes and cleans an API key string
 */
export const cleanAiKey = (key: string | null | undefined): string | null => {
  if (!key) return null;
  const trimmed = key.trim();
  if (trimmed === 'undefined' || trimmed === 'null' || trimmed === '') return null;
  return trimmed;
};

/**
 * Resolves the active AI API key from store settings or environment variables
 */
export const resolveActiveAiApiKey = (storeSettings?: { ai_api_key?: string | null } | null): string | null => {
  const userKey = cleanAiKey(storeSettings?.ai_api_key);
  if (userKey) return userKey;

  const systemKey = cleanAiKey(import.meta.env.VITE_GROQ_API_KEY);
  if (systemKey) return systemKey;

  return null;
};

/**
 * Validates and tests a Groq API Key against Groq's official API
 */
export const testGroqApiKey = async (apiKey: string): Promise<AiApiKeyTestResult> => {
  const cleaned = cleanAiKey(apiKey);
  if (!cleaned) {
    return {
      success: false,
      message: 'La clave de API no puede estar vacía.',
      errorDetails: 'Cadena vacía o inválida'
    };
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleaned}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const models: string[] = (data.data || []).map((m: any) => m.id);
      
      const visionModels = models.filter(id => 
        id.includes('qwen') || id.includes('vision') || id.includes('llava') || id.includes('llama-3.2')
      );

      return {
        success: true,
        message: '¡Conexión exitosa! La clave de Groq es válida y está activa.',
        models: visionModels.length > 0 ? visionModels : models,
        activeModel: 'qwen/qwen3.6-27b'
      };
    }

    if (response.status === 401) {
      return {
        success: false,
        message: 'Clave de API inválida (Error 401). Verifica que la copiaste completa desde console.groq.com/keys.',
        errorDetails: 'Unauthorized (401)'
      };
    }

    if (response.status === 403) {
      return {
        success: false,
        message: 'Acceso denegado (Error 403). La clave no tiene permisos suficientes.',
        errorDetails: 'Forbidden (403)'
      };
    }

    if (response.status === 429) {
      return {
        success: false,
        message: 'Límite de peticiones alcanzado en Groq (Error 429). Espera un momento antes de reintentar.',
        errorDetails: 'Rate limit exceeded (429)'
      };
    }

    const errorText = await response.text().catch(() => '');
    return {
      success: false,
      message: `Error al verificar con Groq (${response.status}): ${errorText || response.statusText}`,
      errorDetails: `HTTP ${response.status}`
    };
  } catch (error: any) {
    console.error('Error testing Groq API Key:', error);
    return {
      success: false,
      message: 'No se pudo contactar a los servidores de Groq. Comprueba tu conexión a internet.',
      errorDetails: error?.message || 'Network Error'
    };
  }
};

/**
 * Preprocesses an image file for AI consumption:
 * 1. Converts iPhone HEIC/HEIF to JPEG
 * 2. Downscales to max width (950px) and compresses to quality 0.55 to save tokens and avoid 413/429 limits
 * 3. Returns base64 payload and MIME type
 */
export const preprocessImageForAi = async (
  file: File,
  options: { maxWidth?: number; quality?: number } = {}
): Promise<{ base64Data: string; mimeType: string; dataUrl: string }> => {
  const maxWidth = options.maxWidth || 950;
  const quality = options.quality !== undefined ? options.quality : 0.55;

  let processableFile = file;

  // Convert HEIC/HEIF to JPEG first if from iOS
  if (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  ) {
    try {
      const heic2anyModule = await import('heic2any');
      const heic2anyFn = (heic2anyModule as any).default || heic2anyModule;
      const convertedBlob = await heic2anyFn({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.6
      });

      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      processableFile = new File([blob], file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), {
        type: 'image/jpeg'
      });
    } catch (err) {
      console.error('Error converting HEIC:', err);
      throw new Error('Error al convertir imagen de iPhone (HEIC). Prueba tomando la foto de nuevo o en formato JPEG/PNG.');
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(processableFile);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width));
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const mimeType = dataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
          const base64Data = dataUrl.split(',')[1];
          resolve({ base64Data, mimeType, dataUrl });
        };
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(processableFile);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);

      if (dataUrl === 'data:,' || dataUrl.length < 100) {
        // Fallback if canvas failed
        const reader = new FileReader();
        reader.onloadend = () => {
          const fallbackDataUrl = reader.result as string;
          const mimeType = fallbackDataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
          const base64Data = fallbackDataUrl.split(',')[1];
          resolve({ base64Data, mimeType, dataUrl: fallbackDataUrl });
        };
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(processableFile);
      } else {
        const mimeType = 'image/jpeg';
        const base64Data = dataUrl.split(',')[1];
        resolve({ base64Data, mimeType, dataUrl });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const mimeType = dataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
        const base64Data = dataUrl.split(',')[1];
        resolve({ base64Data, mimeType, dataUrl });
      };
      reader.onerror = () => reject(new Error('No se pudo abrir la imagen seleccionada.'));
      reader.readAsDataURL(processableFile);
    };

    img.src = url;
  });
};

/**
 * Extracts and cleans a balanced JSON string from AI model output
 */
export const extractBalancedJson = (rawContent: string): string => {
  let content = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (content.includes('<think>')) {
    const braceIdx = content.indexOf('{');
    if (braceIdx !== -1) {
      content = content.substring(braceIdx);
    } else {
      content = content.replace(/<think>[\s\S]*/gi, '').trim();
    }
  }

  content = content.replace(/```json/gi, '').replace(/```/g, '').trim();

  const firstBrace = content.indexOf('{');
  if (firstBrace === -1) return content;

  let braceCount = 0;
  let inString = false;
  let escaped = false;

  for (let i = firstBrace; i < content.length; i++) {
    const char = content[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          return content.slice(firstBrace, i + 1);
        }
      }
    }
  }

  const match = content.match(/\{[\s\S]*\}/);
  return match ? match[0] : content;
};

/**
 * Parses JSON safely with multi-level fallbacks
 */
export const safeParseJson = <T = any>(rawJson: string): T => {
  let clean = extractBalancedJson(rawJson);
  
  // Remove trailing commas
  clean = clean.replace(/,(\s*[\]}])/g, '$1');

  try {
    return JSON.parse(clean);
  } catch (firstErr) {
    console.warn('Initial JSON parse failed, trying quote sanitization...', firstErr);
    try {
      // Fix unescaped quotes inside string values
      const sanitized = clean.replace(/:\s*"([^"]*)"/g, (match, p1) => {
        const fixed = p1.replace(/\\"/g, '"').replace(/"/g, "'");
        return `: "${fixed}"`;
      });
      return JSON.parse(sanitized);
    } catch (secondErr) {
      try {
        const singleLine = clean.replace(/[\r\n\t]+/g, ' ');
        return JSON.parse(singleLine);
      } catch (thirdErr) {
        throw new Error('La IA procesó la imagen pero la respuesta no tenía una estructura JSON válida. Por favor, reintenta con otra foto.');
      }
    }
  }
};

/**
 * Generic vision caller for Groq with exponential backoff for 429 rate limits
 */
export const executeGroqVisionPrompt = async (params: {
  file: File;
  prompt: string;
  apiKey: string;
  model?: string;
  onStatusUpdate?: (msg: string) => void;
  maxRetries?: number;
}): Promise<any> => {
  const { file, prompt, apiKey, model = 'qwen/qwen3.6-27b', onStatusUpdate, maxRetries = 5 } = params;

  const { base64Data, mimeType } = await preprocessImageForAi(file);

  let attempt = 0;

  while (attempt <= maxRetries) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
            ]
          }
        ],
        temperature: 0.1
      })
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Respuesta vacía de Groq');
      return safeParseJson(content);
    }

    const errorData = await response.json().catch(() => ({}));
    const errorMsg = JSON.stringify(errorData);

    if (response.status === 401) {
      throw new Error('Clave de Groq inválida (401). Verifica tu API Key en Configuración > Inteligencia Artificial.');
    }

    if (response.status === 429) {
      let waitMs = Math.pow(2, attempt + 1) * 4000;

      const minMatch = errorMsg.match(/try again in (?:(\d+)m)?\s*([\d\.]+)s?/i);
      if (minMatch) {
        const minutes = parseFloat(minMatch[1] || '0');
        const seconds = parseFloat(minMatch[2] || '0');
        const totalSec = (minutes * 60) + seconds;
        if (!isNaN(totalSec) && totalSec > 0) {
          waitMs = Math.ceil((totalSec + 2) * 1000);
        }
      }

      const isDailyLimit = /tokens per day|TPD|requests per day|RPD/i.test(errorMsg) || waitMs > 600000;

      if (isDailyLimit) {
        const waitMin = Math.ceil(waitMs / 60000);
        throw new Error(`Se agotó la cuota diaria gratuita de Groq. Reintenta en ~${waitMin} min o actualiza tu clave en Configuración.`);
      }

      if (attempt < maxRetries) {
        attempt++;
        const waitSec = Math.ceil(waitMs / 1000);
        onStatusUpdate?.(`Límite por minuto alcanzado (429). Esperando ${waitSec}s... (Intento ${attempt}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
    }

    throw new Error(`Error en API Groq (${response.status}): ${errorMsg}`);
  }
};

/**
 * Scan an invoice / receipt image for Accounting (expenses)
 */
export const scanInvoiceExpense = async (
  file: File,
  apiKey: string,
  onStatusUpdate?: (msg: string) => void
): Promise<InvoiceExpenseData> => {
  const prompt = `Analiza esta factura o comprobante de compra y extrae estrictamente los siguientes datos en formato JSON plano:
- date (formato YYYY-MM-DD)
- description (resumen breve del gasto o compra)
- amount (número positivo, sin símbolos de moneda)
- supplier_name (nombre comercial del proveedor o emisor)
- invoice_number (NCF, RNC o número de factura/referencia)
- category (Una de: Inventario, Servicios Públicos, Alquiler, Nómina, Mantenimiento, Marketing, Impuestos, Otros)

Si algún dato no es visible en la imagen, usa null. El JSON debe ser plano.
Ejemplo: {"date": "2024-05-15", "description": "Compra de insumos de cocina", "amount": 1250.50, "supplier_name": "Distribuidora Central", "invoice_number": "B0100000452", "category": "Inventario"}`;

  const result = await executeGroqVisionPrompt({
    file,
    prompt,
    apiKey,
    onStatusUpdate
  });

  return {
    date: result.date || null,
    description: result.description || 'Gasto registrado con IA',
    amount: result.amount ? Number(result.amount) : null,
    supplier_name: result.supplier_name || null,
    invoice_number: result.invoice_number || null,
    category: result.category || 'Inventario'
  };
};

/**
 * Scan an invoice / supply receipt image for Products (inventory/stock loading)
 */
export const scanInvoiceStock = async (
  file: File,
  apiKey: string,
  onStatusUpdate?: (msg: string) => void
): Promise<InvoiceStockData> => {
  const prompt = `Analiza esta factura de compra o suministro e identifica todos los productos comprados/abastecidos.
Extrae estrictamente un objeto JSON plano con un arreglo "items" y los totales generales de la factura.

Cada elemento de "items" debe contener:
- name (string, nombre del producto tal como aparece en la factura. Sin comillas dobles internas)
- quantity (número, cantidad de este producto)
- cost (número, costo unitario o precio de compra antes de impuestos)
- unit (string, unidad de medida: "CAJA", "PAQUETE", "UNIDAD", "UND", "KG", "LIBRA", o null)
- tax_percentage (número, porcentaje de impuesto/ITBIS aplicable: 18, 16, 0, etc.)

Totales generales de la factura:
- invoice_subtotal (número, subtotal neto sin impuestos)
- invoice_tax (número, importe total de impuestos/ITBIS)
- invoice_total (número, total neto a pagar con impuestos incluidos)

Estructura requerida:
{
  "items": [
    { "name": "Aceite Vegetal 1L", "quantity": 12, "cost": 150.0, "unit": "CAJA", "tax_percentage": 18 }
  ],
  "invoice_subtotal": 1800.0,
  "invoice_tax": 324.0,
  "invoice_total": 2124.0
}
Responde únicamente con el objeto JSON plano sin explicaciones.`;

  const parsed = await executeGroqVisionPrompt({
    file,
    prompt,
    apiKey,
    onStatusUpdate
  });

  const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
  const items: InvoiceStockItem[] = rawItems.map((item: any) => ({
    name: String(item.name || 'Producto').trim(),
    quantity: Math.max(1, Number(item.quantity) || 1),
    cost: Math.max(0, Number(item.cost) || 0),
    unit: item.unit ? String(item.unit).trim() : null,
    tax_percentage: item.tax_percentage !== undefined && item.tax_percentage !== null ? Number(item.tax_percentage) : 18
  }));

  const extractedSubtotal = Number(parsed?.invoice_subtotal || 0);
  const extractedTax = Number(parsed?.invoice_tax || 0);
  const extractedTotal = Number(parsed?.invoice_total || 0);

  let cleanSubtotal = extractedSubtotal;
  let cleanTotal = extractedTotal;

  if (cleanSubtotal > cleanTotal && cleanTotal > 0) {
    cleanSubtotal = extractedTotal;
    cleanTotal = extractedSubtotal;
  }

  const sumSubtotals = items.reduce((acc, item) => acc + (item.quantity * item.cost), 0);

  let isTaxInclusive = false;
  if (cleanTotal > 0 && cleanSubtotal > 0) {
    const diffToTotal = Math.abs(sumSubtotals - cleanTotal);
    const diffToSubtotal = Math.abs(sumSubtotals - cleanSubtotal);
    if (diffToTotal < diffToSubtotal) {
      isTaxInclusive = true;
    }
  }

  return {
    items,
    invoice_subtotal: cleanSubtotal,
    invoice_tax: extractedTax,
    invoice_total: cleanTotal,
    isTaxInclusive
  };
};
