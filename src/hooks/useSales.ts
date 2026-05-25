
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CartItem } from '@/types/pos';

interface CreateSaleData {
  customer_id?: string;
  invoice_type_id: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  payment_method: string;
  amount_received?: number;
  change_amount?: number;
  payment_status?: string;
  due_date?: string;
  items: CartItem[];
}

export const useCreateSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saleData: CreateSaleData) => {
      // Get current user's store_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

      // 0. Obtener el CÓDIGO del tipo de factura (el RPC espera 'B01', 'B02', pero recibimos UUID)
      const { data: invoiceTypeData, error: typeError } = await supabase
        .from('invoice_types')
        .select('code')
        .eq('id', saleData.invoice_type_id)
        .single();

      if (typeError) {
        // Fallback: Si no se encuentra por ID, quizás ya es el código?
        // O si hay error, lanzamos
        console.error("Error buscando tipo de factura:", typeError);
        // No lanzamos error aquí para permitir intentar usar el ID como código si falla, 
        // aunque lo ideal es que invoiceTypeData exista.
      }

      const invoiceTypeCode = invoiceTypeData?.code || saleData.invoice_type_id;
      console.log('3. Código de factura a usar:', invoiceTypeCode);

      let attempts = 0;
      // START DEBUG: Increased from 3 to 50 to catch up sequence lag
      const maxAttempts = 50;
      let finalSale = null;

      while (attempts < maxAttempts) {
        attempts++;
        try {
          // Generar número de factura secuencial
          console.log(`Intento ${attempts}: Generando número...`);
          const { data: invoiceNumber, error: invoiceError } = await supabase
            .rpc('get_next_invoice_number', { invoice_type_code: invoiceTypeCode });

          if (invoiceError) {
            console.error('Error RPC:', invoiceError);
            throw new Error(`Error generando secuencia (Código: ${invoiceTypeCode}): ${invoiceError.message}`);
          }

          console.log('4. Número generado:', invoiceNumber);

          // Crear la venta con store_id
          const { data: sale, error: saleError } = await supabase
            .from('sales')
            .insert([{
              invoice_number: invoiceNumber,
              customer_id: saleData.customer_id || null,
              invoice_type_id: saleData.invoice_type_id,
              subtotal: saleData.subtotal,
              discount_total: saleData.discount_total,
              tax_total: saleData.tax_total,
              total: saleData.total,
              payment_method: saleData.payment_method,
              amount_received: saleData.amount_received,
              change_amount: saleData.change_amount,
              payment_status: saleData.payment_status || 'paid',
              due_date: saleData.due_date || null,
              store_id: profile?.store_id || null,
              profile_id: user.id
            }])
            .select(`
              *,
              profile:profiles(full_name)
            `)
            .single();

          if (saleError) {
            // Si el error es de duplicado, lanzamos para capturar y reintentar
            if (saleError.code === '23505' || saleError.message.includes('unique constraint')) {
              console.warn(`Número de factura ${invoiceNumber} duplicado. Reintentando...`);
              continue; // Próxima iteración
            }
            throw saleError; // Otro error, fallar
          }

          finalSale = sale;
          break; // Éxito! Salir del bucle

        } catch (err: any) {
          if (attempts === maxAttempts) throw err; // Si es el último intento, fallar
          if (!err.message?.includes('duplicate') && !err.message?.includes('unique constraint')) throw err; // Si no es error de duplicado, fallar
        }
      }

      if (!finalSale) throw new Error("No se pudo generar un número de factura único después de varios intentos.");

      const sale = finalSale;

      // Crear los items de la venta
      // Calcular proporción del descuento global para cada item
      const totalSubtotal = saleData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      const saleItems = saleData.items.map(item => {
        const itemSubtotal = item.price * item.quantity;
        const itemProportion = totalSubtotal > 0 ? itemSubtotal / totalSubtotal : 0;
        const itemDiscountAmount = saleData.discount_total * itemProportion;
        const itemDiscountPercentage = itemSubtotal > 0 ? (itemDiscountAmount / itemSubtotal) * 100 : 0;
        const itemAfterDiscount = itemSubtotal - itemDiscountAmount;
        const itemTaxAmount = itemAfterDiscount * item.tax;

        // Verificar si el ID es un UUID válido (para evitar errores en la base de datos con cargos extras)
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id);

        return {
          sale_id: sale.id,
          product_id: isValidUuid ? item.id : null,
          product_name: item.comment ? `${item.name} (${item.comment})` : item.name,
          quantity: item.quantity,
          unit_price: item.price,
          discount_percentage: itemDiscountPercentage,
          tax_percentage: item.tax * 100,
          subtotal: itemSubtotal,
          discount_amount: itemDiscountAmount,
          tax_amount: itemTaxAmount,
          total: itemAfterDiscount + itemTaxAmount,
        };
      });

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Actualizar stock de productos en PARALELO
      const validSaleItems = saleData.items.filter(item =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id)
      );

      await Promise.all(validSaleItems.map(async (item) => {
        const { data: product, error: fetchError } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.id)
          .single();

        if (fetchError) {
          console.warn('Error obteniendo stock del producto:', fetchError);
          return;
        }

        const newStock = (product.stock || 0) - item.quantity;
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock: Math.max(0, newStock) })
          .eq('id', item.id);

        if (stockError) {
          console.warn('Error actualizando stock:', stockError);
        }
      }));

      return sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['next-invoice-number'] });
    },
  });
};
