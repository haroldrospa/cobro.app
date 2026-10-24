import { supabase } from '@/integrations/supabase/client';
import { AlanubeClient } from './client';
import { mapInternalToAlanubeType } from './mapping';
import { AlanubeConfig, AlanubeDocument, AlanubeDocumentItem } from './types';

export class AlanubeService {
  /**
   * Obtiene la configuración de Alanube para una tienda específica
   */
  static async getConfig(storeId: string): Promise<AlanubeConfig | null> {
    const { data, error } = await supabase
      .from('alanube_config')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    let localCompanyId = typeof window !== 'undefined' ? localStorage.getItem('alanube_company_id') : null;
    if (localCompanyId === '01M0TYPKJGJVM53K56D7X9P7Z' || !localCompanyId) {
      localCompanyId = '01M0TYPKJ0JGVM53K56D7X9P7Z';
    }

    const localRnc = typeof window !== 'undefined' ? localStorage.getItem('alanube_rnc_emisor') : null;
    const localRazonSocial = typeof window !== 'undefined' ? localStorage.getItem('alanube_razon_social') : null;
    const localEnv = typeof window !== 'undefined' ? localStorage.getItem('alanube_environment') : null;

    // Si en base de datos aún tiene Romar Group o RNC viejo, priorizar el actualizado de Harold
    const rncEmisor = localRnc || (data.rnc_emisor && data.rnc_emisor !== '133280824' ? data.rnc_emisor : '40218246656');
    const razonSocial = localRazonSocial || (data.razon_social && data.razon_social !== 'Romar Group' ? data.razon_social : 'Harold Rosado Pacheco');
    const environment = (localEnv as any) || (data.environment === 'SANDBOX' ? 'PRODUCTION' : data.environment);

    return {
      api_token: data.api_token,
      environment: environment as 'SANDBOX' | 'PRODUCTION',
      base_url: environment === 'PRODUCTION' ? 'https://api.alanube.co' : data.base_url,
      rnc_emisor: rncEmisor,
      razon_social: razonSocial,
      company_id: (data as any).company_id || localCompanyId || '01M0TYPKJ0JGVM53K56D7X9P7Z'
    };
  }

