import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Use same interface structure for compatibility, mapped from cash_sessions
export interface DailyClosing {
    id: string;
    closing_time: string;
    created_at: string;
    total_sales_cash: number;
    total_sales_card: number;
    total_sales_transfer: number;
    total_sales_other: number;
    total_refunds: number;
    total_cash_in: number;
    total_cash_out: number;
    expected_cash: number;
    actual_cash: number;
    difference: number;
    notes?: string;
    profile?: {
        full_name: string;
    };
    initial_cash?: number; // New field
}

export const useDailyClosings = () => {
    return useQuery({
        queryKey: ['daily-closings'], // Keep same key for reports compatibility
        queryFn: async () => {
            // Fetch from cash_sessions where closed
            // @ts-ignore
            const { data, error } = await supabase
                .from('cash_sessions')
                .select('*, profile:closed_by(full_name)')
                .eq('status', 'closed')
                .order('closed_at', { ascending: false });

            if (error) throw error;

            // Map to DailyClosing interface
            return data.map((session: any) => ({
                id: session.id,
                closing_time: session.closed_at,
                created_at: session.opened_at, // Mapping opened_at as created_at for history view or use closed_at
                total_sales_cash: session.total_sales_cash,
                total_sales_card: session.total_sales_card,
                total_sales_transfer: session.total_sales_transfer,
                total_sales_other: session.total_sales_other,
                total_refunds: session.total_refunds,
                total_cash_in: session.total_cash_in,
                total_cash_out: session.total_cash_out,
                expected_cash: session.expected_cash,
                actual_cash: session.actual_cash,
                difference: session.difference,
                notes: session.notes,
                profile: session.profile,
                initial_cash: session.initial_cash
            })) as DailyClosing[];
        },
    });
};

// Deprecated: useCloseSession in useCashSession.ts instead
export const useCreateDailyClosing = () => {
    // This is now legacy/unused by the new UI, but kept to prevent breakages if called elsewhere
    return {
        mutateAsync: async (data: any) => {
            console.warn('useCreateDailyClosing is deprecated. Use useCloseSession instead.');
        },
        isPending: false
    }
};
