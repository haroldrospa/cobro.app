import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from './useUserStore';

export interface Subscription {
    plan_id: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    plan_name: string;
}

export const useSubscription = () => {
    const { data: store } = useUserStore();

    return useQuery({
        queryKey: ['company-subscription', store?.id],
        enabled: !!store?.id,
        queryFn: async () => {
            // 1. Fetch active subscription
            const { data, error } = await supabase
                .from('company_subscriptions')
                .select('plan_id, status, start_date, end_date')
                .eq('company_id', store?.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .maybeSingle();

            if (error || !data) {
                if (error) console.error('Error fetching subscription:', error);
                
                // Intento recuperar desde caché local si no hay internet o falla la red
                const cached = localStorage.getItem(`subscription_cache_${store?.id}`);
                if (cached) {
                    try {
                        return JSON.parse(cached) as Subscription;
                    } catch (e) {
                        // ignore parse error
                    }
                }

                // Default to basic on error if no cache exists to allow app usage
                return { plan_id: 'basic', status: 'active', start_date: null, end_date: null, plan_name: 'Emprendedor' } as Subscription;
            }

            // Map plan_id to readable name
            const planNames: Record<string, string> = {
                'basic': 'Emprendedor',
                'pro': 'Profesional',
                'enterprise': 'Empresarial'
            };

            const subscriptionData = {
                ...data,
                plan_name: planNames[data.plan_id || 'basic'] || 'Plan Desconocido'
            } as Subscription;

            // Guardar en caché para que no se ponga en basic cuando se pierde el internet
            localStorage.setItem(`subscription_cache_${store?.id}`, JSON.stringify(subscriptionData));

            return subscriptionData;
        }
    });
};
