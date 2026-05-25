import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { shopperSupabase } from '@/integrations/supabase/shopperClient';
import { useToast } from '@/hooks/use-toast';
import { playNotificationSound } from '@/utils/notificationSounds';
import { useQueryClient } from '@tanstack/react-query';

interface UseChatNotificationsProps {
    storeId?: string | null;
    orderIds?: string[];
    role: 'store' | 'customer';
    enabled?: boolean;
}

export const useChatNotifications = ({
    storeId,
    orderIds = [],
    role,
    enabled = true
}: UseChatNotificationsProps) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const client = role === 'customer' ? shopperSupabase : supabase;

    useEffect(() => {
        if (!enabled) return;
        if (role === 'store' && !storeId) return;
        if (role === 'customer' && orderIds.length === 0) return;

        console.log(`💬 Subscribing to chat notifications for ${role}...`);

        const channelId = role === 'store' ? `store-chats-${storeId}` : `customer-chats-${orderIds.join('-')}`;
        
        // Construct filter
        let filter = '';
        if (role === 'store') {
            filter = `store_id=eq.${storeId}`;
        } else {
            // Realtime doesn't support 'IN' filters easily in a single subscription filter string
            // but we can listen to all and filter client-side, or create multiple channels.
            // For now, let's listen to all chat messages and filter by orderIds client-side.
        }

        const channel = client
            .channel(channelId)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    // If store, we can filter by store_id
                    filter: role === 'store' ? `store_id=eq.${storeId}` : undefined,
                },
                (payload) => {
                    const newMessage = payload.new as any;
                    
                    // Filter by orderIds if customer
                    if (role === 'customer' && !orderIds.includes(newMessage.order_id)) return;

                    // Skip if the message was sent by the current role
                    if (newMessage.sender_role === role) return;

                    console.log('📩 New chat message notification:', newMessage);

                    // Play sound
                    playNotificationSound('ding', true, 0.8);

                    // Show toast
                    toast({
                        title: `💬 Nuevo mensaje de ${newMessage.sender_name}`,
                        description: newMessage.message.length > 50 
                            ? newMessage.message.substring(0, 50) + '...' 
                            : newMessage.message,
                        duration: 5000,
                    });

                    // Invalidate queries to update unread badges
                    queryClient.invalidateQueries({ queryKey: ['chat_messages'] });
                    queryClient.invalidateQueries({ queryKey: ['unread_chat_counts'] });
                    queryClient.invalidateQueries({ queryKey: ['web-orders'] });
                    queryClient.invalidateQueries({ queryKey: ['shopper-orders'] });
                }
            )
            .subscribe();

        return () => {
            console.log(`🔕 Unsubscribing from chat notifications for ${role}`);
            client.removeChannel(channel);
        };
    }, [storeId, JSON.stringify(orderIds), role, enabled, toast, queryClient]);
};
