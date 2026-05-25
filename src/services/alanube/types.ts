export interface AlanubeConfig {
  api_token: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  base_url: string;
  rnc_emisor: string;
  razon_social: string;
  certificado_digital?: string | null;
  certificado_password?: string | null;
}

export interface AlanubeDocument {
  encabezado: {
    rncEmisor: string;
    rncComprador?: string;
    razonSocialEmisor: string;
    tipoDocumento: string; // 31, 32, 34
    indicadorMontoGravado: number;
    fechaEmision: string;
  };
  totales: {
    montoTotal: number;
    montoGravadoTotal: number;
    montoExentoTotal: number;
    itbisTotal: number;
    itbis18?: number;
    itbis16?: number;
  };
  detalles: AlanubeDocumentItem[];
}

export interface AlanubeDocumentItem {
  indicadorFacturacion: number;
  nombreItem: string;
  cantidad: number;
  precioUnitario: number;
  descuentoMonto: number;
  montoItem: number;
}

export interface AlanubeResponse {
  encf?: string;
  codigo_seguridad?: string;
  fecha_firma?: string;
  qrcode_url?: string;
  alanube_id?: string;
  errores?: Array<{
    codigo: string;
    mensaje: string;
  }>;
}
