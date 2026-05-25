import { useState, useEffect } from 'react';
import { shopperSupabase } from '@/integrations/supabase/shopperClient';
import { useToast } from '@/hooks/use-toast';

export const useShopperAuth = () => {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        // Get initial session
        shopperSupabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = shopperSupabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signUp = async (email: string, pass: string, fullName: string) => {
        setLoading(true);
        try {
            const { data, error } = await shopperSupabase.auth.signUp({
                email,
                password: pass,
                options: {
                    data: {
                        full_name: fullName,
                        role: 'customer'
                    }
                }
            });

            if (error) throw error;

            if (data.user) {
                // We should also ensure the profile exists with the correct role
                await shopperSupabase.from('profiles').upsert({
                    id: data.user.id,
                    full_name: fullName,
                    email: email,
                    role: 'customer'
                });
            }

            toast({
                title: "Registro exitoso",
                description: "Revisa tu correo para confirmar tu cuenta.",
            });
            return data;
        } catch (error: any) {
            toast({
                title: "Error al registrarse",
                description: error.message,
                variant: "destructive"
            });
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const signIn = async (email: string, pass: string) => {
        setLoading(true);
        try {
            const { data, error } = await shopperSupabase.auth.signInWithPassword({
                email,
                password: pass
            });

            if (error) throw error;

            toast({
                title: "Bienvenido",
                description: "Has iniciado sesión correctamente.",
            });
            return data;
        } catch (error: any) {
            toast({
                title: "Error al iniciar sesión",
                description: error.message,
                variant: "destructive"
            });
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        setLoading(true);
        try {
            const { error } = await shopperSupabase.auth.signOut();
            if (error) throw error;
            setUser(null);
            toast({
                title: "Sesión cerrada",
                description: "Vuelve pronto.",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return {
        user,
        loading,
        signUp,
        signIn,
        signOut
    };
};
