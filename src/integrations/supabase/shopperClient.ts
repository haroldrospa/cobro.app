import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_KEY;

// Create a dedicated client for Shoppers (Customers) 
// with its own storage key to prevent session overlap with the App (Merchants)
export const shopperSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        // Unique key for shopper sessions
        storageKey: 'cobro-shopper-auth-token',
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
    },
    global: {
        headers: {
            'Content-Type': 'application/json',
        },
    },
    db: {
        schema: 'public'
    }
});
