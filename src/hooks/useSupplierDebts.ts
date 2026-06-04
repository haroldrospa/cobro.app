import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from './useUserStore';
import { useToast } from './use-toast';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';

export interface SupplierDebt {
    id: string;
    store_id: string;
    supplier_id: string;
    amount: number;
    amount_paid: number;
    description: string;
    category: string;
    due_date: string | null;
    status: 'pending' | 'partial' | 'paid';
    created_at: string;
    updated_at: string;
    synced?: boolean | number;
}

export type CreateSupplierDebtDTO = Omit<SupplierDebt, 'id' | 'created_at' | 'updated_at' | 'store_id' | 'amount_paid' | 'status'> & {
    created_at?: string;
    store_id?: string;
};

export const useSupplierDebts = () => {
    const { data: userStore } = useUserStore();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Fetch supplier debts from Supabase / Local IndexedDB
    const { data: supplierDebts = [], isLoading } = useQuery({
        queryKey: ['supplier_debts', userStore?.id],
        queryFn: async () => {
            if (!userStore?.id) return [];

            // 1. Fetch from Supabase if online
            let supabaseData: any[] = [];
            let fetchError = null;

            if (navigator.onLine) {
                const { data, error } = await supabase
                    .from('supplier_debts' as any)
                    .select('*')
                    .eq('store_id', userStore.id)
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('Error loading supplier debts from server:', error);
                    fetchError = error;
                } else {
                    supabaseData = data || [];
                }
            }

            // Transform Server Data
            const formattedSupabase = supabaseData.map((item: any) => ({
                ...item,
                amount: typeof item.amount === 'number' ? item.amount : parseFloat(item.amount) || 0,
                amount_paid: typeof item.amount_paid === 'number' ? item.amount_paid : parseFloat(item.amount_paid) || 0,
            })) as SupplierDebt[];

            // 2. Fetch Local Unsynced/Cached Supplier Debts
            let localData: any[] = [];
            try {
                localData = await offlineDB.getAll(OfflineStore.SUPPLIER_DEBTS);
                // Filter for this store specifically
                localData = localData.filter((item: any) => item.store_id === userStore.id);
            } catch (e) {
                console.warn("Could not fetch local supplier debts:", e);
            }

            const formattedLocal = localData.map((item: any) => ({
                ...item,
                amount: Number(item.amount),
                amount_paid: Number(item.amount_paid),
            })) as SupplierDebt[];

            // Merge server and local data
            const allDebts = [...formattedLocal, ...formattedSupabase];
            const uniqueMap = new Map();
            allDebts.forEach(d => uniqueMap.set(d.id, d));

            return Array.from(uniqueMap.values()).sort((a: any, b: any) => {
                const timeA = new Date(a.created_at).getTime();
                const timeB = new Date(b.created_at).getTime();
                return timeB - timeA;
            }) as SupplierDebt[];
        },
        enabled: !!userStore?.id,
    });

    // Create supplier debt mutation
    const createSupplierDebtMutation = useMutation({
        mutationFn: async (newDebt: CreateSupplierDebtDTO) => {
            const tempId = crypto.randomUUID();
            const storeId = userStore?.id;

            const debtToSave = {
                id: tempId,
                store_id: storeId,
                supplier_id: newDebt.supplier_id,
                amount: Number(newDebt.amount),
                amount_paid: 0,
                description: newDebt.description,
                category: newDebt.category,
                due_date: newDebt.due_date || null,
                status: 'pending' as const,
                created_at: newDebt.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                synced: 0
            };

            // Save in IndexedDB first
            await offlineDB.put(OfflineStore.SUPPLIER_DEBTS, debtToSave);

            if (navigator.onLine && storeId) {
                try {
                    const { data, error } = await supabase
                        .from('supplier_debts' as any)
                        .insert({
                            ...debtToSave,
                            synced: undefined
                        })
                        .select()
                        .single();

                    if (error) throw error;

                    const saved = { ...debtToSave, ...data, synced: 1 };
                    await offlineDB.put(OfflineStore.SUPPLIER_DEBTS, saved);
                    return saved;
                } catch (error: any) {
                    console.error('Error saving supplier debt on server:', error);
                    // Queue for sync later
                    await offlineDB.addToSyncQueue({
                        store: OfflineStore.SUPPLIER_DEBTS,
                        operation: 'CREATE',
                        data: debtToSave
                    });
                    return debtToSave;
                }
            } else {
                // Queue for sync offline
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.SUPPLIER_DEBTS,
                    operation: 'CREATE',
                    data: debtToSave
                });
                return debtToSave;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supplier_debts'] });
            toast({
                title: "Deuda registrada",
                description: "Se ha registrado la deuda con el proveedor correctamente.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "No se pudo registrar la deuda.",
                variant: "destructive",
            });
        }
    });

    // Pay / Add payment to supplier debt mutation
    const paySupplierDebtMutation = useMutation({
        mutationFn: async (payload: {
            debtId: string;
            amountToPay: number;
            category?: string;
            description?: string;
        }) => {
            const storeId = userStore?.id;
            if (!storeId) throw new Error("No store context");

            // 1. Get the current debt object from IndexedDB
            const debt = await offlineDB.get<SupplierDebt>(OfflineStore.SUPPLIER_DEBTS, payload.debtId);
            if (!debt) throw new Error("Deuda no encontrada en base de datos local");

            const newAmountPaid = Number(debt.amount_paid) + Number(payload.amountToPay);
            const isFullyPaid = newAmountPaid >= Number(debt.amount);
            const status = isFullyPaid ? 'paid' : 'partial';

            const updatedDebt: SupplierDebt = {
                ...debt,
                amount_paid: Math.min(newAmountPaid, debt.amount),
                status,
                updated_at: new Date().toISOString(),
                synced: 0
            };

            // 2. Update debt in local IndexedDB
            await offlineDB.put(OfflineStore.SUPPLIER_DEBTS, updatedDebt);

            // 3. Register corresponding cash outflow in expenses (IndexedDB)
            const tempExpenseId = crypto.randomUUID();
            const expenseToSave = {
                id: tempExpenseId,
                store_id: storeId,
                date: new Date().toISOString(),
                description: payload.description || `Abono Deuda: ${debt.description}`,
                amount: payload.amountToPay,
                category: payload.category || debt.category,
                supplier_id: debt.supplier_id,
                invoice_number: null,
                image_url: null,
                supplier_debt_id: debt.id,
                created_at: new Date().toISOString(),
                synced: 0
            };

            await offlineDB.put(OfflineStore.EXPENSES, expenseToSave);

            // 4. Send to Supabase if Online
            if (navigator.onLine) {
                try {
                    // Update debt on server
                    const { synced: _, ...debtPayload } = updatedDebt;
                    const { error: debtError } = await supabase
                        .from('supplier_debts' as any)
                        .update(debtPayload)
                        .eq('id', debt.id);

                    if (debtError) throw debtError;
                    
                    // Update debt local cache to synced: 1
                    await offlineDB.put(OfflineStore.SUPPLIER_DEBTS, { ...updatedDebt, synced: 1 });

                    // Insert expense on server
                    const { synced: __, ...expensePayload } = expenseToSave;
                    const { error: expenseError } = await supabase
                        .from('expenses')
                        .insert(expensePayload);

                    if (expenseError) throw expenseError;

                    // Update expense local cache to synced: 1
                    await offlineDB.put(OfflineStore.EXPENSES, { ...expenseToSave, synced: 1 });
                } catch (error: any) {
                    console.error('Error recording payment on server, queuing both operations:', error);
                    // Add debt update to sync queue
                    await offlineDB.addToSyncQueue({
                        store: OfflineStore.SUPPLIER_DEBTS,
                        operation: 'UPDATE',
                        data: updatedDebt
                    });
                    // Add expense to sync queue
                    await offlineDB.addToSyncQueue({
                        store: OfflineStore.EXPENSES,
                        operation: 'CREATE',
                        data: expenseToSave
                    });
                }
            } else {
                // Offline sync queues
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.SUPPLIER_DEBTS,
                    operation: 'UPDATE',
                    data: updatedDebt
                });
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.EXPENSES,
                    operation: 'CREATE',
                    data: expenseToSave
                });
            }

            return updatedDebt;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supplier_debts'] });
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            toast({
                title: "Pago registrado",
                description: "Se ha registrado el pago y se generó un egreso en contabilidad.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error al pagar",
                description: error.message || "No se pudo registrar el pago.",
                variant: "destructive",
            });
        }
    });

    // Delete supplier debt mutation
    const deleteSupplierDebtMutation = useMutation({
        mutationFn: async (id: string) => {
            await offlineDB.delete(OfflineStore.SUPPLIER_DEBTS, id);

            if (navigator.onLine) {
                try {
                    const { error } = await supabase
                        .from('supplier_debts' as any)
                        .delete()
                        .eq('id', id);

                    if (error) throw error;
                } catch (error: any) {
                    console.error('Error deleting supplier debt from server:', error);
                    await offlineDB.addToSyncQueue({
                        store: OfflineStore.SUPPLIER_DEBTS,
                        operation: 'DELETE',
                        data: { id }
                    });
                }
            } else {
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.SUPPLIER_DEBTS,
                    operation: 'DELETE',
                    data: { id }
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supplier_debts'] });
            toast({
                title: "Deuda eliminada",
                description: "Se ha borrado el registro de deuda.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "No se pudo eliminar la deuda.",
                variant: "destructive",
            });
        }
    });

    return {
        supplierDebts,
        isLoading,
        createSupplierDebt: createSupplierDebtMutation.mutateAsync,
        paySupplierDebt: paySupplierDebtMutation.mutateAsync,
        deleteSupplierDebt: deleteSupplierDebtMutation.mutateAsync,
        isCreating: createSupplierDebtMutation.isPending,
        isPaying: paySupplierDebtMutation.isPending,
        isDeleting: deleteSupplierDebtMutation.isPending
    };
};
