import { supabase } from '@/integrations/supabase/client';
import { AlanubeClient } from './client';
import { mapInternalToAlanubeType } from './mapping';
import { AlanubeConfig, AlanubeDocument, AlanubeDocumentItem } from './types';

export class AlanubeService {
  private static configCache = new Map<string, { config: AlanubeConfig; timestamp: number }>();
  private static inFlightEmissions = new Map<string, Promise<boolean>>();

  private static notifySignatureUpdate(detail: {
    saleId: string;
    estado_fiscal: 'ACEPTADO' | 'RECHAZADO' | 'ERROR_CONEXION';
    encf?: string;
    codigo_seguridad?: string;
    fecha_firma?: string;
    qrcode_url?: string;
    alanube_id?: string;
  }) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alanube-signature-update', { detail }));
    }
  }

  private static parseSignatureDates(rawDate?: string): { isoDate: string; dgiiFormatted: string } {
    const now = new Date();
    const formatDgii = (d: Date) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
    };

    if (rawDate && typeof rawDate === 'string') {
      // Caso 1: Formato DGII DD-MM-YYYY HH:MM:SS o DD-MM-YYYY
      const dmyMatch = rawDate.trim().match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
      if (dmyMatch) {
        const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = dmyMatch;
        const parsed = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}Z`);
        const isoDate = !isNaN(parsed.getTime()) ? parsed.toISOString() : now.toISOString();
        return {
          isoDate,
          dgiiFormatted: `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`
        };
      }

      // Caso 2: Formato ISO 8601 (YYYY-MM-DD...)
      const parsedIso = new Date(rawDate);
      if (!isNaN(parsedIso.getTime())) {
        return {
          isoDate: parsedIso.toISOString(),
          dgiiFormatted: formatDgii(parsedIso)
        };
      }
    }

    return {
      isoDate: now.toISOString(),
      dgiiFormatted: formatDgii(now)
    };
  }

  /**
   * Obtiene la configuración de Alanube para una tienda específica (con caché en memoria de 2 min)
   */
  static async getConfig(storeId: string): Promise<AlanubeConfig | null> {
    const cached = this.configCache.get(storeId);
    if (cached && Date.now() - cached.timestamp < 120000) {
      return cached.config;
    }

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

    const resolvedConfig: AlanubeConfig = {
      api_token: data.api_token,
      environment: environment as 'SANDBOX' | 'PRODUCTION',
      base_url: environment === 'PRODUCTION' ? 'https://api.alanube.co' : data.base_url,
      rnc_emisor: rncEmisor,
      razon_social: razonSocial,
      company_id: (data as any).company_id || localCompanyId || '01M0TYPKJ0JGVM53K56D7X9P7Z'
    };

    this.configCache.set(storeId, { config: resolvedConfig, timestamp: Date.now() });
    return resolvedConfig;
  }

  /**
   * Procesa la emisión electrónica de una factura existente (deduplicando llamadas concurrentes)
   */
  static async emitirFacturaElectronica(saleId: string, silent: boolean = false): Promise<boolean> {
    const existingPromise = this.inFlightEmissions.get(saleId);
    if (existingPromise) {
      return existingPromise;
    }

    const emissionPromise = this._executeEmision(saleId, silent).finally(() => {
      this.inFlightEmissions.delete(saleId);
    });

    this.inFlightEmissions.set(saleId, emissionPromise);
    return emissionPromise;
  }

  private static async _executeEmision(saleId: string, silent: boolean = false): Promise<boolean> {
    try {
      // 1. Obtener la factura, sus items y el cliente (con fallback si invoice_types no tiene FK directa)
      let sale: any = null;
      const { data: saleWithType, error: saleError } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items (*, product:products(name, internal_code)),
          customer:customers(*),
          invoice_type:invoice_types(*)
        `)
        .eq('id', saleId)
        .maybeSingle();

      if (saleWithType) {
        sale = saleWithType;
      } else {
        const { data: saleBasic, error: basicErr } = await supabase
          .from('sales')
          .select(`
            *,
            sale_items (*, product:products(name)),
            customer:customers(*)
          `)
          .eq('id', saleId)
          .single();
        if (basicErr || !saleBasic) {
          throw new Error('Factura no encontrada');
        }
        sale = saleBasic;
      }

      if (!sale.store_id) {
        throw new Error('Factura no tiene tienda asociada');
      }

      // Si ya fue aceptada previamente y tiene QR, notificar de inmediato sin reenviar
      if (sale.estado_fiscal === 'ACEPTADO' && sale.qrcode_url) {
        this.notifySignatureUpdate({
          saleId,
          estado_fiscal: 'ACEPTADO',
          encf: sale.encf || sale.invoice_number,
          codigo_seguridad: sale.codigo_seguridad,
          fecha_firma: sale.fecha_firma,
          qrcode_url: sale.qrcode_url,
          alanube_id: sale.alanube_id
        });
        return true;
      }

      // 2. Obtener la configuración (desde caché en memoria si está disponible)
      const config = await this.getConfig(sale.store_id);
      if (!config) {
        throw new Error('Configuración de Alanube no encontrada o inactiva');
      }

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
          this.notifySignatureUpdate({
            saleId,
            estado_fiscal: 'RECHAZADO'
          });

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
        const { isoDate, dgiiFormatted } = this.parseSignatureDates(response.fecha_firma);
        const finalEncf = response.encf || normalizedEncf;
        const finalSecCode = response.codigo_seguridad || '';

        // Construct standard DGII verification URL if missing
        const qrUrl = response.qrcode_url || (response as any).qrCodeUrl || `https://ecf.dgii.gov.do/EstadoseCF/ConsultaeCF?RncEmisor=${emisorRnc}&RncComprador=${receptorRnc}&ENCF=${finalEncf}&MontoTotal=${totalAmount}&CodigoSeguridad=${finalSecCode}&FechaFirma=${encodeURIComponent(dgiiFormatted)}`;

        // Notificar de inmediato a la UI en memoria (0ms de espera para PrintOptionsDialog)
        this.notifySignatureUpdate({
          saleId,
          estado_fiscal: 'ACEPTADO',
          encf: finalEncf,
          codigo_seguridad: finalSecCode,
          fecha_firma: isoDate,
          qrcode_url: qrUrl,
          alanube_id: response.alanube_id
        });

        const { error: updateErr } = await supabase
          .from('sales')
          .update({
            is_electronic: true,
            estado_fiscal: 'ACEPTADO',
            encf: finalEncf,
            codigo_seguridad: finalSecCode || null,
            fecha_firma: isoDate,
            qrcode_url: qrUrl,
            alanube_id: response.alanube_id || null
          })
          .eq('id', saleId);

        if (updateErr) {
          console.warn('[Alanube] Fallback update on sales due to column/format issue:', updateErr);
          await supabase
            .from('sales')
            .update({
              estado_fiscal: 'ACEPTADO',
              qrcode_url: qrUrl,
              codigo_seguridad: finalSecCode || null
            })
            .eq('id', saleId);
        }

        return true;

      } catch (error: any) {
        this.notifySignatureUpdate({
          saleId,
          estado_fiscal: 'ERROR_CONEXION'
        });

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
