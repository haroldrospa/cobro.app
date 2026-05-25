import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SavedCartData } from '@/types/pos';
import { useUserStore } from './useUserStore';
import { useUserProfile } from './useUserProfile';
import React, { useEffect, useRef } from 'react';

export const useSavedCart = () => {
  const { data: userStore } = useUserStore();
  const { profile } = useUserProfile();
  const queryClient = useQueryClient();

  const { data: savedCartData, isLoading } = useQuery({
    queryKey: ['saved-cart', userStore?.id, profile?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !userStore?.id) return null;

      const { data, error } = await supabase
        .from('saved_carts')
        .select('cart_data')
        .eq('profile_id', user.id)
        .eq('store_id', userStore.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading saved cart:', error);
        return null;
      }

      return (data?.cart_data as unknown as SavedCartData) || null;
    },
    enabled: !!userStore?.id && !!profile?.id,
  });

  const saveCartMutation = useMutation({
    mutationFn: async (cartData: SavedCartData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !userStore?.id) throw new Error('No user or store');

      const { error } = await supabase
        .from('saved_carts')
        .upsert({
          profile_id: user.id,
          store_id: userStore.id,
          cart_data: cartData as any,
        }, {
          onConflict: 'store_id,profile_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-cart', userStore?.id, profile?.id] });
    },
  });

  return React.useMemo(() => ({
    savedCartData,
    isLoading,
    saveCart: saveCartMutation.mutate,
    isSaving: saveCartMutation.isPending,
  }), [savedCartData, isLoading, saveCartMutation.mutate, saveCartMutation.isPending]);
};

// Hook para auto-guardar el carrito completo con metadata
export const useAutoSaveCart = (cartData: SavedCartData, enabled: boolean = true) => {
  const { saveCart } = useSavedCart();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const { data: userStore } = useUserStore();

  useEffect(() => {
    if (!userStore?.id || !enabled) return;

    // Debounce: guardar después de 2 segundos de inactividad
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveCart(cartData);
    }, 2000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [cartData, saveCart, userStore?.id, enabled]);
};
