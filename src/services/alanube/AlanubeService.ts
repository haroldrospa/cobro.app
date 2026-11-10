import { supabase } from '@/integrations/supabase/client';
import { AlanubeClient } from './client';
import { mapInternalToAlanubeType } from './mapping';
import { AlanubeConfig, AlanubeDocument, AlanubeDocumentItem } from './types';

export class AlanubeService {
  private static configCache = new Map<string, { config: AlanubeConfig; timestamp: number }>();
  private static inFlightEmissions = new Map<string, Promise<boolean>>();
  private static latestSignatures = new Map<string, any>();
  private static lastErrors = new Map<string, string>();

  static getLatestSignature(saleId: string) {
    return this.latestSignatures.get(saleId);
  }

  static getLastError(saleId: string): string | undefined {
    return this.lastErrors.get(saleId);
  }

  private static notifySignatureUpdate(detail: {
    saleId: string;
    estado_fiscal: 'ACEPTADO' | 'RECHAZADO' | 'ERROR_CONEXION';
    encf?: string;
    invoice_number?: string;
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

    let localCompanyId = typeof window !== 'undefined' ? (localStorage.getItem('alanube_company_id') || '').trim() : '';
    const localRnc = typeof window !== 'undefined' ? (localStorage.getItem('alanube_rnc_emisor') || '').trim() : '';
    const localRazonSocial = typeof window !== 'undefined' ? (localStorage.getItem('alanube_razon_social') || '').trim() : '';
    const localEnv = typeof window !== 'undefined' ? localStorage.getItem('alanube_environment') : null;
    const localSequenceDueDate = typeof window !== 'undefined' ? (localStorage.getItem('alanube_sequence_due_date') || '').trim() : '';

    let token = data.api_token ? data.api_token.trim() : '';
    if (!token) {
      try {
        const { data: masterRow } = await supabase
          .from('admin_global_settings')
          .select('value')
          .eq('id', 'alanube_master_token')
          .maybeSingle();
        if (masterRow?.value) {
          token = masterRow.value.trim();
        }
      } catch (errMaster) {
        console.warn('[AlanubeService] Error fetching master token:', errMaster);
      }
    }

    const rncEmisor = (data.rnc_emisor || localRnc || '').trim();
    const razonSocial = (data.razon_social || localRazonSocial || '').trim();
    const environment = (localEnv as any) || (data.environment === 'SANDBOX' ? 'SANDBOX' : 'PRODUCTION');
    const sequenceDueDate = ((data as any)?.sequence_due_date || localSequenceDueDate || '').trim();
    const companyId = ((data as any)?.company_id || localCompanyId || '').trim();

    const resolvedConfig: AlanubeConfig = {
      api_token: token,
      environment: environment as 'SANDBOX' | 'PRODUCTION',
      base_url: environment === 'PRODUCTION' ? 'https://api.alanube.co' : (data.base_url || 'https://api.alanube.co'),
      rnc_emisor: rncEmisor,
      razon_social: razonSocial,
      company_id: companyId,
      sequence_due_date: sequenceDueDate
    };

    this.configCache.set(storeId, { config: resolvedConfig, timestamp: Date.now() });
    return resolvedConfig;
  }

  /**
   * Obtiene el conteo de comprobantes emitidos en Alanube / DGII por tipo (B01..B16)
   */
  static async getEmittedCounts(storeId: string): Promise<Record<string, number>> {
    try {
      const config = await this.getConfig(storeId);
      if (!config || !config.api_token) return {};
      const client = new AlanubeClient(config);
      return await client.getEmittedDocumentsSummary();
    } catch (err) {
      console.warn('[Alanube] Error obteniendo conteo de emitidos:', err);
      return {};
    }
  }

  /**
   * Procesa la emisión electrónica de una factura existente (deduplicando llamadas concurrentes)
   */
  static async emitirFacturaElectronica(saleId: string, silent: boolean = false, initialSaleData?: any): Promise<boolean> {
    const existingPromise = this.inFlightEmissions.get(saleId);
    if (existingPromise) {
      return existingPromise;
    }

    const emissionPromise = this._executeEmision(saleId, silent, initialSaleData).finally(() => {
      this.inFlightEmissions.delete(saleId);
    });

    this.inFlightEmissions.set(saleId, emissionPromise);
    return emissionPromise;
  }

  private static async _executeEmision(saleId: string, silent: boolean = false, initialSaleData?: any): Promise<boolean> {
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
          if (initialSaleData) {
            sale = initialSaleData;
          } else {
            throw new Error('Factura no encontrada');
          }
        } else {
          sale = saleBasic;
        }
      }

