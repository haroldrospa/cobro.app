import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface ProductOffer {
    id: string;
    product_id: string;
    store_id?: string;
    quantity: number; // Cantidad mínima (ej: 2, 3)
    offer_price: number; // Precio total (ej: 150 por 2 unidades)
    is_active: boolean;
    valid_from?: string; // Fecha de inicio
    valid_to?: string;   // Fecha de fin (opcional)
    created_at?: string;
    updated_at?: string;
}

/**
 * Hook para obtener las ofertas de un producto específico
 */
export const useProductOffers = (productId?: string) => {
    return useQuery({
        queryKey: ['product-offers', productId],
        queryFn: async () => {
            if (!productId) return [];

            const { data, error } = await supabase
                .from('product_offers')
                .select('*')
                .eq('product_id', productId)
                .order('quantity', { ascending: true });

            if (error) throw error;
            return (data || []) as ProductOffer[];
        },
        enabled: !!productId,
        staleTime: 1000 * 60 * 5, // 5 minutos
    });
};

/**
 * Hook para obtener TODAS las ofertas activas (para el POS)
 */
export const useAllActiveOffers = () => {
    return useQuery({
        queryKey: ['all-active-offers'],
        queryFn: async () => {
            const now = new Date().toISOString();

            const { data, error } = await supabase
                .from('product_offers')
                .select(`
          *,
          product:products(name, barcode, image_url)
        `);

            if (error) throw error;

            // Filtrar por fecha y estado activo en el cliente
            const validOffers = (data || []).filter((offer: any) => {
                if (!offer.is_active) return false;

                const validFrom = offer.valid_from ? new Date(offer.valid_from) : new Date(0);
                const validTo = offer.valid_to ? new Date(offer.valid_to) : null;
                const now = new Date();

                // Si valid_from es futuro, no mostrar
                if (validFrom > now) return false;

                // Si valid_to existe y es pasado, no mostrar
                if (validTo && validTo < now) return false;

                return true;
            });

            return validOffers as (ProductOffer & { product?: any })[];
        },
        staleTime: 1000 * 60 * 5, // 5 minutos
    });
};

/**
 * Hook para crear una nueva oferta
 */
export const useCreateOffer = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (offer: Omit<ProductOffer, 'id' | 'created_at' | 'updated_at'>) => {
            // Obtener store_id del usuario actual
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario no autenticado');

            const { data: profile } = await supabase
                .from('profiles')
                .select('store_id')
                .eq('id', user.id)
                .maybeSingle();

            const { data, error } = await supabase
                .from('product_offers')
                .insert([{
                    ...offer,
                    store_id: profile?.store_id || null,
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['product-offers', variables.product_id] });
            queryClient.invalidateQueries({ queryKey: ['all-active-offers'] });
            toast({
                title: "Oferta creada",
                description: `Oferta de ${variables.quantity} unidades agregada correctamente.`,
            });
        },
        onError: (error: any) => {
            console.error('Error creating offer:', error);

            let message = "No se pudo crear la oferta.";
            if (error.message?.includes('duplicate') || error.code === '23505') {
                message = "Ya existe una oferta con esa cantidad para este producto.";
            }

            toast({
                variant: "destructive",
                title: "Error",
                description: message,
            });
        },
    });
};

/**
 * Hook para actualizar una oferta
 */
export const useUpdateOffer = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...updates }: Partial<ProductOffer> & { id: string }) => {
            const { data, error } = await supabase
                .from('product_offers')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['product-offers', data.product_id] });
            queryClient.invalidateQueries({ queryKey: ['all-active-offers'] });
            toast({
                title: "Oferta actualizada",
                description: "La oferta se ha actualizado correctamente.",
            });
        },
        onError: (error: any) => {
            console.error('Error updating offer:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo actualizar la oferta.",
            });
        },
    });
};

/**
 * Hook para eliminar una oferta
 */
export const useDeleteOffer = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, product_id }: { id: string; product_id: string }) => {
            const { error } = await supabase
                .from('product_offers')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { id, product_id };
        },
        onSuccess: (variables) => {
            queryClient.invalidateQueries({ queryKey: ['product-offers', variables.product_id] });
            queryClient.invalidateQueries({ queryKey: ['all-active-offers'] });
            toast({
                title: "Oferta eliminada",
                description: "La oferta se ha eliminado correctamente.",
            });
        },
        onError: (error: any) => {
            console.error('Error deleting offer:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo eliminar la oferta.",
            });
        },
    });
};

/**
 * Función helper para calcular la mejor oferta para una cantidad dada
 */
export const calculateBestOffer = (
    quantity: number,
    unitPrice: number,
    offers: ProductOffer[]
): {
    appliedOffer: ProductOffer | null;
    finalPrice: number;
    savings: number;
    pricePerUnit: number;
} => {
    if (!offers || offers.length === 0 || quantity < 2) {
        return {
            appliedOffer: null,
            finalPrice: quantity * unitPrice,
            savings: 0,
            pricePerUnit: unitPrice,
        };
    }

    // Filtrar solo ofertas ACTIVAS y VIGENTES
    const now = new Date();
    const activeOffers = offers.filter(offer => {
        if (!offer.is_active) return false;

        // Validar fechas
        const validFrom = offer.valid_from ? new Date(offer.valid_from) : new Date(0);
        const validTo = offer.valid_to ? new Date(offer.valid_to) : null;

        if (validFrom > now) return false;
        if (validTo && validTo < now) return false;

        return true;
    });

    // Encontrar ofertas aplicables (quantity >= cantidad mínima de la oferta)
    const applicableOffers = activeOffers.filter(offer => quantity >= offer.quantity);

    if (applicableOffers.length === 0) {
        return {
            appliedOffer: null,
            finalPrice: quantity * unitPrice,
            savings: 0,
            pricePerUnit: unitPrice,
        };
    }

    // Calcular el mejor precio con ofertas
    let bestPrice = quantity * unitPrice;
    let bestOffer: ProductOffer | null = null;

    for (const offer of applicableOffers) {
        // Calcular cuántos "paquetes" de oferta podemos hacer
        const offerPackages = Math.floor(quantity / offer.quantity);
        const remainingUnits = quantity % offer.quantity;

        // Precio = (paquetes × precio_oferta) + (unidades_restantes × precio_unitario)
        const totalPrice = (offerPackages * offer.offer_price) + (remainingUnits * unitPrice);

        if (totalPrice < bestPrice) {
            bestPrice = totalPrice;
            bestOffer = offer;
        }
    }

    const normalPrice = quantity * unitPrice;
    const savings = normalPrice - bestPrice;

    return {
        appliedOffer: bestOffer,
        finalPrice: bestPrice,
        savings,
        pricePerUnit: bestPrice / quantity,
    };
};
