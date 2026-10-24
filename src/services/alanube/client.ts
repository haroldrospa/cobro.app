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

    const companyId = this.config.company_id || (typeof window !== 'undefined' ? localStorage.getItem('alanube_company_id') : null) || '01M0TYPKJGJVM53K56D7X9P7Z';

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

    // Agregar idCompany en query param si está disponible (esencial para cuentas Reseller)
    if (companyId) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}idCompany=${encodeURIComponent(companyId)}`;
    }

    // Inyectar idCompany en el payload si está disponible
    if (companyId) {
      (document as any).idCompany = companyId;
      if (document.sender) {
        (document.sender as any).idCompany = companyId;
      }
    }

    // Implementar logs estrictos para debugging
    if (this.config.environment === 'SANDBOX' || (typeof window !== 'undefined' && window.location.hostname === 'localhost')) {
      console.log('[ALANUBE] Request URL:', url);
      console.log('[ALANUBE] Request Payload:', JSON.stringify(document, null, 2));
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

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      if (companyId) {
        requestHeaders['idCompany'] = companyId;
        requestHeaders['id-company'] = companyId;
        requestHeaders['x-company-id'] = companyId;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
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

  /**
   * Verifica la conectividad y si la empresa está de alta en Alanube y DGII
   */
  async testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
    const isBrowser = typeof window !== 'undefined';
    const isWebDeployment = isBrowser && !window.location.protocol.startsWith('file:') && !window.location.protocol.startsWith('app:');
    const proxyPrefix = this.config.environment === 'PRODUCTION' ? '/api-alanube-prod' : '/api-alanube-sandbox';
    
    const companyId = this.config.company_id || (typeof window !== 'undefined' ? localStorage.getItem('alanube_company_id') : null) || '01M0TYPKJGJVM53K56D7X9P7Z';
    const path = `check-directory/idCompany/${companyId}`;
    
    let url = isBrowser && isWebDeployment 
      ? `${window.location.origin}${proxyPrefix}/dom/v1/${path}`
      : `${this.config.base_url.trim().replace(/\/+$/, '')}/dom/v1/${path}`;

    let token = this.config.api_token.trim();
    if (token.toLowerCase().startsWith('bearer ')) {
      token = token.substring(7).trim();
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...(companyId ? { 'idCompany': companyId, 'id-company': companyId } : {})
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const resData = await response.json();
      if (response.ok) {
        return { success: true, message: 'Empresa verificada y activa en Alanube', data: resData };
      } else {
        const errorMsg = resData?.message || resData?.mensaje || `Error HTTP ${response.status}`;
        return { success: false, message: errorMsg, data: resData };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, message: 'Tiempo de espera agotado al conectar con Alanube.' };
      }
      return { success: false, message: err?.message || 'Error de conexión con Alanube' };
    }
  }
}