  /**
   * Procesa la emisión electrónica de una factura existente
   */
  static async emitirFacturaElectronica(saleId: string, silent: boolean = false): Promise<boolean> {
    try {
      // 1. Obtener la factura, sus items y el cliente
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items (*, product:products(name, internal_code)),
          customer:customers(*),
          invoice_type:invoice_types(*)
        `)
        .eq('id', saleId)
        .single();

      if (saleError || !sale) {
        throw new Error('Factura no encontrada');
      }

      if (!sale.store_id) {
        throw new Error('Factura no tiene tienda asociada');
      }

      // 2. Obtener la configuración
      const config = await this.getConfig(sale.store_id);
      if (!config) {
        throw new Error('Configuración de Alanube no encontrada o inactiva');
      }

      // 3. Marcar localmente como PENDIENTE
      await supabase
        .from('sales')
        .update({
          is_electronic: true,
          estado_fiscal: 'PENDIENTE'
        })
        .eq('id', saleId);

      // 4. Construir el payload estricto según OpenAPI 3.0.3 de Alanube DOM v1
      // Nota: invoice_type_id a veces es un string simple o el id de la relacion
      const internalCode = sale.invoice_type?.code || sale.invoice_type_id || 'B02';
      const alanubeType = mapInternalToAlanubeType(internalCode as string);

      // Normalizar e-NCF a 13 caracteres exactos (Ej: E320000000001)
      const rawNumMatch = (sale.invoice_number || '').match(/(\d+)$/);
      const seqDigits = rawNumMatch ? rawNumMatch[1] : '1';
      const normalizedEncf = `E${alanubeType}${seqDigits.padStart(10, '0').slice(-10)}`;

      // Desglose de impuestos por tasa (18%, 16%, Exento)
      let i1AmountTaxed = 0;
      let i2AmountTaxed = 0;
      let exemptAmount = 0;

      // Mapear formas de pago a códigos autorizados por la DGII:
      // 1: Efectivo, 2: Cheque/Transferencia/Depósito, 3: Tarjeta de Débito/Crédito, 4: Venta a Crédito
      const mapPaymentMethod = (method: string): number => {
        switch (method) {
          case 'cash': return 1;
          case 'transfer': return 2;
          case 'card': return 3;
          case 'credit': return 4;
          default: return 1;
        }
      };

      const itemDetails: any[] = (sale.sale_items as any[]).map((item, index) => {
        const quantity = Number(item.quantity) || 1;
        const taxAmount = Number(item.tax_amount) || 0;
        const roundedTaxPercentage = Math.round(Number(item.tax_percentage) || 0);

        // Monto neto de la línea sin ITBIS (taxAmountIndicator = 0)
        const lineTotalWithTax = Number(item.total) || 0;
        const netLineAmount = Math.max(0, lineTotalWithTax - taxAmount);
        const unitPriceNet = Number((netLineAmount / quantity).toFixed(4));
        const itemAmount = Number((unitPriceNet * quantity).toFixed(2));

        // Indicador de facturación DGII: 1 = ITBIS 18%, 2 = ITBIS 16%, 4 = Exento (E)
        let billingIndicator = 4;
        if (taxAmount > 0 && roundedTaxPercentage > 0) {
          billingIndicator = roundedTaxPercentage === 16 ? 2 : 1;
        }

        if (billingIndicator === 1) {
          i1AmountTaxed = Number((i1AmountTaxed + itemAmount).toFixed(2));
        } else if (billingIndicator === 2) {
          i2AmountTaxed = Number((i2AmountTaxed + itemAmount).toFixed(2));
        } else {
          exemptAmount = Number((exemptAmount + itemAmount).toFixed(2));
        }

        return {
          lineNumber: index + 1,
          billingIndicator,
          itemName: (item.product?.name || 'Producto General').slice(0, 80),
          goodServiceIndicator: 1, // 1 = Bien, 2 = Servicio
          quantityItem: Number(quantity.toFixed(2)),
          unitPriceItem: unitPriceNet,
          itemAmount
        };
      });

      const totalTaxedAmount = Number((i1AmountTaxed + i2AmountTaxed).toFixed(2));
      const itbis1Total = Number((i1AmountTaxed * 0.18).toFixed(2));
      const itbis2Total = Number((i2AmountTaxed * 0.16).toFixed(2));
      const itbisTotal = Number((itbis1Total + itbis2Total).toFixed(2));
      const totalAmount = Number((totalTaxedAmount + exemptAmount + itbisTotal).toFixed(2));

      const totals: Record<string, any> = {
        totalAmount
      };
      if (totalTaxedAmount > 0) {
        totals.totalTaxedAmount = totalTaxedAmount;
        totals.itbisTotal = itbisTotal;
      }
      if (i1AmountTaxed > 0) {
        totals.i1AmountTaxed = i1AmountTaxed;
        totals.itbisS1 = 18;
        totals.itbis1Total = itbis1Total;
      }
      if (i2AmountTaxed > 0) {
        totals.i2AmountTaxed = i2AmountTaxed;
        totals.itbisS2 = 16;
        totals.itbis2Total = itbis2Total;
      }
      if (exemptAmount > 0) {
        totals.exemptAmount = exemptAmount;
      }

      const effectivePaymentMethod = sale.payment_method === 'split'
        ? (sale.split_method || 'cash')
        : (sale.payment_method || 'cash');

      const idDoc: Record<string, any> = {
        encf: normalizedEncf,
        incomeType: 1,
        paymentType: sale.payment_method === 'credit' ? 2 : 1,
        ...(totalTaxedAmount > 0 ? { taxAmountIndicator: 0 } : {}),
        ...(alanubeType !== '32' ? { sequenceDueDate: '2028-12-31' } : {}),
        ...(sale.payment_method === 'credit' ? {
          paymentDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        } : {}),
        paymentFormsTable: [
          {
            paymentMethod: mapPaymentMethod(effectivePaymentMethod),
            paymentAmount: totalAmount
          }
        ]
      };

      const document: any = {
        company: {
          id: config.company_id || '01M0TYPKJ0JGVM53K56D7X9P7Z'
        },
        idDoc,
        sender: {
          rnc: config.rnc_emisor.replace(/[^0-9]/g, ''),
          companyName: config.razon_social,
          address: 'Santo Domingo',
          province: '010000',
          municipality: '010100',
          stampDate: new Date().toISOString().split('T')[0] // YYYY-MM-DD
        },
        totals,
        itemDetails
      };

      // Manejo de RNC de Comprador
      if (sale.customer?.rnc) {
        const cleanRNC = sale.customer.rnc.replace(/[^0-9]/g, '');
        if (cleanRNC) {
          document.buyer = {
            rnc: cleanRNC,
            companyName: (sale.customer.name || 'Cliente General').slice(0, 150)
          };
        }
      } else if (alanubeType === '31') {
        throw new Error('El RNC del comprador es obligatorio para e-Crédito Fiscal');
      }

      // 5. Enviar a Alanube
      const client = new AlanubeClient(config);
      try {
        const response = await client.submitDocument(document, alanubeType);

        if (response.errores && response.errores.length > 0) {
          // Caso Error de Validación Fiscal
          await supabase
            .from('sales')
            .update({
              estado_fiscal: 'RECHAZADO'
            })
            .eq('id', saleId);

          console.error('[Alanube] Error de validación fiscal:', response.errores);

          // Mostrar al usuario el motivo del rechazo fiscal (DGII) en un Toast descriptivo
          const errorMsg = response.errores.map(e => `${e.codigo ? `[${e.codigo}] ` : ''}${e.mensaje}`).join('\n');
          if (true) { /* Mostrar error para visibilidad */
            import('@/hooks/use-toast').then(({ toast }) => {
              toast({
                title: "Error de Validación Fiscal (DGII)",
                description: errorMsg || "El comprobante fue rechazado por la DGII. Por favor, verifique la configuración de emisor y cliente.",
                variant: "destructive",
                duration: 12000
              });
            });
          }

          return false;
        }

        // Caso Exitoso
        const emisorRnc = config.rnc_emisor.replace(/[^0-9]/g, '');
        const receptorRnc = sale.customer?.rnc ? sale.customer.rnc.replace(/[^0-9]/g, '') : '';
        const rawDate = response.fecha_firma || new Date().toISOString();
        let formattedDate = rawDate;
        try {
          const d = new Date(rawDate);
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          const hours = String(d.getHours()).padStart(2, '0');
          const minutes = String(d.getMinutes()).padStart(2, '0');
          const seconds = String(d.getSeconds()).padStart(2, '0');
          formattedDate = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
        } catch (_) {}

        // Construct standard DGII verification URL if missing
        const qrUrl = response.qrcode_url || response.qrCodeUrl || `https://ecf.dgii.gov.do/EstadoseCF/ConsultaeCF?RncEmisor=${emisorRnc}&RncComprador=${receptorRnc}&ENCF=${response.encf}&MontoTotal=${sale.total}&CodigoSeguridad=${response.codigo_seguridad}&FechaFirma=${encodeURIComponent(formattedDate)}`;

        await supabase
          .from('sales')
          .update({
            estado_fiscal: 'ACEPTADO',
            encf: response.encf,
            codigo_seguridad: response.codigo_seguridad,
            fecha_firma: response.fecha_firma || new Date().toISOString(),
            qrcode_url: qrUrl,
            alanube_id: response.alanube_id
          })
          .eq('id', saleId);

        return true;

      } catch (error: any) {
        // Caso Error de Infraestructura
        await supabase
          .from('sales')
          .update({
            estado_fiscal: 'ERROR_CONEXION'
          })
          .eq('id', saleId);
          
        const errorMessage = error?.message || 'Error de conexión con Alanube';
        console.error('[Alanube] Connection/Infrastructure Error:', error);
        
        if (true) { /* Mostrar error para visibilidad */
          import('@/hooks/use-toast').then(({ toast }) => {
            toast({
              title: "Error de Conexión Fiscal",
              description: `No se pudo conectar con el servidor de facturación electrónica. Detalle: ${errorMessage}. La venta se guardó localmente y se sincronizará automáticamente al restablecer el servicio.`,
              variant: "destructive",
              duration: 10000
            });
          });
        }
          
        return false;
      }
    } catch (err: any) {
      console.error('[Alanube] Error general emitiendo factura:', err);
      const generalMessage = err?.message || 'Error general en el módulo e-NCF';
      if (true) { /* Mostrar error para visibilidad */
        import('@/hooks/use-toast').then(({ toast }) => {
          toast({
            title: "Error General de Facturación Electrónica",
            description: generalMessage,
            variant: "destructive",
            duration: 8000
          });
        });
      }
      return false;
    }
  }
}
