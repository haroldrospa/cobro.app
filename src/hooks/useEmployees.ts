
export interface DeductionDetail {
    amount: number;
    reason: string;
}

export interface Employee {
    id: string;
    email: string;
    full_name: string;
    role: 'admin' | 'manager' | 'cashier' | 'staff' | 'kitchen' | 'delivery' | 'accountant';
    is_active: boolean;
    created_at: string;
    base_salary?: number;
    tss?: number;
    infotep?: number;
    default_deduction?: number;
    default_deduction_note?: string;

    // Legacy support
    apply_afp?: boolean;
    apply_sfs?: boolean;
    apply_isr?: boolean;

    // New detailed structure
    default_deductions_details?: DeductionDetail[];
    
    // Credit System
    credit_limit?: number;
    credit_used?: number;
    customer_id?: string;
    cedula?: string;

    // Payroll inclusion: false = has app access but should never get a
    // payroll_item generated (e.g. no salary). Undefined/true = included.
    include_in_payroll?: boolean;
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/hooks/useUserStore';

export const useEmployees = () => {
    const { data: store } = useUserStore();
    const isUUID = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const storeId = store?.id;

    const { data, isLoading, error } = useQuery({
        queryKey: ['employees', storeId],
        queryFn: async () => {
            if (!isUUID(storeId)) return [];
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('store_id', storeId)
                .order('full_name');

            if (error) {
                // Suppress red console errors when offline
                if (!navigator.onLine || error.message?.includes('Failed to fetch') || error.message?.includes('Load failed')) {
                    console.warn("Network error fetching employees (offline mode):", error.message);
                    return [];
                }
                console.error("Error fetching employees:", error);
                throw error;
            }

            // Map ensure array is present with robust fallback/recovery logic
            return data.map((emp: any) => {
                let details: DeductionDetail[] = [];

                // 1. Try native JSONB column
                if (Array.isArray(emp.default_deductions_details) && emp.default_deductions_details.length > 0) {
                    details = emp.default_deductions_details as DeductionDetail[];
                } else {
                    // 2. Try recovering from Note (Polyfill)
                    if (emp.default_deduction_note && emp.default_deduction_note.trim().startsWith('[')) {
                        try {
                            const parsed = JSON.parse(emp.default_deduction_note);
                            if (Array.isArray(parsed)) details = parsed;
                        } catch (e) {
                            // ignore parse error 
                        }
                    }
                }

                // 3. Fallback to legacy scalar if details are still empty
                if (details.length === 0 && (emp.default_deduction || 0) > 0) {
                    details = [{
                        amount: emp.default_deduction,
                        reason: (emp.default_deduction_note && !emp.default_deduction_note.startsWith('['))
                            ? emp.default_deduction_note
                            : "Deducción General"
                    }];
                }

                return {
                    ...emp,
                    default_deductions_details: details
                };
            }) as Employee[];
        },
        enabled: !!storeId,
        staleTime: 1000 * 30, // 30s
        gcTime: 1000 * 60 * 60 * 24,
    });

    return {
        data: data ?? [],
        isLoading,
        error
    };
};

// Hook for managing employee operations (create, update, toggle_status)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface ManageEmployeePayload {
    action: 'create' | 'update' | 'toggle_status' | 'delete';
    id?: string;
    fullName?: string;
    email?: string;
    password?: string;
    role?: 'admin' | 'manager' | 'cashier' | 'staff' | 'kitchen' | 'delivery' | 'accountant';
    isActive?: boolean;
    cedula?: string;
    includeInPayroll?: boolean;
}

