import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  user_number: string | null;
  store_id: string | null;
  role: string | null;
  is_active: boolean | null;
  avatar_url?: string | null;
}

const PROFILE_CACHE_KEY = 'cobro_user_profile_cache';

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
  // 1. Resolve current user (try session first, then getUser, then offline fallback)
  let userId: string | null = null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    userId = session?.user?.id ?? null;
  } catch {
    console.warn('getSession failed (offline?)');
  }

  if (!userId) {
    try {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      console.warn('getUser failed (offline?)');
    }
  }

  // Offline recovery: use last known user id
  if (!userId) {
    userId = getLastUserId();
    if (!userId) return null;
  }

  // Persist last known user id for next offline boot
  localStorage.setItem('cobro_last_user_id', userId);

  // 2. Fetch profile from DB
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, user_number, store_id, role')
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

  // Get avatar from auth metadata (no extra fetch needed)
  let avatarUrl: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    avatarUrl = user?.user_metadata?.avatar_url ?? null;
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
  };

  // Persist to localStorage for next boot
  try {
    localStorage.setItem(`${PROFILE_CACHE_KEY}_${userId}`, JSON.stringify(profile));
  } catch { /* quota exceeded — ignore */ }

  return profile;
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
    // 30 minutes fresh — profile almost never changes mid-session
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    // Retry once on network errors (not immediately)
    retry: 1,
    retryDelay: 2000,
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
