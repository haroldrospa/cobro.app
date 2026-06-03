import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';
import { useUserStore } from '@/hooks/useUserStore';

export interface InventoryMovement {
    id: string;
    store_id: string;
    product_id: string;
    profile_id: string | null;
    user_name: string | null;
    quantity_changed: number;
    previous_stock: number;
    new_stock: number;
    reason: string;
    created_at: string;
    product?: {
        name: string;
    };
    profile?: {
        full_name: string;
    };
}

export const useInventoryMovementsOffline = () => {
    const { data: store, isPending: isStorePending } = useUserStore();
    const storeId = store?.id;

    return useQuery({
        queryKey: ['inventory-movements', 'offline', storeId],
        queryFn: async () => {
            if (!storeId) return [];
            const movements = await offlineDB.getAll<any>(OfflineStore.INVENTORY_MOVEMENTS);
            // Filtrar por store_id localmente
            const filtered = movements.filter(m => m.store_id === storeId);
            // Ordenar por fecha descendente
            return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        },
        enabled: !isStorePending && !!storeId,
    });
};

export const useCreateInventoryMovementOffline = () => {
    const queryClient = useQueryClient();
    const { data: store } = useUserStore();
    const storeId = store?.id;

    return useMutation({
        mutationFn: async (movement: {
            product_id: string;
            quantity_changed: number;
            previous_stock: number;
            new_stock: number;
            reason: string;
        }) => {
            // 1. Obtener sesión local de usuario
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id || null;

            // Intentar obtener el nombre del perfil
            let userName = 'Sistema';
            if (userId) {
                const profiles = queryClient.getQueryData<any[]>(['profiles']) || [];
                const localProf = profiles.find(p => p.id === userId);
                if (localProf) {
                    userName = localProf.full_name || 'Usuario';
                } else {
                    // Fallback a Supabase si no está cargado localmente
                    try {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('full_name')
                            .eq('id', userId)
                            .maybeSingle();
                        if (profile?.full_name) userName = profile.full_name;
                    } catch (e) {
                        console.warn('Fallo al obtener nombre de perfil online:', e);
                    }
                }
            }

            const actualStoreId = storeId;
            if (!actualStoreId) throw new Error('Tienda no cargada');

            const newMovement = {
                id: crypto.randomUUID(),
                store_id: actualStoreId,
                product_id: movement.product_id,
                profile_id: userId,
                user_name: userName,
                quantity_changed: movement.quantity_changed,
                previous_stock: movement.previous_stock,
                new_stock: movement.new_stock,
                reason: movement.reason,
                created_at: new Date().toISOString(),
            };

            // Guardar localmente en IndexedDB
            await offlineDB.put(OfflineStore.INVENTORY_MOVEMENTS, newMovement);

            // Agregar a la cola de sincronización para Supabase
            await offlineDB.addToSyncQueue({
                store: OfflineStore.INVENTORY_MOVEMENTS,
                operation: 'CREATE',
                data: newMovement,
            });

            return newMovement;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-movements', 'offline', storeId] });
        },
    });
};
