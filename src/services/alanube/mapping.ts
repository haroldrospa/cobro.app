export const ALANUBE_INVOICE_TYPES = {
  // CobroApp Internal (B01) -> Alanube DGII (31)
  CREDITO_FISCAL: '31',
  // CobroApp Internal (B02) -> Alanube DGII (32)
  CONSUMO: '32',
  // CobroApp Internal (B04) -> Alanube DGII (34)
  NOTA_CREDITO: '34',
  // Comprobante de Compras (B11 / E41) -> Alanube DGII (41)
  COMPRAS: '41',
  // Comprobante de Gastos Menores (B13 / E43)
  GASTOS_MENORES: '43',
  // Factura de Exportacion (B16)
  EXPORTACION: '46',
  // Comprobante Especiales (B14)
  REGIMENES_ESPECIALES: '44',
  // Comprobante Gubernamental (B15)
  GUBERNAMENTAL: '45',
} as const;

export type AlanubeInvoiceType = typeof ALANUBE_INVOICE_TYPES[keyof typeof ALANUBE_INVOICE_TYPES];

/**
 * Mapea el código interno del comprobante de CobroApp al código esperado por Alanube/DGII
 * para comprobantes electrónicos.
 * @param internalCode Código interno, por ejemplo "B01", "B02", "B11", "E41"
 * @returns Código electrónico, por ejemplo "32", "31", "41"
 */
export function mapInternalToAlanubeType(internalCode: string): AlanubeInvoiceType {
  const code = internalCode.toUpperCase();
  switch (code) {
    case 'B01':
    case 'E31':
      return ALANUBE_INVOICE_TYPES.CREDITO_FISCAL;
    case 'B02':
    case 'E32':
      return ALANUBE_INVOICE_TYPES.CONSUMO;
    case 'B04':
    case 'E34':
      return ALANUBE_INVOICE_TYPES.NOTA_CREDITO;
    case 'B11':
    case 'E41':
    case '41':
      return ALANUBE_INVOICE_TYPES.COMPRAS;
    case 'B13':
    case 'E43':
    case '43':
      return ALANUBE_INVOICE_TYPES.GASTOS_MENORES;
    case 'B14':
    case 'E44':
      return ALANUBE_INVOICE_TYPES.REGIMENES_ESPECIALES;
    case 'B15':
    case 'E45':
      return ALANUBE_INVOICE_TYPES.GUBERNAMENTAL;
    case 'B16':
    case 'E46':
      return ALANUBE_INVOICE_TYPES.EXPORTACION;
    default:
      // Si no hay un mapeo claro, por defecto usamos consumo
      return ALANUBE_INVOICE_TYPES.CONSUMO;
  }
}
