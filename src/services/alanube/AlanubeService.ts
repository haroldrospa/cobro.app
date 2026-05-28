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

    return {
      api_token: data.api_token,
      environment: data.environment as 'SANDBOX' | 'PRODUCTION',
      base_url: data.base_url,
      rnc_emisor: data.rnc_emisor,
      razon_social: data.razon_social
    };
  }

  /**
   * Procesa la emisión electrónica de una factura existente
   */
  static async emitirFacturaElectronica(saleId: string): Promise<boolean> {
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

      // 4. Construir el payload de Alanube
      // Nota: invoice_type_id a veces es un string simple o el id de la relacion
      const internalCode = sale.invoice_type?.code || sale.invoice_type_id || 'B01';
      const alanubeType = mapInternalToAlanubeType(internalCode as string);

      // Desglose de impuestos por tasa (Ej: 18%, 16%, etc.)
      let itbis18 = 0;
      let itbis16 = 0;
      let montoGravadoTotal = 0;
      let montoExentoTotal = 0;

      // Mapear formas de pago a códigos autorizados por la DGII
      const mapPaymentMethod = (method: string): number => {
        switch (method) {
          case 'cash': return 1;
          case 'card': return 4;
          case 'transfer': return 3;
          default: return 1;
        }
      };

      const itemDetails: any[] = (sale.sale_items as any[]).map((item, index) => {
        // Indicador Facturación: 1 (Gravado), 2 (Exento), etc. Simplificado: Si tiene tax es 1, si no 2.
        const taxAmount = item.tax_amount || 0;
        const subtotal = item.subtotal || 0;
        const total = item.total || 0;
        const quantity = item.quantity || 1;
        const unitPrice = item.unit_price || 0;
        const discountAmount = item.discount_amount || 0;
        
        const indicador = taxAmount > 0 ? 1 : 2;
        
        if (indicador === 1) {
          montoGravadoTotal += subtotal;
          const roundedTaxPercentage = Math.round(item.tax_percentage || 0);
          if (roundedTaxPercentage === 18) {
            itbis18 += taxAmount;
          } else if (roundedTaxPercentage === 16) {
            itbis16 += taxAmount;
          }
        } else {
          montoExentoTotal += subtotal;
        }

        return {
          // Standard Alanube DR v1 properties (DGII compliance)
          lineNumber: index + 1,
          itemName: item.product?.name || 'Producto General',
          goodServiceIndicator: 1, // 1 = Bien, 2 = Servicio (por defecto Bienes en POS)
          quantityItem: quantity,
          unitPriceItem: unitPrice,
          itemAmount: total,
          billingIndicator: indicador,
          
          // Auxiliary/Spanish property aliases for absolute safety
          lineItemNumber: index + 1,
          indicadorFacturacion: indicador,
          nombreItem: item.product?.name || 'Producto General',
          cantidad: quantity,
          precioUnitario: unitPrice,
          descuentoMonto: discountAmount,
          montoItem: total,
          description: item.product?.name || 'Producto General',
          name: item.product?.name || 'Producto General',
          quantity: quantity,
          unitPrice: unitPrice,
          price: unitPrice,
          discountAmountItem: discountAmount,
          amount: total,
          total: total,
          taxAmount: taxAmount,
          itbisItem: taxAmount
        };
      });

      const document: any = {
        // 1. Root level compliance fields (Alanube DR v1 & DGII compliance)
        idDoc: {
          encf: sale.invoice_number || `E320000000001`,
          incomeType: 1,
          paymentType: sale.payment_method === 'credit' ? 2 : 1,
          paymentDeadline: sale.payment_method === 'credit' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined,
          sequenceDueDate: `${new Date().getFullYear() + 1}-12-31`,
          paymentFormsTable: [
            {
              paymentMethod: mapPaymentMethod(sale.payment_method === 'split' ? (sale.split_method || 'cash') : (sale.payment_method || 'cash')),
              paymentAmount: sale.total
            }
          ]
        },
        sender: {
          rnc: config.rnc_emisor.replace(/[^0-9]/g, ''),
          name: config.razon_social,
          companyName: config.razon_social,
          stampDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
          address: 'Santo Domingo',
          province: '010000',
          municipality: '010100'
        },
        buyer: sale.customer?.rnc ? {
          rnc: sale.customer.rnc.replace(/[^0-9]/g, ''),
          name: sale.customer.name || 'Cliente General',
          companyName: sale.customer.name || 'Cliente General'
        } : undefined,
        totals: {
          totalAmount: sale.total,
          itbisAmount: sale.tax_total,
          taxAmount: sale.tax_total,
          netAmount: montoGravadoTotal,
          exemptAmount: montoExentoTotal,
          
          // Auxiliary/Spanish property aliases inside totals for safety
          montoTotal: sale.total,
          total: sale.total,
          montoGravadoTotal: montoGravadoTotal,
          montoExentoTotal: montoExentoTotal,
          itbisTotal: sale.tax_total,
          ...(itbis18 > 0 && { itbis18 }),
          ...(itbis16 > 0 && { itbis16 })
        },
        itemDetails: itemDetails,

        // 2. Backward compatibility fields (in case older/alternative parser runs)
        encabezado: {
          rncEmisor: config.rnc_emisor.replace(/[^0-9]/g, ''),
          razonSocialEmisor: config.razon_social,
          tipoDocumento: alanubeType,
          indicadorMontoGravado: montoGravadoTotal > 0 ? 1 : 0, // 1 si hay ITBIS
          fechaEmision: new Date().toISOString().split('T')[0] // YYYY-MM-DD
        },
        header: {
          rncEmisor: config.rnc_emisor.replace(/[^0-9]/g, ''),
          razonSocialEmisor: config.razon_social,
          tipoDocumento: alanubeType,
          indicadorMontoGravado: montoGravadoTotal > 0 ? 1 : 0,
          fechaEmision: new Date().toISOString().split('T')[0]
        },
        totales: {
          montoTotal: sale.total,
          montoGravadoTotal: montoGravadoTotal,
          montoExentoTotal: montoExentoTotal,
          itbisTotal: sale.tax_total,
          ...(itbis18 > 0 && { itbis18 }),
          ...(itbis16 > 0 && { itbis16 })
        },
        totals_compat: {
          montoTotal: sale.total,
          total: sale.total,
          montoGravadoTotal: montoGravadoTotal,
          netAmount: montoGravadoTotal,
          montoExentoTotal: montoExentoTotal,
          itbisTotal: sale.tax_total,
          taxAmount: sale.tax_total,
          ...(itbis18 > 0 && { itbis18 }),
          ...(itbis16 > 0 && { itbis16 })
        },
        detalles: itemDetails,
        paymentFormsTable: [
          {
            paymentMethod: mapPaymentMethod(sale.payment_method === 'split' ? (sale.split_method || 'cash') : (sale.payment_method || 'cash')),
            paymentAmount: sale.total
          }
        ],
        payment: {
          paymentType: sale.payment_method === 'credit' ? 2 : 1,
          paymentFormsTable: [
            {
              paymentMethod: mapPaymentMethod(sale.payment_method === 'split' ? (sale.split_method || 'cash') : (sale.payment_method || 'cash')),
              paymentAmount: sale.total
            }
          ]
        },
        payments: {
          paymentType: sale.payment_method === 'credit' ? 2 : 1,
          paymentFormsTable: [
            {
              paymentMethod: mapPaymentMethod(sale.payment_method === 'split' ? (sale.split_method || 'cash') : (sale.payment_method || 'cash')),
              paymentAmount: sale.total
            }
          ]
        }
      };

      // Manejo de RNC de Comprador
      if (sale.customer?.rnc) {
        const cleanRNC = sale.customer.rnc.replace(/[^0-9]/g, '');
        document.encabezado.rncComprador = cleanRNC;
        if (document.header) document.header.rncComprador = cleanRNC;
        document.receiver = {
          rnc: cleanRNC,
          name: sale.customer.name || 'Cliente General',
          companyName: sale.customer.name || 'Cliente General'
        };
        document.buyer = {
          rnc: cleanRNC,
          name: sale.customer.name || 'Cliente General',
          companyName: sale.customer.name || 'Cliente General'
        };
        if (document.idDoc) {
          document.idDoc.rncComprador = cleanRNC;
        }
      } else if (alanubeType === '31') {
        throw new Error('El RNC del comprador es obligatorio para e-Crédito Fiscal');
      }

      // 5. Enviar a Alanube
      const client = new AlanubeClient(config);
      try {
        const response = await client.submitDocument(document);

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
          import('@/hooks/use-toast').then(({ toast }) => {
            toast({
              title: "Error de Validación Fiscal (DGII)",
              description: errorMsg || "El comprobante fue rechazado por la DGII. Por favor, verifique la configuración de emisor y cliente.",
              variant: "destructive",
              duration: 12000
            });
          });

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
        
        import('@/hooks/use-toast').then(({ toast }) => {
          toast({
            title: "Error de Conexión Fiscal",
            description: `No se pudo conectar con el servidor de facturación electrónica. Detalle: ${errorMessage}. La venta se guardó localmente y se sincronizará automáticamente al restablecer el servicio.`,
            variant: "destructive",
            duration: 10000
          });
        });
          
        return false;
      }
    } catch (err: any) {
      console.error('[Alanube] Error general emitiendo factura:', err);
      const generalMessage = err?.message || 'Error general en el módulo e-NCF';
      import('@/hooks/use-toast').then(({ toast }) => {
        toast({
          title: "Error General de Facturación Electrónica",
          description: generalMessage,
          variant: "destructive",
          duration: 8000
        });
      });
      return false;
    }
  }
}
