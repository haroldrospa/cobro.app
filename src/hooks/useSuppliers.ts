import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from './useUserStore';
import { useToast } from './use-toast';

export interface Supplier {
    id: string;
    name: string;
    rnc?: string | null;
    contact?: string | null;
    phone?: string | null;
    contact_phone?: string | null;
    payment_method?: 'cash' | 'transfer' | string | null;
    bank_name?: string | null;
    bank_account_number?: string | null;
    bank_account_type?: 'ahorros' | 'corriente' | string | null;
    created_at: string;
}

// Helpers para respaldo en caché local en caso de que columnas no hayan sido ejecutadas en Supabase
const getLocalExtra = (id: string) => {
    try {
        const item = localStorage.getItem(`cobro_supplier_extra_${id}`);
        return item ? JSON.parse(item) : {};
    } catch {
        return {};
    }
};

const setLocalExtra = (id: string, data: any) => {
    try {
        const current = getLocalExtra(id);
        localStorage.setItem(`cobro_supplier_extra_${id}`, JSON.stringify({ ...current, ...data }));
    } catch {}
};

const removeLocalExtra = (id: string) => {
    try {
        localStorage.removeItem(`cobro_supplier_extra_${id}`);
    } catch {}
};

export const useSuppliers = () => {
    const { data: userStore } = useUserStore();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: suppliers = [], isLoading } = useQuery({
        queryKey: ['suppliers', userStore?.id],
        queryFn: async () => {
            if (!userStore?.id) return [];

            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .eq('store_id', userStore.id)
                .order('name');

            if (error) {
                console.error('Error loading suppliers:', error);
                throw error;
            }

            // Merge con datos locales en caso de que columnas no estén migradas en Supabase
            return (data || []).map((item: any) => {
                const extra = getLocalExtra(item.id);
                return {
                    ...item,
                    phone: item.phone ?? extra.phone ?? null,
                    contact_phone: item.contact_phone ?? extra.contact_phone ?? null,
                    payment_method: item.payment_method ?? extra.payment_method ?? 'transfer',
                    bank_name: item.bank_name ?? extra.bank_name ?? null,
                    bank_account_number: item.bank_account_number ?? extra.bank_account_number ?? null,
                    bank_account_type: item.bank_account_type ?? extra.bank_account_type ?? null,
                };
            }) as Supplier[];
        },
        enabled: !!userStore?.id,
    });

    const createSupplierMutation = useMutation({
        mutationFn: async (newSupplier: Omit<Supplier, 'id' | 'created_at'>) => {
            if (!userStore?.id) throw new Error('No store configured');

            const fullPayload: any = {
                store_id: userStore.id,
                name: newSupplier.name,
                rnc: newSupplier.rnc || null,
                contact: newSupplier.contact || null,
                phone: newSupplier.phone || null,
                contact_phone: newSupplier.contact_phone || null,
                payment_method: newSupplier.payment_method || 'transfer',
                bank_name: newSupplier.bank_name || null,
                bank_account_number: newSupplier.bank_account_number || null,
                bank_account_type: newSupplier.bank_account_type || null,
            };

            try {
                // Intentar inserción completa
                const { data, error } = await supabase
                    .from('suppliers')
                    .insert(fullPayload)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } catch (err: any) {
                // Si falta alguna columna en Supabase (error de schema cache / column not found)
                const isColumnError = err.message?.includes('column') || err.message?.includes('schema cache') || err.code === 'PGRST204';
                if (isColumnError) {
                    console.warn('Columnas extendidas faltantes en Supabase, guardando campos base y respaldando en local:', err);

                    // Insertar solo campos base compatibles
                    const basePayload = {
                        store_id: userStore.id,
                        name: newSupplier.name,
                        rnc: newSupplier.rnc || null,
                        contact: newSupplier.contact || null,
                    };

                    const { data: baseData, error: baseError } = await supabase
                        .from('suppliers')
                        .insert(basePayload)
                        .select()
                        .single();

                    if (baseError) throw baseError;

                    // Respaldar campos extras en local
                    if (baseData?.id) {
                        setLocalExtra(baseData.id, {
                            phone: newSupplier.phone || null,
                            contact_phone: newSupplier.contact_phone || null,
                            payment_method: newSupplier.payment_method || 'transfer',
                            bank_name: newSupplier.bank_name || null,
                            bank_account_number: newSupplier.bank_account_number || null,
                            bank_account_type: newSupplier.bank_account_type || null,
                        });
                    }

                    return {
                        ...baseData,
                        ...fullPayload,
                    };
                }
                throw err;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast({
                title: "Proveedor guardado",
                description: "El proveedor se ha registrado correctamente.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "No se pudo guardar el proveedor.",
                variant: "destructive",
            });
        },
    });

    const updateSupplierMutation = useMutation({
        mutationFn: async ({ id, ...updates }: Partial<Supplier> & { id: string }) => {
            const fullUpdates: any = {
                name: updates.name,
                rnc: updates.rnc,
                contact: updates.contact,
                phone: updates.phone,
                contact_phone: updates.contact_phone,
                payment_method: updates.payment_method,
                bank_name: updates.bank_name,
                bank_account_number: updates.bank_account_number,
                bank_account_type: updates.bank_account_type,
                updated_at: new Date().toISOString(),
            };

            try {
                // Intentar actualización completa
                const { data, error } = await supabase
                    .from('suppliers')
                    .update(fullUpdates)
                    .eq('id', id)
                    .select()
                    .single();

                if (error) throw error;

                // Actualizar o sincronizar caché local
                setLocalExtra(id, fullUpdates);
                return data;
            } catch (err: any) {
                const isColumnError = err.message?.includes('column') || err.message?.includes('schema cache') || err.code === 'PGRST204';
                if (isColumnError) {
                    console.warn('Columnas extendidas faltantes en Supabase al actualizar, guardando base y local:', err);

                    // Actualizar campos base garantizados
                    const baseUpdates = {
                        name: updates.name,
                        rnc: updates.rnc,
                        contact: updates.contact,
                        updated_at: new Date().toISOString(),
                    };

                    const { data: baseData, error: baseError } = await supabase
                        .from('suppliers')
                        .update(baseUpdates)
                        .eq('id', id)
                        .select()
                        .single();

                    if (baseError) throw baseError;

                    // Respaldar campos extras en local
                    setLocalExtra(id, {
                        phone: updates.phone ?? null,
                        contact_phone: updates.contact_phone ?? null,
                        payment_method: updates.payment_method ?? 'transfer',
                        bank_name: updates.bank_name ?? null,
                        bank_account_number: updates.bank_account_number ?? null,
                        bank_account_type: updates.bank_account_type ?? null,
                    });

                    return {
                        ...baseData,
                        ...fullUpdates,
                    };
                }
                throw err;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast({
                title: "Proveedor actualizado",
                description: "Los datos del proveedor se han actualizado correctamente.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error al actualizar",
                description: error.message || "No se pudo actualizar la información del proveedor.",
                variant: "destructive",
            });
        },
    });

    const deleteSupplierMutation = useMutation({
        mutationFn: async (id: string) => {
            // Desvincular de los gastos para evitar el error de llave foránea
            const { error: unlinkError } = await supabase
                .from('expenses')
                .update({ supplier_id: null })
                .eq('supplier_id', id);

            if (unlinkError) {
                console.error("Error al desvincular gastos del proveedor:", unlinkError);
            }

            // Proceder con la eliminación del proveedor
            const { error } = await supabase
                .from('suppliers')
                .delete()
                .eq('id', id);

            if (error) {
                if (error.code === '23503') throw new Error("No se puede eliminar porque hay registros atados a este proveedor.");
                throw error;
            }

            removeLocalExtra(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast({
                title: "Proveedor eliminado",
                description: "El proveedor se ha eliminado correctamente.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "No se pudo eliminar el proveedor.",
                variant: "destructive",
            });
        },
    });

    return {
        suppliers,
        isLoading,
        createSupplier: createSupplierMutation.mutateAsync,
        updateSupplier: updateSupplierMutation.mutateAsync,
        deleteSupplier: deleteSupplierMutation.mutateAsync,
        isCreating: createSupplierMutation.isPending,
        isUpdating: updateSupplierMutation.isPending,
    };
};
