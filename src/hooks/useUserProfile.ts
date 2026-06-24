import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getSessionSafe } from '@/lib/authSession';

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  user_number: string | null;
  store_id: string | null;
  role: string | null;
  is_active: boolean | null;
  avatar_url?: string | null;
  rnc?: string | null;
  phone?: string | null;
}

const PROFILE_CACHE_KEY = 'cobro_user_profile_cache_v2';

// Read synchronously from localStorage — used as initialData so the component
// renders immediately without a loading state on every navigation.
const getLocalProfile = (userId: string): UserProfile | undefined => {
  try {
    const raw = localStorage.getItem(`${PROFILE_CACHE_KEY}_${userId}`);
    return raw ? (JSON.parse(raw) as UserProfile) : undefined;
  } catch {
    return undefined;
  }
};

const getLastUserId = (): string | null =>
  localStorage.getItem('cobro_last_user_id');

const fetchUserProfile = async (): Promise<UserProfile | null> => {
  // 1. Resolve current user using the safe session helper (retry + deduplication)
  let userId: string | null = null;

  try {
    const session = await getSessionSafe();
    userId = session?.user?.id ?? null;
  } catch {
    console.warn('[useUserProfile] getSessionSafe failed');
  }

  // Offline recovery: use last known user id
  if (!userId) {
    userId = getLastUserId();
    if (!userId) return null;
  }

  // Persist last known user id for next offline boot
  localStorage.setItem('cobro_last_user_id', userId);

  // 2. Fetch profile from DB
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, user_number, store_id, role, phone')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      // Return cached version on error rather than null
      return getLocalProfile(userId) ?? null;
    }

    if (!data) return null;

    let storeId = data.store_id;

    // Recovery: if store_id missing, look up owned store
    if (!storeId) {
      const { data: owned } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', userId)
        .limit(1);
      if (owned && owned.length > 0) {
        storeId = owned[0].id;
        // Update in background — don't await (keep startup fast)
        supabase.from('profiles').update({ store_id: storeId }).eq('id', userId).then();
      }
    }

    // Get avatar, rnc and phone from auth metadata if not in profiles
    let avatarUrl: string | null = null;
    let rnc: string | null = null;
    let metadataPhone: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      avatarUrl = user?.user_metadata?.avatar_url ?? null;
      rnc = user?.user_metadata?.rnc ?? null;
      metadataPhone = user?.user_metadata?.phone ?? null;
    } catch { /* ignore */ }

    const profile: UserProfile = {
      id: data.id,
      full_name: data.full_name,
      email: data.email,
      user_number: data.user_number,
      store_id: storeId,
      role: data.role,
      is_active: null,
      avatar_url: avatarUrl,
      rnc: rnc,
      phone: data.phone || metadataPhone,
    };

    // Persist to localStorage for next boot
    try {
      localStorage.setItem(`${PROFILE_CACHE_KEY}_${userId}`, JSON.stringify(profile));
    } catch { /* quota exceeded — ignore */ }

    return profile;
  } catch (err) {
    console.error('Exception fetching profile from DB:', err);
    return getLocalProfile(userId) ?? null;
  }
};

export const useUserProfile = () => {
  // Resolve userId synchronously for initialData lookup
  const cachedUserId = getLastUserId();
  const cachedProfile = cachedUserId ? getLocalProfile(cachedUserId) : undefined;

  const query = useQuery<UserProfile | null>({
    queryKey: ['user-profile'],
    queryFn: fetchUserProfile,
    // Render immediately from localStorage — no loading spinner on navigation
    initialData: cachedProfile ?? undefined,
    // 5 minutes — refrescar más seguido para capturar tokens renovados
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnMount: true,        // Refrescar al montar para capturar sesión actualizada
    refetchOnWindowFocus: false,
    // Retry twice on network/abort errors with increasing delay
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * (attempt + 1), 3000),
  });

  return {
    profile: query.data ?? null,
    loading: query.isLoading && !query.data,
    isLoading: query.isLoading && !query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.error
  };
};