      if (initialSaleData && sale) {
        sale = {
          ...sale,
          ...initialSaleData,
          customer: sale.customer || initialSaleData.customer,
          customer_name: sale.customer_name || initialSaleData.customer_name,
          customer_rnc: sale.customer_rnc || initialSaleData.customer_rnc,
        };
      }

      const storeId = sale.store_id || initialSaleData?.store_id;
      if (!storeId) {
        throw new Error('Factura no tiene tienda asociada');
      }
      sale.store_id = storeId;

      // Si no tiene sale_items en DB (ej: servicios emitidos sin producto de inventario), recuperar desde initialSaleData o offlineDB
      if (!sale.sale_items || sale.sale_items.length === 0) {
        if (initialSaleData?.items?.length > 0 || initialSaleData?.sale_items?.length > 0) {
          const rawList = initialSaleData.items || initialSaleData.sale_items || [];
          sale.sale_items = rawList.map((it: any) => ({
            product: { name: it.name || it.product_name || it.description || 'Servicio' },
            product_name: it.name || it.product_name || it.description,
            name: it.name || it.product_name || it.description,
            description: it.description || it.name,
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.price ?? it.unit_price ?? 0),
            price: Number(it.price ?? it.unit_price ?? 0),
            total: Number(it.total ?? ((it.quantity || 1) * (it.price ?? it.unit_price ?? 0))),
            tax_amount: Number(it.tax_amount ?? 0),
            tax: it.tax,
            tax_percentage: Number(it.tax_percentage ?? ((it.tax || 0.18) * 100)),
            cost_includes_tax: it.cost_includes_tax,
            is_service: true,
          }));
        } else {
          try {
            const { offlineDB, OfflineStore } = await import('@/lib/offlineDB');
            const localSale = await offlineDB.get<any>(OfflineStore.SALES, saleId);
            if (localSale && (localSale.items?.length > 0 || localSale.sale_items?.length > 0)) {
              const fallbackItems = localSale.items || localSale.sale_items || [];
              sale.sale_items = fallbackItems.map((it: any) => ({
                product: { name: it.name || it.product_name || it.description || 'Servicio' },
                product_name: it.name || it.product_name || it.description,
                name: it.name || it.product_name || it.description,
                description: it.description || it.name,
                quantity: Number(it.quantity) || 1,
                unit_price: Number(it.price ?? it.unit_price ?? 0),
                price: Number(it.price ?? it.unit_price ?? 0),
                total: Number(it.total ?? ((it.quantity || 1) * (it.price ?? it.unit_price ?? 0))),
                tax_amount: Number(it.tax_amount ?? 0),
                tax: it.tax,
                tax_percentage: Number(it.tax_percentage ?? ((it.tax || 0.18) * 100)),
                cost_includes_tax: it.cost_includes_tax,
                is_service: true,
              }));
            }
          } catch (e) {
            console.warn('Could not read offline items in AlanubeService', e);
          }
        }
      }

      // Si aún no tiene items pero la factura tiene total, garantizar al menos 1 item para cumplir el esquema DGII
      if ((!sale.sale_items || sale.sale_items.length === 0) && Number(sale.total) > 0) {
        sale.sale_items = [{
          product: { name: sale.notes || 'Servicios Generales' },
          product_name: sale.notes || 'Servicios Generales',
          name: sale.notes || 'Servicios Generales',
          quantity: 1,
          unit_price: Number(sale.subtotal || sale.total),
          price: Number(sale.subtotal || sale.total),
          total: Number(sale.total),
          tax_amount: Number(sale.tax_total || 0),
          tax_percentage: Number(sale.tax_total) > 0 ? 18 : 0,
          is_service: true
        }];
      }

      // Si ya fue aceptada previamente y tiene QR, notificar de inmediato sin reenviar
      if (sale.estado_fiscal === 'ACEPTADO' && sale.qrcode_url) {
        const payload = {
          saleId,
          estado_fiscal: 'ACEPTADO' as const,
          encf: sale.encf || sale.invoice_number,
          invoice_number: sale.encf || sale.invoice_number,
          codigo_seguridad: sale.codigo_seguridad,
          fecha_firma: sale.fecha_firma,
          qrcode_url: sale.qrcode_url,
          alanube_id: sale.alanube_id
        };
        this.latestSignatures.set(saleId, payload);
        this.notifySignatureUpdate(payload);
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
      if (internalCode === 'FAC' || (sale.invoice_number || '').startsWith('FAC')) {
        return true;
      }
      const alanubeType = mapInternalToAlanubeType(internalCode as string);

      // Normalizar e-NCF a 13 caracteres exactos (Ej: E320000000001)
      const rawNumMatch = (sale.invoice_number || '').match(/(\d{1,10})$/);
      const rawSeqStr = rawNumMatch ? rawNumMatch[1] : '1';
      // Si viene con el prefijo de tipo (ej. E320000000003 -> 320000000003), extraer solo los últimos 10 dígitos de secuencia
      const seqDigits = rawSeqStr.length > 10 ? rawSeqStr.slice(-10) : rawSeqStr;
      let currentSeqNum = parseInt(seqDigits, 10) || 1;
      let normalizedEncf = `E${alanubeType}${String(currentSeqNum).padStart(10, '0').slice(-10)}`;

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
        const rawUnitPrice = Number(item.unit_price ?? item.price ?? 0);
        const taxPercentage = Math.round(Number(item.tax_percentage ?? item.tax ?? 0));
        const costIncludesTax = Boolean(item.cost_includes_tax);

        // Calcular lineTotalWithTax y taxAmount soportando tanto CartItem como sale_item
        let lineTotalWithTax = Number(item.total || 0);
        let taxAmount = Number(item.tax_amount || 0);

        if (lineTotalWithTax === 0 && rawUnitPrice > 0) {
          if (costIncludesTax) {
            lineTotalWithTax = Number((rawUnitPrice * quantity).toFixed(2));
            if (taxPercentage > 0) {
              taxAmount = Number((lineTotalWithTax - (lineTotalWithTax / (1 + taxPercentage / 100))).toFixed(2));
            }
          } else {
            const netSubtotal = rawUnitPrice * quantity;
            taxAmount = taxPercentage > 0 ? Number((netSubtotal * (taxPercentage / 100)).toFixed(2)) : 0;
            lineTotalWithTax = Number((netSubtotal + taxAmount).toFixed(2));
          }
        } else if (taxAmount === 0 && taxPercentage > 0 && lineTotalWithTax > 0) {
          taxAmount = Number((lineTotalWithTax - (lineTotalWithTax / (1 + taxPercentage / 100))).toFixed(2));
        }

        const netLineAmount = Math.max(0, Number((lineTotalWithTax - taxAmount).toFixed(2)));
        const unitPriceNet = Number((netLineAmount / quantity).toFixed(4));
        const itemAmount = Number((unitPriceNet * quantity).toFixed(2));

        // Indicador de facturación DGII: 1 = ITBIS 18%, 2 = ITBIS 16%, 4 = Exento (E)
        let billingIndicator = 4;
        if (taxAmount > 0 && taxPercentage > 0) {
          billingIndicator = taxPercentage === 16 ? 2 : 1;
        }

        if (billingIndicator === 1) {
          i1AmountTaxed = Number((i1AmountTaxed + itemAmount).toFixed(2));
        } else if (billingIndicator === 2) {
          i2AmountTaxed = Number((i2AmountTaxed + itemAmount).toFixed(2));
        } else {
          exemptAmount = Number((exemptAmount + itemAmount).toFixed(2));
        }

        const resolvedName = item.product?.name || item.product_name || item.name || item.description || 'Servicio General';
        const isService = item.is_service || sale.is_service || !item.product_id;
        return {
          lineNumber: index + 1,
          billingIndicator,
          itemName: resolvedName.slice(0, 80),
          goodServiceIndicator: isService ? 2 : 1, // 1 = Bien, 2 = Servicio
          quantityItem: Number(quantity.toFixed(2)),
          unitPriceItem: unitPriceNet,
          itemAmount
        };
      });

      let totalTaxedAmount = Number((i1AmountTaxed + i2AmountTaxed).toFixed(2));
      let itbis1Total = Number((i1AmountTaxed * 0.18).toFixed(2));
      let itbis2Total = Number((i2AmountTaxed * 0.16).toFixed(2));
      let itbisTotal = Number((itbis1Total + itbis2Total).toFixed(2));
      let totalAmount = Number((totalTaxedAmount + exemptAmount + itbisTotal).toFixed(2));

      // Respaldo de coherencia: Si el total calculado da 0 o difiere de sale.total, sincronizar
      const saleTotalNum = Number(sale.total) || 0;
      if (totalAmount === 0 && saleTotalNum > 0) {
        totalAmount = saleTotalNum;
        const saleTaxNum = Number(sale.tax_total) || 0;
        if (saleTaxNum > 0) {
          totalTaxedAmount = Number((saleTotalNum - saleTaxNum).toFixed(2));
          itbis1Total = saleTaxNum;
          itbisTotal = saleTaxNum;
          i1AmountTaxed = totalTaxedAmount;
        } else {
          exemptAmount = saleTotalNum;
        }
      }

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

      const rawDueDate = config.sequence_due_date || (typeof window !== 'undefined' ? localStorage.getItem('alanube_sequence_due_date') : null) || '';
      let formattedDueDate = '';
      if (rawDueDate) {
        const dmyMatch = rawDueDate.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
        if (dmyMatch) {
          formattedDueDate = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDueDate.trim())) {
          formattedDueDate = rawDueDate.trim();
        }
      }

      const idDoc: Record<string, any> = {
        encf: normalizedEncf,
        incomeType: 1,
        paymentType: sale.payment_method === 'credit' ? 2 : 1,
        ...(totalTaxedAmount > 0 ? { taxAmountIndicator: 0 } : {}),
        ...(alanubeType !== '32' ? { sequenceDueDate: formattedDueDate } : {}),
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
          id: config.company_id || ''
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
      const customerRnc = (sale.customer?.rnc || initialSaleData?.customer?.rnc || initialSaleData?.customer_rnc || (initialSaleData as any)?.customerRnc || '').replace(/[^0-9]/g, '');
      const customerName = sale.customer?.name || initialSaleData?.customer?.name || initialSaleData?.customer_name || (initialSaleData as any)?.customerName || 'Cliente General';

      if (customerRnc) {
        document.buyer = {
          rnc: customerRnc,
          companyName: customerName.slice(0, 150)
        };
      } else if (alanubeType !== '32') {
        throw new Error(`El RNC del comprador es obligatorio para emitir e-CF (${normalizedEncf || 'E' + alanubeType}). Solo las facturas de consumo (E32) permiten emitir a Consumidor Final sin RNC.`);
      }

      // 5. Enviar a Alanube (con auto-recuperación de colisión de secuencia AP3001)
      const client = new AlanubeClient(config);
      try {
        let response = await client.submitDocument(document, alanubeType);
        let seqWasIncremented = false;
        let retryAttempts = 0;

        // Si el e-NCF ya fue usado en Alanube (AP3001), avanzar automáticamente al siguiente disponible
        while (
          response.errores &&
          response.errores.length > 0 &&
          response.errores.some(e => e.codigo === 'AP3001' || (e.mensaje && e.mensaje.includes('ENCF document was used'))) &&
          retryAttempts < 25
        ) {
          retryAttempts++;
          currentSeqNum++;
          seqWasIncremented = true;
          normalizedEncf = `E${alanubeType}${String(currentSeqNum).padStart(10, '0').slice(-10)}`;
          document.idDoc.encf = normalizedEncf;
          console.log(`🔄 [Alanube] e-NCF previo ya utilizado en Alanube. Avanzando automáticamente a ${normalizedEncf} (intento #${retryAttempts})...`);
          response = await client.submitDocument(document, alanubeType);
        }

        if (response.errores && response.errores.length > 0) {
          const errorMsg = response.errores.map(e => `${e.codigo ? `[${e.codigo}] ` : ''}${e.mensaje}`).join('\n');
          this.lastErrors.set(saleId, errorMsg);

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

          // Mostrar al usuario el motivo del rechazo fiscal (DGII) en un Toast descriptivo si no es silencioso
          if (!silent) {
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

        // Si se auto-incrementó la secuencia por AP3001, sincronizar invoice_sequences y offlineDB
        if (seqWasIncremented) {
          try {
            await supabase
              .from('invoice_sequences')
              .update({
                current_number: currentSeqNum,
                updated_at: new Date().toISOString()
              })
              .eq('store_id', sale.store_id)
              .eq('invoice_type_id', internalCode);

            const { offlineDB, OfflineStore } = await import('@/lib/offlineDB');
            const settings = await offlineDB.get<any>(OfflineStore.SETTINGS, 'invoice_sequences') || { key: 'invoice_sequences' };
            settings[internalCode] = {
              current: currentSeqNum,
              prefix: `${internalCode}-`
            };
            await offlineDB.put(OfflineStore.SETTINGS, settings);
            console.log(`✅ [Alanube] Secuencia ${internalCode} sincronizada automáticamente a #${currentSeqNum}`);
          } catch (seqErr) {
            console.warn('[Alanube] No se pudo sincronizar secuencia tras auto-incremento:', seqErr);
          }
        }

        // Construct standard DGII verification URL if missing
        const isSandbox = config.environment === 'SANDBOX';
        const ecfPath = isSandbox ? 'testecf' : 'ecf';
        const fcPath = isSandbox ? 'testfc' : 'ecf';

        let calculatedFallbackUrl = '';
        if (finalEncf.startsWith('E32') && !receptorRnc) {
          calculatedFallbackUrl = `https://fc.dgii.gov.do/${fcPath}/ConsultaTimbreFC?RncEmisor=${emisorRnc}&ENCF=${finalEncf}&MontoTotal=${totalAmount.toFixed(2)}&CodigoSeguridad=${finalSecCode}`;
        } else {
          const dgiiFecha = dgiiFormatted ? dgiiFormatted.split(' ')[0] : '';
          calculatedFallbackUrl = `https://ecf.dgii.gov.do/${ecfPath}/ConsultaTimbre?RncEmisor=${emisorRnc}&RncComprador=${receptorRnc}&ENCF=${finalEncf}&FechaEmision=${dgiiFecha}&MontoTotal=${totalAmount.toFixed(2)}&FechaFirma=${encodeURIComponent(dgiiFormatted)}&CodigoSeguridad=${finalSecCode}`;
        }

        let qrUrl = response.qrcode_url || (response as any).qrCodeUrl || calculatedFallbackUrl;

        // Si la URL recibida de Alanube vino con MontoTotal=0 pero la venta tiene total mayor a 0, corregirlo
        if (qrUrl && totalAmount > 0) {
          qrUrl = qrUrl.replace(/([?&]MontoTotal=)0(?:\.00)?(&|$)/, `$1${totalAmount.toFixed(2)}$2`);
        }
        // Corregir subdominios de prueba de DGII en caso de venir con testecf.dgii o testfc.dgii
        if (qrUrl) {
          qrUrl = qrUrl.replace('testecf.dgii.gov.do', 'ecf.dgii.gov.do/testecf')
                       .replace('testfc.dgii.gov.do', 'fc.dgii.gov.do/testfc');
        }

        const signaturePayload = {
          saleId,
          estado_fiscal: 'ACEPTADO' as const,
          encf: finalEncf,
          invoice_number: finalEncf,
          codigo_seguridad: finalSecCode,
          fecha_firma: isoDate,
          qrcode_url: qrUrl,
          alanube_id: response.alanube_id
        };

        this.latestSignatures.set(saleId, signaturePayload);

        // Notificar de inmediato a la UI en memoria (0ms de espera para PrintOptionsDialog)
        this.notifySignatureUpdate(signaturePayload);

        const { error: updateErr } = await supabase
          .from('sales')
          .update({
            is_electronic: true,
            estado_fiscal: 'ACEPTADO',
            invoice_number: finalEncf,
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
              invoice_number: finalEncf,
              qrcode_url: qrUrl,
              codigo_seguridad: finalSecCode || null
            })
            .eq('id', saleId);
        }

        return true;

      } catch (error: any) {
        const errorMessage = error?.message || 'Error de conexión con Alanube / DGII';
        this.lastErrors.set(saleId, errorMessage);

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

        console.error('[Alanube] Connection/Infrastructure Error:', error);

        if (!silent) {
          import('@/hooks/use-toast').then(({ toast }) => {
            toast({
              title: "Error de Conexión Fiscal",
              description: `No se pudo conectar con el servidor de facturación electrónica. Detalle: ${errorMessage}.`,
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
      this.lastErrors.set(saleId, generalMessage);
      if (!silent) {
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

  /**
   * Revierte por completo una venta que no se pudo firmar en la DGII:
   * 1. Restaura el stock de los productos descontados en inventario
   * 2. Revierte la secuencia (current_number - 1) para no quemar/malutilizar el e-NCF
   * 3. Elimina la venta de public.sale_items y public.sales
   * 4. Limpia la venta de offlineDB
   */
  static async rollbackFailedSale(saleId: string, reason: string): Promise<boolean> {
    try {
      console.warn(`[Alanube] Revirtiendo venta no firmada ${saleId}. Motivo: ${reason}`);

      // 1. Intentar RPC atómica si está instalada en la base de datos
      const { error: rpcErr } = await supabase.rpc('rollback_failed_sale_transaction', {
        p_sale_id: saleId,
        p_reason: reason
      });

      if (!rpcErr) {
        console.log(`✅ [Alanube] Rollback vía RPC completado para venta ${saleId}`);
        try {
          const { offlineDB, OfflineStore } = await import('@/lib/offlineDB');
          await offlineDB.delete(OfflineStore.SALES, saleId);
        } catch (_) {}
        return true;
      }

      // 2. Fallback manual directo por cliente Supabase
      const { data: sale } = await supabase
        .from('sales')
        .select('id, invoice_number, invoice_type_id, store_id, sale_items (product_id, quantity)')
        .eq('id', saleId)
        .maybeSingle();

      if (!sale) return true;

      // 2a. Restaurar stock de productos
      if (Array.isArray(sale.sale_items)) {
        for (const item of sale.sale_items) {
          if (item.product_id && item.quantity > 0) {
            try {
              const { data: prod } = await supabase
                .from('products')
                .select('stock')
                .eq('id', item.product_id)
                .maybeSingle();
              if (prod) {
                await supabase
                  .from('products')
                  .update({ stock: (prod.stock || 0) + item.quantity })
                  .eq('id', item.product_id);
              }
            } catch (stockErr) {
              console.warn('[Alanube] Error restaurando stock en rollback:', stockErr);
            }
          }
        }
      }

      // 2b. Revertir número de secuencia si este comprobante fue el último utilizado
      if (sale.invoice_number && sale.store_id) {
        const numMatch = sale.invoice_number.match(/(\d+)$/);
        if (numMatch) {
          const usedSeq = parseInt(numMatch[1], 10);
          try {
            const possibleTypeIds = [
              sale.invoice_type_id,
              sale.invoice_number?.substring(0, 3),
              sale.invoice_type_id ? 'E' + sale.invoice_type_id.replace(/^B/, '') : null,
              sale.invoice_type_id ? 'B' + sale.invoice_type_id.replace(/^E/, '') : null
            ].filter(Boolean) as string[];

            const { data: seqRows } = await supabase
              .from('invoice_sequences')
              .select('id, invoice_type_id, current_number')
              .eq('store_id', sale.store_id)
              .in('invoice_type_id', possibleTypeIds);

            const matchingRow = (seqRows || []).find(r => Number(r.current_number) === usedSeq);
            if (matchingRow) {
              const newCurrent = Math.max(0, usedSeq - 1);
              await supabase
                .from('invoice_sequences')
                .update({ current_number: newCurrent, updated_at: new Date().toISOString() })
                .eq('id', matchingRow.id);

              const { offlineDB, OfflineStore } = await import('@/lib/offlineDB');
              const settings = await offlineDB.get<any>(OfflineStore.SETTINGS, 'invoice_sequences') || { key: 'invoice_sequences' };
              for (const tid of possibleTypeIds) {
                if (settings[tid]) {
                  settings[tid].current = newCurrent;
                }
              }
              await offlineDB.put(OfflineStore.SETTINGS, settings);
              console.log(`🔄 [Alanube] Secuencia ${matchingRow.invoice_type_id} revertida exitosamente a #${newCurrent}`);
            }
          } catch (seqErr) {
            console.warn('[Alanube] Error revirtiendo secuencia:', seqErr);
          }
        }
      }

      // 2c. Eliminar items y venta
      await supabase.from('sale_items').delete().eq('sale_id', saleId);
      await supabase.from('sales').delete().eq('id', saleId);

      // 2d. Limpiar de offlineDB
      try {
        const { offlineDB, OfflineStore } = await import('@/lib/offlineDB');
        await offlineDB.delete(OfflineStore.SALES, saleId);
      } catch (_) {}

      console.log(`✅ [Alanube] Venta ${saleId} eliminada limpiamente tras fallo de firma.`);
      return true;
    } catch (err) {
      console.error('[Alanube] Error ejecutando rollback de venta:', err);
      return false;
    }
  }
}
