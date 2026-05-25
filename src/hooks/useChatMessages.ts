import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { shopperSupabase } from '@/integrations/supabase/shopperClient';

export interface ChatMessage {
    id: string;
    order_id: string;
    store_id: string;
    sender_role: 'store' | 'customer';
    sender_name: string;
    message: string;
    read_at: string | null;
    created_at: string;
}

export const useChatMessages = (orderId: string | null, storeId: string | null, isShopper: boolean = false) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const client = isShopper ? shopperSupabase : supabase;

    useEffect(() => {
        if (!orderId) {
            setMessages([]);
            return;
        }

        const fetchMessages = async () => {
            setLoading(true);
            const { data, error } = await client
                .from('chat_messages')
                .select('*')
                .eq('order_id', orderId)
                .order('created_at', { ascending: true });

            if (!error && data) {
                setMessages(data as ChatMessage[]);
            }
            setLoading(false);
        };

        fetchMessages();

        // Subscribe to real-time updates
        const channel = client
            .channel(`chat:${orderId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `order_id=eq.${orderId}`,
                },
                (payload) => {
                    setMessages((current) => [...current, payload.new as ChatMessage]);
                }
            )
            .subscribe();

        return () => {
            client.removeChannel(channel);
        };
    }, [orderId, isShopper]);

    const sendMessage = async (message: string, senderName: string, senderRole: 'store' | 'customer') => {
        if (!orderId || !storeId || !message.trim()) return;

        const { error } = await client
            .from('chat_messages')
            .insert({
                order_id: orderId,
                store_id: storeId,
                sender_role: senderRole,
                sender_name: senderName,
                message: message.trim(),
            });

        if (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    };

    const markAsRead = async () => {
        if (!orderId) return;
        
        // Mark messages from the other side as read
        const otherRole = isShopper ? 'store' : 'customer';
        
        await client
            .from('chat_messages')
            .update({ read_at: new Date().toISOString() })
            .eq('order_id', orderId)
            .eq('sender_role', otherRole)
            .is('read_at', null);
    };

    return {
        messages,
        loading,
        sendMessage,
        markAsRead,
    };
};
