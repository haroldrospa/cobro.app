import React, { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { playNotificationSound, NotificationSoundType } from '@/utils/notificationSounds';

interface UseWebOrderNotificationsProps {
  storeId: string | null | undefined;
  enabled?: boolean;
  soundEnabled?: boolean;
  soundType?: NotificationSoundType;
  soundVolume?: number;
  onNewOrder?: (order: any) => void;
}

export const useWebOrderNotifications = ({
  storeId,
  enabled = true,
  soundEnabled = true,
  soundType = 'chime',
  soundVolume = 0.7,
  onNewOrder
}: UseWebOrderNotificationsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use a ref for the callback to avoid re-subscribing when the function identity changes
  const onNewOrderRef = React.useRef(onNewOrder);

  // Update ref when callback changes
  useEffect(() => {
    onNewOrderRef.current = onNewOrder;
  }, [onNewOrder]);

  useEffect(() => {
    if (!enabled || !storeId) return;

    console.log('🔔 Subscribing to web orders for store:', storeId);

    const channel = supabase
      .channel('web-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes
          schema: 'public',
          table: 'open_orders',
        },
        (payload) => {
          console.log('📨 Realtime event received:', payload);
          const newOrder = (payload.new || payload.old) as any;

          // Re-validate queries for any change
          queryClient.invalidateQueries({ queryKey: ['web-orders'] });
          queryClient.invalidateQueries({ queryKey: ['web-orders-count'] });

          // Only skip if storeId is present and doesn't match
          if (storeId && newOrder.store_id !== storeId) return;

          // For NEW orders (INSERT)
          if (payload.eventType === 'INSERT') {
            console.log('🆕 NEW Order received:', newOrder);

            // Play notification sound
            playNotificationSound(soundType, soundEnabled, soundVolume);

            // Show toast notification for new order
            toast({
              title: "🔔 ¡Nuevo Pedido Web!",
              description: `Pedido ${newOrder.order_number} de ${newOrder.customer_name}`,
              duration: 5000,
            });

            // Optimistically update the count if it matches
            if (newOrder.source?.toLowerCase() === 'web') {
              queryClient.setQueryData(['web-orders-count', storeId], (old: number | undefined) => (old || 0) + 1);
            }

            // Custom callback
            if (onNewOrderRef.current) {
              onNewOrderRef.current(newOrder);
            }
          }

          // For status updates (UPDATE)
          if (payload.eventType === 'UPDATE') {
            const oldOrder = payload.old as any;
            if (newOrder.order_status !== oldOrder?.order_status) {
              console.log('📝 Order status updated:', newOrder.order_number, newOrder.order_status);

              // If status became completed/cancelled, update count
              if (['completed', 'cancelled'].includes(newOrder.order_status)) {
                queryClient.invalidateQueries({ queryKey: ['web-orders-count'] });
              }
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return () => {
      console.log('🔕 Unsubscribing from web orders');
      supabase.removeChannel(channel);
    };
  }, [storeId, enabled, soundEnabled, soundType, soundVolume, toast, queryClient]);
};
