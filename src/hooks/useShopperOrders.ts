import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { shopperSupabase } from '@/integrations/supabase/shopperClient';
import { supabase } from '@/integrations/supabase/client';

export const useShopperOrders = (email?: string, phone?: string) => {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['shopper-orders', email, phone],
        queryFn: async () => {
            const { data: { session } } = await shopperSupabase.auth.getSession();

            let query = shopperSupabase
                .from('open_orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (session?.user) {
                query = query.eq('customer_email', session.user.email);
            } else if (email) {
                query = query.eq('customer_email', email);
            } else if (phone) {
                query = query.eq('customer_phone', phone);
            } else {
                return [];
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        staleTime: 1000 * 5,
        enabled: !!email || !!phone || true,
    });

    // Listener Realtime global (sin filtro de columna en servidor para capturar eventos DELETE)
    useEffect(() => {
        const channelId = `shopper-orders-realtime-${email || phone || 'global'}`;

        const handlePayload = (payload: any) => {
            console.log('⚡ Evento Realtime recibido en tienda cliente:', payload);

            const eventType = payload.eventType;

            if (eventType === 'DELETE') {
                const deletedId = payload.old?.id;
                if (deletedId) {
                    queryClient.setQueryData(['shopper-orders', email, phone], (old: any[] | undefined) => {
                        if (!old) return [];
                        return old.filter((o: any) => String(o.id) !== String(deletedId));
                    });
                }
            } else if (eventType === 'UPDATE') {
                const updated = payload.new as any;
                if (updated?.id) {
                    queryClient.setQueryData(['shopper-orders', email, phone], (old: any[] | undefined) => {
                        if (!old) return [];
                        return old.map((o: any) => String(o.id) === String(updated.id) ? { ...o, ...updated } : o);
                    });
                }
            }

            // Sincronizar inmediatamente todas las consultas relativas a pedidos del cliente
            queryClient.invalidateQueries({ queryKey: ['shopper-orders'] });
            queryClient.refetchQueries({ queryKey: ['shopper-orders'] });
        };

        const channelShopper = shopperSupabase
            .channel(`${channelId}-shopper`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'open_orders',
                },
                handlePayload
            )
            .subscribe();

        const channelSupabase = supabase
            .channel(`${channelId}-merchant`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'open_orders',
                },
                handlePayload
            )
            .subscribe();

        return () => {
            shopperSupabase.removeChannel(channelShopper);
            supabase.removeChannel(channelSupabase);
        };
    }, [email, phone, queryClient]);

    return query;
};
