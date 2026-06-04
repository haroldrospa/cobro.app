import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from './useUserStore';
import { useToast } from './use-toast';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';

export interface FixedExpense {
    id: string;
    store_id: string;
    description: string;
    amount: number;
    category: string;
    due_day: number;
    is_active: boolean;
    created_at: string;
    synced?: boolean | number;
}

export type CreateFixedExpenseDTO = Omit<FixedExpense, 'id' | 'created_at' | 'store_id' | 'is_active'> & {
    created_at?: string;
    store_id?: string;
    is_active?: boolean;
};

export const useFixedExpenses = () => {
    const { data: userStore } = useUserStore();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Fetch fixed expenses from Supabase / Local
    const { data: fixedExpenses = [], isLoading } = useQuery({
        queryKey: ['fixed_expenses', userStore?.id],
        queryFn: async () => {
            if (!userStore?.id) return [];

            // 1. Fetch from Supabase if online
            let supabaseData: any[] = [];
            let fetchError = null;

            if (navigator.onLine) {
                const { data, error } = await supabase
                    .from('fixed_expenses' as any)
                    .select('*')
                    .eq('store_id', userStore.id)
                    .order('due_day', { ascending: true });

                if (error) {
                    console.error('Error loading fixed expenses from server:', error);
                    fetchError = error;
                } else {
                    supabaseData = data || [];
                }
            }

            // Transform Server Data
            const formattedSupabase = supabaseData.map((item: any) => ({
                ...item,
                amount: typeof item.amount === 'number' ? item.amount : parseFloat(item.amount) || 0,
                due_day: Number(item.due_day)
            })) as FixedExpense[];

            // 2. Fetch Local Unsynced/Cached Fixed Expenses
            let localData: any[] = [];
            try {
                localData = await offlineDB.getAll(OfflineStore.FIXED_EXPENSES);
                // Filter for this store specifically
                localData = localData.filter((item: any) => item.store_id === userStore.id);
            } catch (e) {
                console.warn("Could not fetch local fixed expenses:", e);
            }

            const formattedLocal = localData.map((item: any) => ({
                ...item,
                amount: Number(item.amount),
                due_day: Number(item.due_day)
            })) as FixedExpense[];

            // Merge server and local data
            const allFixed = [...formattedLocal, ...formattedSupabase];
            const uniqueMap = new Map();
            allFixed.forEach(fx => uniqueMap.set(fx.id, fx));

            return Array.from(uniqueMap.values()).sort((a: any, b: any) => a.due_day - b.due_day) as FixedExpense[];
        },
        enabled: !!userStore?.id,
    });

    // Create fixed expense mutation
    const createFixedExpenseMutation = useMutation({
        mutationFn: async (newFixed: CreateFixedExpenseDTO) => {
            const tempId = crypto.randomUUID();
            const storeId = userStore?.id;

            const fixedToSave = {
                id: tempId,
                store_id: storeId,
                description: newFixed.description,
                amount: newFixed.amount,
                category: newFixed.category,
                due_day: Number(newFixed.due_day),
                is_active: newFixed.is_active ?? true,
                created_at: newFixed.created_at || new Date().toISOString(),
                synced: 0
            };

            // Save in IndexedDB first
            await offlineDB.put(OfflineStore.FIXED_EXPENSES, fixedToSave);

            if (navigator.onLine && storeId) {
                try {
                    const { data, error } = await supabase
                        .from('fixed_expenses' as any)
                        .insert({
                            ...fixedToSave,
                            synced: undefined
                        })
                        .select()
                        .single();

                    if (error) throw error;

                    const saved = { ...fixedToSave, ...data, synced: 1 };
                    await offlineDB.put(OfflineStore.FIXED_EXPENSES, saved);
                    return saved;
                } catch (error: any) {
                    console.error('Error saving fixed expense on server:', error);
                    // Queue for sync later
                    await offlineDB.addToSyncQueue({
                        store: OfflineStore.FIXED_EXPENSES,
                        operation: 'CREATE',
                        data: fixedToSave
                    });
                    return fixedToSave;
                }
            } else {
                // Queue for sync offline
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.FIXED_EXPENSES,
                    operation: 'CREATE',
                    data: fixedToSave
                });
                return fixedToSave;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fixed_expenses'] });
            toast({
                title: "Gasto fijo guardado",
                description: "Se ha registrado el gasto recurrente correctamente.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "No se pudo registrar el gasto fijo.",
                variant: "destructive",
            });
        }
    });

    // Update fixed expense mutation
    const updateFixedExpenseMutation = useMutation({
        mutationFn: async (updatedFixed: FixedExpense) => {
            const storeId = userStore?.id;
            const updatedObj = {
                ...updatedFixed,
                synced: 0
            };

            await offlineDB.put(OfflineStore.FIXED_EXPENSES, updatedObj);

            if (navigator.onLine && storeId) {
                try {
                    const { synced, ...payload } = updatedObj;
                    const { data, error } = await supabase
                        .from('fixed_expenses' as any)
                        .update(payload)
                        .eq('id', updatedFixed.id)
                        .select()
                        .single();

                    if (error) throw error;

                    const saved = { ...updatedObj, ...data, synced: 1 };
                    await offlineDB.put(OfflineStore.FIXED_EXPENSES, saved);
                    return saved;
                } catch (error: any) {
                    console.error('Error updating fixed expense on server:', error);
                    await offlineDB.addToSyncQueue({
                        store: OfflineStore.FIXED_EXPENSES,
                        operation: 'UPDATE',
                        data: updatedObj
                    });
                    return updatedObj;
                }
            } else {
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.FIXED_EXPENSES,
                    operation: 'UPDATE',
                    data: updatedObj
                });
                return updatedObj;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fixed_expenses'] });
            toast({
                title: "Gasto fijo actualizado",
                description: "Cambios guardados exitosamente.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "No se pudo actualizar.",
                variant: "destructive",
            });
        }
    });

    // Delete fixed expense mutation
    const deleteFixedExpenseMutation = useMutation({
        mutationFn: async (id: string) => {
            await offlineDB.delete(OfflineStore.FIXED_EXPENSES, id);

            if (navigator.onLine) {
                try {
                    const { error } = await supabase
                        .from('fixed_expenses' as any)
                        .delete()
                        .eq('id', id);

                    if (error) throw error;
                } catch (error: any) {
                    console.error('Error deleting fixed expense from server:', error);
                    await offlineDB.addToSyncQueue({
                        store: OfflineStore.FIXED_EXPENSES,
                        operation: 'DELETE',
                        data: { id }
                    });
                }
            } else {
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.FIXED_EXPENSES,
                    operation: 'DELETE',
                    data: { id }
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fixed_expenses'] });
            toast({
                title: "Gasto fijo eliminado",
                description: "Se ha eliminado de la lista de gastos fijos.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "No se pudo eliminar el gasto fijo.",
                variant: "destructive",
            });
        }
    });

    return {
        fixedExpenses,
        isLoading,
        createFixedExpense: createFixedExpenseMutation.mutateAsync,
        updateFixedExpense: updateFixedExpenseMutation.mutateAsync,
        deleteFixedExpense: deleteFixedExpenseMutation.mutateAsync,
        isCreating: createFixedExpenseMutation.isPending,
        isUpdating: updateFixedExpenseMutation.isPending,
        isDeleting: deleteFixedExpenseMutation.isPending
    };
};
