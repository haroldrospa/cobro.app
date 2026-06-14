import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { shopperSupabase } from '@/integrations/supabase/shopperClient';

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
            return data;
        },
        enabled: !!email || !!phone || true,
    });

    // Real-time listener
    useEffect(() => {
        const filter = email ? `customer_email=eq.${email}` : phone ? `customer_phone=eq.${phone}` : null;

        // If we don't have a filter yet, we might get it from session later, 
        // but for now let's at least listen if we have one.
        if (!filter) return;

        const channelId = `shopper-orders-realtime-${email || phone}`;
        const channel = shopperSupabase
            .channel(channelId)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'open_orders',
                    filter: filter
                },
                (payload) => {
                    console.log('⚡ Shopper order change detected:', payload);
                    queryClient.invalidateQueries({ queryKey: ['shopper-orders', email, phone] });
                }
            )
            .subscribe();

        return () => {
            shopperSupabase.removeChannel(channel);
        };
    }, [email, phone, queryClient]);

    return query;
};
