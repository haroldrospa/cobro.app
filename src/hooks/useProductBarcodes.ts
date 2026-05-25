/**
 * Hook para gestionar múltiples códigos de barra por producto
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProductBarcode } from './useProducts';

/** Obtener el store_id del usuario actual */
async function getCurrentStoreId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

    return profile?.store_id ?? null;
}

/** Sincronizar todos los barcodes de un producto (reemplaza los existentes) */
export const useSyncProductBarcodes = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            productId,
            barcodes,
        }: {
            productId: string;
            barcodes: Omit<ProductBarcode, 'id'>[];
        }) => {
            const storeId = await getCurrentStoreId();
            if (!storeId) throw new Error('No se encontró tienda activa');

            // 1. Borrar los barcodes existentes
            const { error: deleteError } = await supabase
                .from('product_barcodes')
                .delete()
                .eq('product_id', productId);

            if (deleteError) throw deleteError;

            // 2. Insertar los nuevos (si hay)
            if (barcodes.length === 0) return [];

            const toInsert = barcodes
                .filter(b => b.barcode.trim() !== '')
                .map(b => ({
                    product_id: productId,
                    barcode: b.barcode.trim(),
                    label: b.label?.trim() || null,
                    quantity: b.quantity || 1,
                    discount_value: b.discount_value || 0,
                    discount_type: b.discount_type || 'percentage',
                    store_id: storeId,
                }));

            if (toInsert.length === 0) return [];

            let { data, error } = await supabase
                .from('product_barcodes')
                .insert(toInsert)
                .select('id, barcode, label, quantity, discount_value, discount_type');

            if (error && error.message?.includes('Could not find')) {
                // FALLBACK: Intentar sin las columnas nuevas
                console.warn('Columnas de bundle no encontradas, guardando barcode básico');
                const basicToInsert = toInsert.map(({ quantity, discount_value, discount_type, ...rest }) => rest);
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('product_barcodes')
                    .insert(basicToInsert)
                    .select('id, barcode, label');
                
                if (fallbackError) throw fallbackError;
                return fallbackData as any[];
            }

            if (error) throw error;
            return data as ProductBarcode[];
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });
};
