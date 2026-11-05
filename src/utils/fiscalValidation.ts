export interface CustomerLike {
  id?: string;
  name?: string;
  rnc?: string | null;
}

export interface InvoiceTypeValidationResult {
  requiresCustomer: boolean;
  requiresRnc: boolean;
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Valida si un comprobante fiscal (electrónico e-CF o tradicional NCF)
 * requiere obligatoriamente que el cliente esté seleccionado y tenga un RNC/Cédula válido.
 * 
 * Regla fiscal DGII:
 * - Facturas electrónicas (E31, E44, E45, E46, E33, E34, etc.):
 *   NO se pueden emitir sin cliente con RNC asignado, A MENOS que sea E32 (Factura de Consumo).
 * - Facturas electrónicas de Consumo (E32):
 *   Permite Consumidor Final sin RNC, excepto si el monto total es >= RD$ 250,000.
 * - Comprobantes tradicionales (B01, B14, B15):
 *   Requieren cliente con RNC/Cédula válido.
 * - Facturas tradicionales de Consumo (B02):
 *   Permite Consumidor Final sin RNC, excepto si el monto total es >= RD$ 250,000.
 * - Facturas Internas (FAC) o Cotizaciones (COT):
 *   No requieren RNC.
 */
export function validateFiscalCustomer(
  invoiceTypeCode?: string,
  customer?: CustomerLike | null,
  totalAmount: number = 0
): InvoiceTypeValidationResult {
  if (!invoiceTypeCode) {
    return { requiresCustomer: false, requiresRnc: false, isValid: true };
  }

  const code = invoiceTypeCode.toUpperCase().trim();
  const cleanRnc = (customer?.rnc || '').replace(/[^0-9]/g, '');
  const hasValidRnc = cleanRnc.length >= 9; // RNC tiene 9 dígitos, Cédula tiene 11 dígitos
  const hasCustomer = !!customer && !!customer.id;

  // 1. Facturas internas o cotizaciones
  if (code === 'FAC' || code === 'COT') {
    return { requiresCustomer: false, requiresRnc: false, isValid: true };
  }

  // 2. Factura de Consumo Electrónica (E32)
  if (code === 'E32') {
    if (totalAmount >= 250000 && !hasValidRnc) {
      return {
        requiresCustomer: true,
        requiresRnc: true,
        isValid: false,
        errorMessage: 'Para e-CF de consumo (E32) con monto igual o superior a RD$ 250,000, la DGII exige obligatoriamente RNC o Cédula del comprador.'
      };
    }
    return { requiresCustomer: false, requiresRnc: false, isValid: true };
  }

  // 3. Factura de Consumo Tradicional (B02)
  if (code === 'B02') {
    if (totalAmount >= 250000 && !hasValidRnc) {
      return {
        requiresCustomer: true,
        requiresRnc: true,
        isValid: false,
        errorMessage: 'Para facturas de consumo (B02) con monto igual o superior a RD$ 250,000, la DGII exige obligatoriamente RNC o Cédula del comprador.'
      };
    }
    return { requiresCustomer: false, requiresRnc: false, isValid: true };
  }

  // 4. Facturas electrónicas e-CF (E31, E44, E45, E46, E33, E34, etc.)
  // Todas excepto E32 exigen cliente con RNC/Cédula asignado
  if (code.startsWith('E')) {
    if (!hasCustomer || !hasValidRnc) {
      let typeLabel = `comprobante electrónico (${code})`;
      if (code === 'E31') typeLabel = 'Crédito Fiscal Electrónico (E31)';
      else if (code === 'E44') typeLabel = 'Regímenes Especiales Electrónico (E44)';
      else if (code === 'E45') typeLabel = 'Gubernamental Electrónico (E45)';
      else if (code === 'E46') typeLabel = 'Exportación Electrónica (E46)';

      return {
        requiresCustomer: true,
        requiresRnc: true,
        isValid: false,
        errorMessage: `El comprobante ${typeLabel} requiere obligatoriamente seleccionar un cliente con RNC o Cédula válido. No se puede emitir una factura electrónica sin cliente asignado (solo E32 lo permite).`
      };
    }
    return { requiresCustomer: true, requiresRnc: true, isValid: true };
  }

  // 5. Comprobantes fiscales tradicionales NCF (B01, B14, B15)
  if (code === 'B01' || code === 'B14' || code === 'B15') {
    if (!hasCustomer || !hasValidRnc) {
      const typeLabel = code === 'B01' ? 'Crédito Fiscal (B01)' : code === 'B14' ? 'Regímenes Especiales (B14)' : 'Gubernamental (B15)';
      return {
        requiresCustomer: true,
        requiresRnc: true,
        isValid: false,
        errorMessage: `El comprobante ${typeLabel} requiere obligatoriamente seleccionar un cliente con RNC o Cédula válido.`
      };
    }
    return { requiresCustomer: true, requiresRnc: true, isValid: true };
  }

  return { requiresCustomer: false, requiresRnc: false, isValid: true };
}
