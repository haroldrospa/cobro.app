import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from './useUserStore';

// Puntos que gana un cliente por cada $100 pesos
export const POINTS_PER_100 = 1;
// Valor en pesos de cada punto canjeado
export const POINT_VALUE_IN_PESOS = 1;

export interface LoyaltyCustomer {
    id: string;
    name: string;
    rnc: string;
    phone: string;
    email: string;
    loyalty_points: number;
    loyalty_points_expires_at?: string | null;
    credit_limit: number;
    credit_used: number;
    validation_code?: string | null;
}

/**
 * Busca un cliente por su Código de Validación para el sistema de puntos.
 */
export const useFindCustomerByCode = () => {
    const { data: store } = useUserStore();

    return useMutation({
        mutationFn: async (code: string): Promise<LoyaltyCustomer | null> => {
            if (!code || code.trim().length < 2) return null;

            // Buscamos directamente por validation_code en el store actual
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('validation_code', code.trim())
                .eq('store_id', store?.id)
                .maybeSingle();

            if (error) throw error;
            return data as unknown as LoyaltyCustomer | null;
        }
    });
};

/**
 * Otorga puntos a un cliente tras una venta exitosa.
 */
export const useAwardLoyaltyPoints = () => {
    const { data: store } = useUserStore();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            customerId,
            saleTotal,
            saleId
        }: {
            customerId: string;
            saleTotal: number;
            saleId?: string;
        }) => {
            const { data, error } = await supabase.rpc('award_loyalty_points' as any, {
                p_customer_id: customerId,
                p_sale_total: saleTotal,
                p_sale_id: saleId || null,
                p_store_id: store?.id || null
            });

            if (error) throw error;
            return data as number; // points earned
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        }
    });
};

/**
 * Canjea puntos de un cliente como descuento.
 * Retorna el monto de descuento en pesos.
 */
export const useRedeemLoyaltyPoints = () => {
    const { data: store } = useUserStore();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            customerId,
            pointsToRedeem,
            saleId
        }: {
            customerId: string;
            pointsToRedeem: number;
            saleId?: string;
        }) => {
            const { data, error } = await supabase.rpc('redeem_loyalty_points' as any, {
                p_customer_id: customerId,
                p_points_to_redeem: pointsToRedeem,
                p_store_id: store?.id || null,
                p_sale_id: saleId || null
            });

            if (error) throw error;
            return data as number; // discount amount in pesos
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        }
    });
};

/**
 * Calcula cuántos puntos gana un cliente según el total de compra.
 */
export const calculatePointsEarned = (total: number): number => {
    return Math.floor(total / 100);
};

/**
 * Calcula el descuento en pesos que representa una cantidad de puntos.
 */
export const calculatePointsValue = (points: number): number => {
    return points * POINT_VALUE_IN_PESOS;
};
