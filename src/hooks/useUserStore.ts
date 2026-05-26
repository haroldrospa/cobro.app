import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UserStore {
  id: string;
  store_code: string;
  store_name: string;
  slug: string;
  is_active: boolean;
  owner_id?: string;
  store_settings?: any;
}

const STORE_CACHE_KEY = 'cobro_user_store_cache';

// Helper to get cached store safely prefixed by user ID
const getCachedStore = (userId: string | undefined): UserStore | null => {
  if (!userId) return null;
  try {
    const cached = localStorage.getItem(`${STORE_CACHE_KEY}_${userId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Ensure the cached store actually has a valid UUID format before trusting it
      const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
      if (parsed && typeof parsed.id === 'string' && uuidRegex.test(parsed.id)) {
        return parsed;
      } else {
        localStorage.removeItem(`${STORE_CACHE_KEY}_${userId}`);
      }
    }
    return null;
  } catch {
    localStorage.removeItem(`${STORE_CACHE_KEY}_${userId}`);
    return null;
  }
};

export const useUserStore = () => {
  const { data: sessionData, isPending: isSessionPending } = useQuery({
    queryKey: ['auth-session'],
    queryFn: async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) return data.session;
      } catch (e) {
        console.warn("getSession failed (offline?)");
      }
      const lastUserId = localStorage.getItem('cobro_last_user_id');
      if (lastUserId) {
        return { user: { id: lastUserId } };
      }
      return null;
    },
    staleTime: 1000 * 60 * 30, // 30 min — session doesn't expire mid-session
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const userId = sessionData?.user?.id;

  const query = useQuery({
    queryKey: ['user-store', userId],
    staleTime: 1000 * 60 * 30,  // 30 min — store almost never changes mid-session
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,  // Don't re-fetch when switching browser tabs
    refetchOnMount: false,         // Use React Query cache on every navigation
    enabled: !isSessionPending,    // Wait for auth to resolve before determining if we have a user
    initialData: userId ? getCachedStore(userId) || undefined : undefined,
    queryFn: async () => {
      try {
        if (!userId) return null;

        const { data, error } = await supabase
          .from('profiles')
          .select(`
            store_id,
            stores:store_id (
              id,
              store_code,
              store_name,
              slug,
              is_active,
              owner_id,
              store_settings (*)
            )
          `)
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          if (error.message?.includes('AbortError') || error.code === '20') {
            return getCachedStore(userId);
          }
          if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
            return getCachedStore(userId);
          }
          console.error('Error loading user store:', error);
          throw error;
        }

        if (!data?.store_id || !data?.stores) {
          const { data: ownedStores, error: recoveryError } = await supabase
            .from('stores')
            .select(`
              id,
              store_code,
              store_name,
              slug,
              is_active,
              owner_id,
              store_settings (*)
            `)
            .eq('owner_id', userId)
            .limit(1);

          if (recoveryError) {
            console.error("Recovery failed:", recoveryError);
            return getCachedStore(userId);
          }

          if (ownedStores && ownedStores.length > 0) {
            const storeToLink = ownedStores[0];
            await supabase
              .from('profiles')
              .update({ store_id: storeToLink.id })
              .eq('id', userId);

            const storeData = storeToLink as any;
            if (Array.isArray(storeData.store_settings)) {
              storeData.store_settings = storeData.store_settings[0];
            }
            try {
              localStorage.setItem(`${STORE_CACHE_KEY}_${userId}`, JSON.stringify(storeData));
            } catch (e) {
              console.warn('Failed to cache store:', e);
            }
            return storeData as UserStore;
          }
          return getCachedStore(userId);
        }

        const storeData = data.stores as any;
        if (Array.isArray(storeData.store_settings)) {
          storeData.store_settings = storeData.store_settings[0];
        }
        try {
          localStorage.setItem(`${STORE_CACHE_KEY}_${userId}`, JSON.stringify(storeData));
        } catch (e) {
          console.warn('Failed to cache store:', e);
        }
        return storeData as UserStore;
      } catch (err: any) {
        console.error("Exception in userStore query:", err);
        return getCachedStore(userId);
      }
    },
  });

  return {
    ...query,
    userId
  };
};
