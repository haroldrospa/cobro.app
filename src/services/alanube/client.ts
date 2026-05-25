import { AlanubeConfig, AlanubeDocument, AlanubeResponse } from './types';

export class AlanubeClient {
  private config: AlanubeConfig;

  constructor(config: AlanubeConfig) {
    this.config = config;
  }

  /**
   * Envía un documento a la API de Alanube para generar el e-NCF.
   * @param document El documento a enviar
   * @returns La respuesta de Alanube incluyendo el e-NCF o errores
   */
  async submitDocument(document: AlanubeDocument): Promise<AlanubeResponse> {
    let url = '';
    const isBrowser = typeof window !== 'undefined';
    const isWebDeployment = isBrowser && !window.location.protocol.startsWith('file:') && !window.location.protocol.startsWith('app:');

    // Determinar el endpoint exacto según el tipo de comprobante de la DGII
    const tipoDocumento = document.encabezado?.tipoDocumento || '32';
    let path = 'invoices'; // Consumo por defecto
    if (tipoDocumento === '31') path = 'fiscal-invoices';
    else if (tipoDocumento === '32') path = 'invoices';
    else if (tipoDocumento === '34') path = 'credit-notes';
    else if (tipoDocumento === '41') path = 'purchases';
    else if (tipoDocumento === '44') path = 'special-regimes';
    else if (tipoDocumento === '45') path = 'governmental-invoices';
    else if (tipoDocumento === '46') path = 'export-supports';

    if (isBrowser && isWebDeployment) {
      // Usar los proxies seguros configurados en Vite/Vercel para evitar problemas de CORS de manera transparente
      const proxyPrefix = this.config.environment === 'PRODUCTION' ? '/api-alanube-prod' : '/api-alanube-sandbox';
      url = `${window.location.origin}${proxyPrefix}/dom/v1/${path}`;
    } else {
      // En entornos nativos (Electron / Capacitor / Node) donde CORS no es impuesto, llamar directo
      let baseUrl = this.config.base_url.trim().replace(/\/+$/, '');
      baseUrl = baseUrl.replace(/\/dom\/v1$/, '');
      baseUrl = baseUrl.replace(/\/api\/v1$/, '');
      baseUrl = baseUrl.replace(/\/+$/, '');
      url = `${baseUrl}/dom/v1/${path}`;
    }

    // Implementar logs estrictos para debugging
    if (this.config.environment === 'SANDBOX') {
      console.log('[ALANUBE SANDBOX] Request Payload:', JSON.stringify(document, null, 2));
    }

    // Sanitizar el token de autenticación para evitar duplicar el prefijo 'Bearer'
    let token = this.config.api_token.trim();
    if (token.toLowerCase().startsWith('bearer ')) {
      token = token.substring(7).trim();
    }

    try {
      // Timeout controller para expirar a los 10 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(document),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Leemos la respuesta
      const data = await response.json();

      if (this.config.environment === 'SANDBOX') {
        console.log('[ALANUBE SANDBOX] Response Payload:', JSON.stringify(data, null, 2));
      }

      if (!response.ok) {
        // HTTP 422, 400, etc. (Errores de Validación)
        let errorMessage = '';
        if (data) {
          if (data.mensaje) errorMessage = data.mensaje;
          else if (data.message) errorMessage = data.message;
          else if (data.error) {
            errorMessage = typeof data.error === 'string' ? data.error : (data.error.message || data.error.mensaje || JSON.stringify(data.error));
          } else if (data.description) errorMessage = data.description;
          else if (Array.isArray(data.errores) && data.errores.length > 0) {
            return { errores: data.errores };
          } else {
            errorMessage = JSON.stringify(data);
          }
        }
        
        if (!errorMessage) {
          errorMessage = 'Error en la validación fiscal';
        }

        return {
          errores: [{
            codigo: response.status.toString(),
            mensaje: errorMessage
          }]
        };
      }

      // Caso Exitoso (200/201)
      return {
        encf: data.encf,
        codigo_seguridad: data.codigo_seguridad || data.codigoSeguridad,
        fecha_firma: data.fecha_firma || data.fechaFirma,
        qrcode_url: data.qrcode_url || data.qrCodeUrl,
        alanube_id: data.id || data.transaccion_id
      };

    } catch (error: any) {
      // Caso Error de Infraestructura (HTTP 500 / Timeout / Caída de Red)
      if (this.config.environment === 'SANDBOX') {
        console.error('[ALANUBE SANDBOX] Connection Error:', error);
      }
      
      if (error.name === 'AbortError') {
        throw new Error('TIMEOUT');
      }
      throw new Error('CONNECTION_ERROR');
    }
  }
}
