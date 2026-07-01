import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { shopperSupabase } from '@/integrations/supabase/shopperClient';

export const useUnreadCounts = (orderIds: string[], role: 'store' | 'customer') => {
    const client = role === 'customer' ? shopperSupabase : supabase;
    const senderToCount = role === 'store' ? 'customer' : 'store';

    return useQuery({
        queryKey: ['unread_chat_counts', orderIds, role],
        queryFn: async () => {
            if (orderIds.length === 0) return {};

            const { data, error } = await client
                .from('chat_messages')
                .select('order_id')
                .in('order_id', orderIds)
                .is('read_at', null)
                .eq('sender_role', senderToCount);

            if (error) throw error;

            const counts: Record<string, number> = {};
            data.forEach((msg: any) => {
                counts[msg.order_id] = (counts[msg.order_id] || 0) + 1;
            });
            return counts;
        },
        enabled: orderIds.length > 0,
        refetchInterval: false, // Egress Optimization: Stop aggressive polling
    });
};