export const useManageEmployee = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (payload: ManageEmployeePayload) => {
            // ── 1. Call edge function (handles name, role, email, password, etc.) ──
            let edgeFunctionError: string | null = null;
            let createdUserId: string | undefined;

            try {
                const { data, error } = await supabase.functions.invoke('manage-employees', {
                    body: payload
                });
                if (error) edgeFunctionError = error.message;
                else if (data?.error) edgeFunctionError = data.error;
                else createdUserId = data?.userId;
            } catch (e: any) {
                edgeFunctionError = e.message;
            }

            // If the edge function failed due to a non-trigger error, abort
            if (edgeFunctionError) {
                const isTriggerError = edgeFunctionError.toLowerCase().includes('customer_id') ||
                    edgeFunctionError.toLowerCase().includes('record') ||
                    edgeFunctionError.toLowerCase().includes('trigger') ||
                    edgeFunctionError.toLowerCase().includes('field');
                if (!isTriggerError) {
                    throw new Error(edgeFunctionError);
                }
                console.warn('Edge function trigger error (ignored):', edgeFunctionError);
            }

            // ── 2. Save cedula via RPC (SECURITY DEFINER bypasses RLS) ──
            // Direct table update doesn't work due to RLS. RPC is required.
            const targetId = payload.action === 'update'
                ? payload.id
                : (payload.action === 'create' ? createdUserId : undefined);

            if (payload.cedula !== undefined && targetId) {
                const { error: rpcError, data: rpcResult } = await supabase.rpc('update_profile_cedula', {
                    p_profile_id: targetId,
                    p_cedula: payload.cedula
                });

                if (rpcError) {
                    throw new Error('Error al conectar con DB: ' + rpcError.message);
                }
                
                if (rpcResult === false) {
                    throw new Error('Error: La base de datos rechazó el cambio. Ejecuta de nuevo el archivo SQL.');
                }
                
                if (typeof rpcResult === 'string' && rpcResult !== 'OK') {
                    throw new Error('Error guardando cédula: ' + rpcResult);
                }
            }

            // ── 3. Save "include in payroll" flag (direct update; profiles UPDATE
            // triggers were made trigger-safe, so this doesn't need an RPC like cedula) ──
            if (payload.includeInPayroll !== undefined && targetId) {
                const { error: payrollFlagError } = await (supabase
                    .from('profiles')
                    .update({ include_in_payroll: payload.includeInPayroll } as any) as any)
                    .eq('id', targetId);

                if (payrollFlagError) {
                    // Non-fatal: don't block the rest of the employee save over this flag
                    // (e.g. if the migration adding the column hasn't run yet).
                    console.warn('No se pudo guardar el estado de nómina:', payrollFlagError.message);
                }
            }

            return { success: true, targetId };

        },
        onSuccess: (_, variables) => {
            // Force immediate refetch (not just invalidate) to see new cedula right away
            queryClient.refetchQueries({ queryKey: ['employees'] });

            const messages = {
                create: 'Empleado creado exitosamente',
                update: 'Empleado actualizado exitosamente',
                toggle_status: 'Estado del empleado actualizado',
                delete: 'Empleado eliminado permanentemente'
            };

            toast({
                title: 'Éxito',
                description: messages[variables.action],
            });
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Hubo un problema al gestionar el empleado',
                variant: 'destructive',
            });
        },
    });
};

export const useManageEmployeeCredit = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, amount, action }: { id: string, amount: number, action: 'add' | 'set' | 'pay' }) => {
            if (action === 'set') {
                const { error } = await (supabase.from('profiles').update({ credit_used: amount } as any) as any).eq('id', id);
                if (error) throw error;
                return;
            }

            // Using the RPC if it exists, otherwise fallback to read/write natively since Edge Functions are not needed for simple updates
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single();
            const currentCredit = (profile as any)?.credit_used || 0;
            const newCredit = action === 'add' ? currentCredit + amount : Math.max(0, currentCredit - amount);

            const { error } = await (supabase.from('profiles').update({ credit_used: newCredit } as any) as any).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            toast({ title: 'Crédito Actualizado', description: 'El balance del empleado ha sido actualizado.' });
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.message || 'No se pudo actualizar el crédito.', variant: 'destructive' });
        }
    });
};
