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
            return data || [];
        },
        staleTime: 1000 * 5,
        enabled: !!email || !!phone || true,
    });

    useEffect(() => {
        if (!email && !phone) return;

        const channelKey = `shopper-orders-rt-${email || phone}`;
        const channel = shopperSupabase
            .channel(channelKey)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'open_orders',
                },
                (payload: any) => {
                    const eventType = payload.eventType;

                    if (eventType === 'DELETE') {
                        const deletedId = payload.old?.id;
                        if (deletedId) {
                            queryClient.setQueryData(['shopper-orders', email, phone], (old: any[] | undefined) => {
                                if (!old || !Array.isArray(old)) return [];
                                return old.filter((o: any) => String(o.id) !== String(deletedId));
                            });
                        }
                    } else if (eventType === 'UPDATE') {
                        const updated = payload.new as any;
                        if (updated?.id) {
                            queryClient.setQueryData(['shopper-orders', email, phone], (old: any[] | undefined) => {
                                if (!old || !Array.isArray(old)) return [];
                                const exists = old.some((o: any) => String(o.id) === String(updated.id));
                                if (!exists) return old;
                                return old.map((o: any) => String(o.id) === String(updated.id) ? { ...o, ...updated } : o);
                            });
                        }
                    } else if (eventType === 'INSERT') {
                        const inserted = payload.new as any;
                        const isMatch = (
                            (email && inserted.customer_email?.toLowerCase() === email.toLowerCase()) ||
                            (phone && inserted.customer_phone === phone)
                        );
                        if (isMatch && inserted?.id) {
                            queryClient.setQueryData(['shopper-orders', email, phone], (old: any[] | undefined) => {
                                if (!old || !Array.isArray(old)) return [inserted];
                                if (old.some((o: any) => String(o.id) === String(inserted.id))) return old;
                                return [inserted, ...old];
                            });
                        }
                    }

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
