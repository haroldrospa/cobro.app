import { useQuery } from '@tanstack/react-query';
import { shopperSupabase } from '@/integrations/supabase/shopperClient';

export interface Store {
  id: string;
  owner_id: string;
  store_code: string;
  store_name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  company_name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  slogan: string | null;
  meta_description: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_twitter: string | null;
}

export interface StoreWithSettings extends Store {
  company_settings: CompanySettings | CompanySettings[] | null;
  store_settings: any;
}

// Get store by slug
export const useStoreBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: ['store', 'slug', slug],
    queryFn: async () => {
      if (!slug) return null;

      try {
        const { data: storeData, error } = await shopperSupabase
          .from('stores')
          .select(`
            *,
            company_settings (
              company_name,
              logo_url,
              phone,
              email,
              address,
              slogan,
              meta_description,
              social_facebook,
              social_instagram,
              social_twitter
            )
          `)
          .eq('slug', slug)
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!storeData) return null;

        // Manually fetch store settings
        const { data: settingsData } = await shopperSupabase
          .from('store_settings')
          .select('*')
          .eq('store_id', storeData.id)
          .maybeSingle();

        const result = {
          ...storeData,
          store_settings: settingsData ? [settingsData] : []
        } as StoreWithSettings;

        // Persist to local cache for offline support
        localStorage.setItem(`store_cache_slug_${slug}`, JSON.stringify(result));
        return result;
      } catch (err) {
        // Fallback to local cache if network fails
        const cached = localStorage.getItem(`store_cache_slug_${slug}`);
        if (cached) {
          console.log("Network error, using cached store data for slug:", slug);
          return JSON.parse(cached) as StoreWithSettings;
        }
        throw err;
      }
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });
};

// Get store by store_code (for customer lookup)
export const useStoreByStoreCode = (storeCode: string | undefined) => {
  return useQuery({
    queryKey: ['store', 'store-code', storeCode],
    queryFn: async () => {
      if (!storeCode) return null;

      try {
        const { data, error } = await shopperSupabase
          .from('stores')
          .select(`
            *,
            company_settings (
              company_name,
              logo_url,
              phone,
              email,
              address,
              slogan,
              meta_description,
              social_facebook,
              social_instagram,
              social_twitter
            )
          `)
          .eq('store_code', storeCode)
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) return null;

        // Persist to local cache for offline support
        localStorage.setItem(`store_cache_code_${storeCode}`, JSON.stringify(data));
        return data as StoreWithSettings;
      } catch (err) {
        // Fallback to local cache if network fails
        const cached = localStorage.getItem(`store_cache_code_${storeCode}`);
        if (cached) {
          console.log("Network error, using cached store data for code:", storeCode);
          return JSON.parse(cached) as StoreWithSettings;
        }
        throw err;
      }
    },
    enabled: !!storeCode,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });
};

// Backward compatible alias (previously searched by profiles.user_number)
export const useStoreByUserNumber = (userNumber: string | undefined) => {
  return useStoreByStoreCode(userNumber);
};
