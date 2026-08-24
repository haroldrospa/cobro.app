import { useState, useEffect } from 'react';
import { shopperSupabase } from '@/integrations/supabase/shopperClient';

export interface ShopperProfile {
    name: string;
    phone: string;
    email: string;
    cedula: string;           // Cédula de identidad
    address: string;          // Dirección textual
    deliveryLat: number | null;   // Coordenada latitud GPS
    deliveryLng: number | null;   // Coordenada longitud GPS
    locationLabel: string;    // Etiqueta del punto (ej: "Mi Casa")
    locationUrl: string;      // Link de Google Maps
    notes: string;            // Notas para el repartidor
}

export const emptyProfile = (): ShopperProfile => ({
    name: '',
    phone: '',
    email: '',
    cedula: '',
    address: '',
    deliveryLat: null,
    deliveryLng: null,
    locationLabel: '',
    locationUrl: '',
    notes: '',
});

const STORAGE_KEY = 'shopper_profile_v2';

export const useShopperProfile = () => {
    const [profile, setProfile] = useState<ShopperProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            try {
                const { data: { session } } = await shopperSupabase.auth.getSession();

                if (session?.user) {
                    const { data, error } = await shopperSupabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .maybeSingle();

                    if (data && !error) {
                        const p: ShopperProfile = {
                            name: data.full_name || '',
                            phone: data.phone || '',
                            email: data.email || '',
                            cedula: data.cedula || '',
                            address: data.delivery_address || data.address || '',
                            deliveryLat: data.delivery_lat ?? null,
                            deliveryLng: data.delivery_lng ?? null,
                            locationLabel: data.delivery_location_label || '',
                            locationUrl: data.delivery_lat && data.delivery_lng
                                ? `https://www.google.com/maps?q=${data.delivery_lat},${data.delivery_lng}`
                                : '',
                            notes: data.delivery_notes || '',
                        };
                        setProfile(p);
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
                        setLoading(false);
                        return;
                    }
                }

                // Fallback to localStorage
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    try {
                        setProfile(JSON.parse(saved));
                    } catch (e) {
                        console.error('Error parsing shopper profile', e);
                    }
                }
            } catch (err) {
                console.warn('[useShopperProfile] fetchProfile error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();

        const { data: { subscription } } = shopperSupabase.auth.onAuthStateChange(() => {
            fetchProfile();
        });

        return () => subscription.unsubscribe();
    }, []);

    const saveProfile = async (newProfile: ShopperProfile) => {
        // Always persist locally first — works offline too
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
        setProfile(newProfile);

        const { data: { session } } = await shopperSupabase.auth.getSession();

        if (session?.user) {
            // Use RPC to bypass the broken sync_profile_to_customer trigger
            const { data, error } = await shopperSupabase
                .rpc('update_shopper_profile', {
                    p_full_name: newProfile.name || null,
                    p_phone: newProfile.phone || null,
                    p_address: newProfile.address || null,
                });

            if (error) {
                console.warn('[ShopperProfile] RPC unavailable, saved locally:', error.message);
            } else if (data && (data as any).success === false) {
                console.warn('[ShopperProfile] RPC error:', (data as any).error);
            }
        }
    };

    const clearProfile = async () => {
        localStorage.removeItem(STORAGE_KEY);
        setProfile(null);
    };

    /** Returns true if the profile has all required fields to place an order */
    const isProfileComplete = (p: ShopperProfile | null): boolean => {
        if (!p) return false;
        return !!(p.name?.trim() && p.phone?.trim() && p.cedula?.trim() && p.deliveryLat && p.deliveryLng);
    };

    return {
        profile,
        loading,
        saveProfile,
        clearProfile,
        isProfileComplete,
    };
};
