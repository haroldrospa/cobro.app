import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getSessionSafe } from '@/lib/authSession';

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

/**
 * Obtiene el userId de forma segura:
 * 1. Intenta obtener la sesión real de Supabase (con reintentos ante AbortError)
 * 2. Fallback al último userId conocido en localStorage
 */
const resolveUserId = async (): Promise<string | null> => {
  // Intentar sesión real primero
  const session = await getSessionSafe();
  if (session?.user?.id) return session.user.id;

  // Fallback offline: último userId conocido
  return localStorage.getItem('cobro_last_user_id');
};

export const useUserStore = () => {
  // Query de sesión: usa el helper seguro con deduplicación y reintentos
  const { data: sessionData, isPending: isSessionPending } = useQuery({
    queryKey: ['auth-session'],
    queryFn: async () => {
      const session = await getSessionSafe();
      if (session) return session;

      // Fallback: devolver objeto mínimo con el userId cacheado
      const lastUserId = localStorage.getItem('cobro_last_user_id');
      if (lastUserId) {
        return { user: { id: lastUserId } } as any;
      }
      return null;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,        // Siempre verificar la sesión al montar
    refetchOnWindowFocus: true,  // Verificar cuando el usuario vuelve a la pestaña
    retry: 2,
    retryDelay: 500,
  });

  const userId = sessionData?.user?.id;

  const query = useQuery({
    queryKey: ['user-store', userId],
    staleTime: 1000 * 10,  // 10 segundos para re-verificar pero evitar spam inmediato
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    enabled: !isSessionPending && !!userId,    // Wait for auth to resolve before determining if we have a user
    initialData: userId ? getCachedStore(userId) || undefined : undefined,
    retry: (failureCount, error: any) => {
      // Reintentar hasta 2 veces, pero no si es error de validación de datos
      if (failureCount >= 2) return false;
      const msg = error?.message ?? '';
      if (msg.includes('406') || msg.includes('PGRST116')) return false;
      return true;
    },
    retryDelay: 1000,
    queryFn: async () => {
      try {
        // Si no tenemos userId todavía, intentar resolverlo
        const effectiveUserId = userId || await resolveUserId();
        if (!effectiveUserId) return null;

        // Verificar que la sesión sea válida antes de hacer la query
        const session = await getSessionSafe();
        if (!session) {
          // Sin sesión válida, usar cache local
          console.warn('[useUserStore] Sin sesión válida, usando cache local');
          return getCachedStore(effectiveUserId);
        }

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
          .eq('id', effectiveUserId)
          .maybeSingle();

        if (error) {
          // Auth/JWT errors → intentar refrescar sesión y usar cache
          const isAuthError = error.code === 'PGRST301' ||
            error.message?.includes('JWT') ||
            error.message?.includes('not authenticated') ||
            error.message?.includes('invalid claim') ||
            (error as any).status === 401;

          if (isAuthError) {
            console.warn('[useUserStore] Error de autenticación, refrescando sesión...');
            try {
              await supabase.auth.refreshSession();
            } catch { /* ignore */ }
            return getCachedStore(effectiveUserId);
          }

          if (error.message?.includes('AbortError') || error.code === '20') {
            return getCachedStore(effectiveUserId);
          }
          if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
            return getCachedStore(effectiveUserId);
          }
          console.error('Error loading user store:', error);
          // En lugar de throw (que deshabilitaría futuras queries), retornar cache
          return getCachedStore(effectiveUserId);
        }

        // Fallback robusto en caso de que exista store_id pero la consulta de stores devuelva null (debido a RLS o BD desactualizada)
        if (data?.store_id && !data?.stores) {
          console.warn('[useUserStore] store_id fue encontrado pero el registro de stores regresó null (posiblemente por políticas RLS). Usando fallback.');
          const cached = getCachedStore(effectiveUserId);
          if (cached && cached.id === data.store_id) {
            return cached;
          }
          return {
            id: data.store_id,
            store_code: 'STORE',
            store_name: 'Mi Tienda',
            slug: 'mi-tienda',
            is_active: true,
          } as UserStore;
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
            .eq('owner_id', effectiveUserId)
            .limit(1);

          if (recoveryError) {
            console.error("Recovery failed:", recoveryError);
            return getCachedStore(effectiveUserId);
          }

          if (ownedStores && ownedStores.length > 0) {
            const storeToLink = ownedStores[0];
            await supabase
              .from('profiles')
              .update({ store_id: storeToLink.id })
              .eq('id', effectiveUserId);

            const storeData = storeToLink as any;
            if (Array.isArray(storeData.store_settings)) {
              storeData.store_settings = storeData.store_settings[0];
            }
            try {
              localStorage.setItem(`${STORE_CACHE_KEY}_${effectiveUserId}`, JSON.stringify(storeData));
            } catch (e) {
              console.warn('Failed to cache store:', e);
            }
            return storeData as UserStore;
          }
          return getCachedStore(effectiveUserId);
        }

        const storeData = data.stores as any;
        if (Array.isArray(storeData.store_settings)) {
          storeData.store_settings = storeData.store_settings[0];
        }
        try {
          localStorage.setItem(`${STORE_CACHE_KEY}_${effectiveUserId}`, JSON.stringify(storeData));
        } catch (e) {
          console.warn('Failed to cache store:', e);
        }
        return storeData as UserStore;
      } catch (err: any) {
        console.error("Exception in userStore query:", err);
        const fallbackId = userId || localStorage.getItem('cobro_last_user_id') || undefined;
        return getCachedStore(fallbackId);
      }
    },
  });

  return {
    ...query,
    userId
  };
};
