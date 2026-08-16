import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_KEY;

const SHOPPER_STORAGE_KEY = 'cobro-shopper-auth-token';

const customShopperFetch: typeof fetch = async (url, options) => {
  try {
    const response = await fetch(url, options);

    if (response.status === 401 && options?.headers) {
      const urlStr = typeof url === 'string' ? url : (url as any)?.url || '';
      const isAuthEndpoint = urlStr.includes('/auth/v1/');

      if (!isAuthEndpoint) {
        const headers = new Headers(options.headers);
        const authHeader = headers.get('Authorization');
        const anonBearer = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;

        if (authHeader && authHeader !== anonBearer) {
          headers.set('Authorization', anonBearer);
          try {
            return await fetch(url, { ...options, headers });
          } catch {
            return response;
          }
        }
      }
    }

    return response;
  } catch (err: any) {
    throw err;
  }
};

// Create a dedicated client for Shoppers (Customers) 
// with its own storage key to prevent session overlap with the App (Merchants)
export const shopperSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        // Unique key for shopper sessions
        storageKey: SHOPPER_STORAGE_KEY,
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
    },
    global: {
        fetch: customShopperFetch,
    },
    db: {
        schema: 'public'
    }
});
