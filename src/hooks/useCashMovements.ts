
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CashMovement {
    id: string;
    store_id: string;
    profile_id: string;
    type: 'deposit' | 'withdrawal';
    amount: number;
    reason: string;
    created_at: string;
    profile?: {
        full_name: string;
    };
}

export const useCashMovements = (
    dateFrom?: Date | string, 
    userId?: string, 
    options?: { enabled?: boolean; refetchInterval?: number | false }
) => {
    let dateFilterIso: string | null = null;
    let queryDateKey: string | null = null;

    if (dateFrom) {
        if (dateFrom instanceof Date) {
            const buffer = new Date(dateFrom);
            buffer.setHours(buffer.getHours() - 12);
            dateFilterIso = buffer.toISOString();
            queryDateKey = dateFrom.toISOString().split('T')[0];
        } else if (typeof dateFrom === 'string') {
            if (dateFrom.includes('T')) {
                const d = new Date(dateFrom);
                if (!isNaN(d.getTime())) {
                    d.setHours(d.getHours() - 12);
                    dateFilterIso = d.toISOString();
                } else {
                    dateFilterIso = dateFrom;
                }
                queryDateKey = dateFrom.split('T')[0];
            } else {
                const d = new Date(dateFrom + 'T00:00:00');
                if (!isNaN(d.getTime())) {
                    d.setHours(d.getHours() - 12);
                    dateFilterIso = d.toISOString();
                } else {
                    dateFilterIso = dateFrom;
                }
                queryDateKey = dateFrom;
            }
        }
    }

    return useQuery({
        queryKey: ['cash-movements', queryDateKey, userId],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data: profile } = await supabase
                .from('profiles')
                .select('store_id')
                .eq('id', user.id)
                .maybeSingle();

            if (!profile?.store_id) return [];

            let query = supabase
                .from('cash_movements')
                .select('id, store_id, profile_id, type, amount, reason, created_at, profile:profiles(full_name)')
                .eq('store_id', profile.store_id)
                .order('created_at', { ascending: false });

            if (userId && userId !== 'all') {
                query = query.eq('profile_id', userId);
            }

            if (dateFilterIso) {
                query = query.gte('created_at', dateFilterIso);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data as CashMovement[];
        },
        enabled: options?.enabled !== undefined ? options.enabled : true,
        refetchInterval: options?.refetchInterval !== undefined ? options.refetchInterval : false,
    });
};

export const useCreateCashMovement = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (movement: { type: 'deposit' | 'withdrawal', amount: number, reason: string, created_at?: string }) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario no autenticado');

            const { data: profile } = await supabase
                .from('profiles')
                .select('store_id')
                .eq('id', user.id)
                .maybeSingle();

            if (!profile?.store_id) throw new Error('Usuario no asociado a una tienda');

            const { data, error } = await supabase
                .from('cash_movements')
                .insert({
                    store_id: profile.store_id,
                    profile_id: user.id,
                    type: movement.type,
                    amount: movement.amount,
                    reason: movement.reason,
                    ...(movement.created_at ? { created_at: movement.created_at } : {})
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
            queryClient.invalidateQueries({ queryKey: ['daily-closings'] });
            queryClient.invalidateQueries({ queryKey: ['cash-session-history'] });
            queryClient.invalidateQueries({ queryKey: ['store-open-sessions'] });
        },
    });
};

export const useDeleteCashMovement = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('cash_movements')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
            queryClient.invalidateQueries({ queryKey: ['daily-closings'] });
            queryClient.invalidateQueries({ queryKey: ['cash-session-history'] });
            queryClient.invalidateQueries({ queryKey: ['store-open-sessions'] });
        },
    });
};
