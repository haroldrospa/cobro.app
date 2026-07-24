
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from './useUserStore';
import { useToast } from './use-toast';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';

export interface Expense {
    id: string;
    store_id: string;
    date: Date; // Transformed from string in DB
    description: string;
    amount: number;
    category: string;
    supplier_id: string | null;
    supplier_name?: string; // Optional helpful field join
    invoice_number: string | null;
    image_url: string | null;
    fixed_expense_id?: string | null;
    supplier_debt_id?: string | null;
    created_at: string;
    synced?: boolean | number;
}

export type CreateExpenseDTO = Omit<Expense, 'id' | 'created_at' | 'store_id' | 'supplier_name'> & {
    supplier_name?: string;
    created_at?: string;
    store_id?: string;
};

export type UpdateExpenseDTO = Partial<Omit<Expense, 'id'>> & { id: string };

export const useExpenses = () => {
    const { data: userStore } = useUserStore();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Fetch expenses from Supabase
    // FUTURE: Merge with local offline expenses for full offline-view support
    const { data: expenses = [], isLoading } = useQuery({
        queryKey: ['expenses', userStore?.id],
        queryFn: async () => {
            if (!userStore?.id) return [];

            // 1. Fetch from Supabase
            const { data: supabaseData, error } = await supabase
                .from('expenses')
                .select(`
                    *,
                    suppliers (
                        name
                    )
                `)
                .eq('store_id', userStore.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading expenses:', error);
                throw error;
            }

            const formattedSupabase = (supabaseData || []).map((item: any) => ({
                ...item,
                date: !isNaN(new Date(item.date).getTime()) ? new Date(item.date) : new Date(),
                amount: (typeof item.amount === 'number' && !isNaN(item.amount)) ? item.amount : 0,
                supplier_name: item.suppliers?.name || 'N/A'
            })) as Expense[];

            // 2. Fetch Local Unsynced Expenses
            let localUnsynced: any[] = [];
            try {
                // Use getAll and filter manually to be robust against missing indexes
                const allLocal = await offlineDB.getAll(OfflineStore.EXPENSES);
                localUnsynced = allLocal.filter((item: any) => item.synced === 0);
            } catch (e) {
                console.warn("Could not fetch local expenses:", e);
            }

            const formattedLocal = localUnsynced.map((item: any) => ({
                ...item,
                date: new Date(item.date),
                amount: Number(item.amount),
                supplier_name: item.supplier_name || 'N/A' // Local might store it
            })) as Expense[];

            // 3. Merge & Deduplicate (Prefer Supabase if ID collision, though unlikely for unsynced)
            const allExpenses = [...formattedLocal, ...formattedSupabase];
            const uniqueMap = new Map();
            allExpenses.forEach(ex => uniqueMap.set(ex.id, ex));

            return Array.from(uniqueMap.values()).sort((a: any, b: any) => {
                const timeA = new Date(a.created_at || a.date || 0).getTime();
                const timeB = new Date(b.created_at || b.date || 0).getTime();
                return timeB - timeA;
            }) as Expense[];
        },
        enabled: !!userStore?.id,
    });

    const createExpenseMutation = useMutation({
        mutationFn: async (newExpense: CreateExpenseDTO) => {
            const tempId = crypto.randomUUID();
            const storeId = userStore?.id;

            const saveDate = newExpense.date instanceof Date ? newExpense.date : new Date(newExpense.date || Date.now());

            const expenseToSave = {
                id: tempId,
                store_id: storeId,
                date: saveDate.toISOString(),
                description: newExpense.description,
                amount: newExpense.amount,
                category: newExpense.category,
                supplier_id: newExpense.supplier_id || null,
                invoice_number: newExpense.invoice_number,
                image_url: newExpense.image_url,
                fixed_expense_id: newExpense.fixed_expense_id || null,
                supplier_debt_id: newExpense.supplier_debt_id || null,
                created_at: newExpense.created_at || new Date().toISOString(),
                synced: 0,
                supplier_name: newExpense.supplier_name
            };

            // STRICT DATABASE FIRST APPROACH REQUESTED BY USER
            if (navigator.onLine && storeId) {
                console.log('🌐 Online: Guardando directamente en Supabase...');
                try {
                    const { data, error } = await supabase
                        .from('expenses')
                        .insert({
                            ...expenseToSave,
                            synced: undefined,
                            supplier_name: undefined,
                            date: expenseToSave.date
                        })
                        .select()
                        .single();

                    if (error) {
                        // Fallback: If column doesn't exist yet, retry without it
                        if (error.message?.includes('Could not find')) {
                            const missingColumns = [];
                            if (error.message.includes('supplier_debt_id')) missingColumns.push('supplier_debt_id');
                            if (error.message.includes('fixed_expense_id')) missingColumns.push('fixed_expense_id');

                            if (missingColumns.length > 0) {
                                console.warn(`Missing columns in DB: ${missingColumns.join(', ')}. Saving without these fields.`);
                                let safeExpense = { 
                                    ...expenseToSave, 
                                    synced: undefined, 
                                    supplier_name: undefined, 
                                    date: expenseToSave.date 
                                };
                                missingColumns.forEach(col => {
                                    delete (safeExpense as any)[col];
                                });

                                const { data: retryData, error: retryError } = await supabase
                                    .from('expenses')
                                    .insert(safeExpense)
                                    .select()
                                    .single();

                                if (retryError) throw retryError;
                                
                                const savedExpense = { ...expenseToSave, ...retryData, synced: 1 };
                                await offlineDB.put(OfflineStore.EXPENSES, savedExpense);
                                console.log('✅ Guardado en BD y Cache actualizado (fallback)');
                                return savedExpense;
                            }
                        }
                        throw error;
                    }

                    // Success on DB -> Update Cache
                    const savedExpense = { ...expenseToSave, ...data, synced: 1 };
                    await offlineDB.put(OfflineStore.EXPENSES, savedExpense);
                    console.log('✅ Guardado en BD y Cache actualizado');
                    return savedExpense;

                } catch (error: any) {
                    console.error('❌ Error guardando en BD:', error);
                    throw error; // Propagate error so UI knows it failed
                }
            } else {
                // Offline fallback
                console.log('📵 Offline: Guardando localmente...');
                await offlineDB.put(OfflineStore.EXPENSES, expenseToSave);
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.EXPENSES,
                    operation: 'CREATE',
                    data: expenseToSave
                });
                return expenseToSave;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            toast({
                title: "Gasto guardado",
                description: "Registro actualizado exitosamente.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "No se pudo guardar.",
                variant: "destructive",
            });
        },
    });

    const updateExpenseMutation = useMutation({
        mutationFn: async (expenseToUpdate: UpdateExpenseDTO) => {
            const { id, ...updates } = expenseToUpdate;
            const storeId = userStore?.id;

            const saveDate = updates.date ? (updates.date instanceof Date ? updates.date.toISOString() : new Date(updates.date).toISOString()) : undefined;

            const payload: any = { ...updates };
            if (saveDate) payload.date = saveDate;

            if (navigator.onLine && storeId) {
                console.log('🌐 Online: Actualizando gasto en Supabase...');
                const dbPayload: any = {};
                if (updates.description !== undefined) dbPayload.description = updates.description;
                if (updates.amount !== undefined) dbPayload.amount = updates.amount;
                if (updates.category !== undefined) dbPayload.category = updates.category;
                if (updates.supplier_id !== undefined) dbPayload.supplier_id = updates.supplier_id;
                if (updates.invoice_number !== undefined) dbPayload.invoice_number = updates.invoice_number;
                if (updates.image_url !== undefined) dbPayload.image_url = updates.image_url;
                if (saveDate !== undefined) dbPayload.date = saveDate;

                const { data, error } = await supabase
                    .from('expenses')
                    .update(dbPayload)
                    .eq('id', id)
                    .select(`
                        *,
                        suppliers (
                            name
                        )
                    `)
                    .single();

                if (error) {
                    console.error('❌ Error actualizando gasto en BD:', error);
                    throw error;
                }

                const updatedExpense = {
                    ...data,
                    date: !isNaN(new Date(data.date).getTime()) ? new Date(data.date) : new Date(),
                    amount: (typeof data.amount === 'number' && !isNaN(data.amount)) ? data.amount : 0,
                    supplier_name: data.suppliers?.name || updates.supplier_name || 'N/A',
                    synced: 1
                } as Expense;

                await offlineDB.put(OfflineStore.EXPENSES, updatedExpense);
                return updatedExpense;
            } else {
                console.log('📵 Offline: Actualizando localmente...');
                const existing = await offlineDB.get(OfflineStore.EXPENSES, id);
                const updated = {
                    ...existing,
                    ...payload,
                    synced: 0
                };
                await offlineDB.put(OfflineStore.EXPENSES, updated);
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.EXPENSES,
                    operation: 'UPDATE',
                    data: updated
                });
                return updated as Expense;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            toast({
                title: "Gasto actualizado",
                description: "Los datos del gasto se han actualizado correctamente.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "No se pudo actualizar el gasto.",
                variant: "destructive",
            });
        }
    });

    const deleteExpenseMutation = useMutation({
        mutationFn: async (id: string) => {
            // 1. Delete locally
            await offlineDB.delete(OfflineStore.EXPENSES, id);

            // 2. Try Online
            if (navigator.onLine) {
                const { error } = await supabase
                    .from('expenses')
                    .delete()
                    .eq('id', id);

                if (error) {
                    console.error('⚠️ Error borrando online, encolando...', error);
                    await offlineDB.addToSyncQueue({
                        store: OfflineStore.EXPENSES,
                        operation: 'DELETE',
                        data: { id }
                    });
                }
            } else {
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.EXPENSES,
                    operation: 'DELETE',
                    data: { id }
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            toast({
                title: "Gasto eliminado",
                description: "El registro ha sido borrado.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "No se pudo eliminar.",
                variant: "destructive",
            });
        }
    });

    return {
        expenses,
        isLoading,
        createExpense: createExpenseMutation.mutateAsync,
        updateExpense: updateExpenseMutation.mutateAsync,
        deleteExpense: deleteExpenseMutation.mutateAsync,
        isCreating: createExpenseMutation.isPending,
        isUpdating: updateExpenseMutation.isPending,
    };
};
