import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SavedCartData } from '@/types/pos';
import { useUserStore } from './useUserStore';
import { useUserProfile } from './useUserProfile';
import React, { useEffect, useRef } from 'react';

export const useSavedCart = () => {
  const { data: userStore, isLoading: isStoreLoading } = useUserStore();
  const { profile, isLoading: isProfileLoading } = useUserProfile();

  const isLoading = isStoreLoading || isProfileLoading || !userStore?.id || !profile?.id;

  const cacheKey = React.useMemo(() => {
    if (!userStore?.id || !profile?.id) return null;
    return `saved_cart_${userStore.id}_${profile.id}`;
  }, [userStore?.id, profile?.id]);

  const [savedCartData, setSavedCartData] = React.useState<SavedCartData | null>(null);

  // Sync cache data when store or profile changes
  React.useEffect(() => {
    if (cacheKey) {
      try {
        const stored = localStorage.getItem(cacheKey);
        setSavedCartData(stored ? JSON.parse(stored) : null);
      } catch (e) {
        console.error('Error parsing local cart:', e);
      }
    } else {
      setSavedCartData(null);
    }
  }, [cacheKey]);

  const saveCart = React.useCallback((cartData: SavedCartData) => {
    if (!cacheKey || !userStore?.id || !profile?.id) return;

    // Save locally immediately (takes <1ms, completely offline-capable)
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cartData));
      setSavedCartData(cartData);
    } catch (e) {
      console.error('Error writing cart to localStorage:', e);
    }

    // Backup to Supabase in the background (fire-and-forget, non-blocking)
    const syncToCloud = async () => {
      try {
        const storeId = userStore.id;
        const profileId = profile.id;
        await supabase
          .from('saved_carts')
          .upsert({
            profile_id: profileId,
            store_id: storeId,
            cart_data: cartData as any,
          }, {
            onConflict: 'store_id,profile_id'
          });
      } catch (err) {
        console.warn('Background saved_carts sync failed (offline or network error):', err);
      }
    };
    syncToCloud();
  }, [cacheKey, userStore?.id, profile?.id]);

  return React.useMemo(() => ({
    savedCartData,
    isLoading,
    saveCart,
    isSaving: false,
  }), [savedCartData, isLoading, saveCart]);
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
