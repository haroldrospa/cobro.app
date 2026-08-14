
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from './useUserStore';
import { useToast } from './use-toast';

export interface Supplier {
    id: string;
    name: string;
    rnc: string | null;
    contact: string | null;
    phone?: string | null;
    payment_method?: 'cash' | 'transfer' | string | null;
    bank_name?: string | null;
    bank_account_number?: string | null;
    bank_account_type?: 'ahorros' | 'corriente' | string | null;
    created_at: string;
}

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

            return (data || []) as Supplier[];
        },
        enabled: !!userStore?.id,
    });

    const createSupplierMutation = useMutation({
        mutationFn: async (newSupplier: Omit<Supplier, 'id' | 'created_at'>) => {
            if (!userStore?.id) throw new Error('No store configured');

            const { data, error } = await supabase
                .from('suppliers')
                .insert({
                    store_id: userStore.id,
                    name: newSupplier.name,
                    rnc: newSupplier.rnc,
                    contact: newSupplier.contact,
                    phone: newSupplier.phone || null,
                    payment_method: newSupplier.payment_method || 'transfer',
                    bank_name: newSupplier.bank_name || null,
                    bank_account_number: newSupplier.bank_account_number || null,
                    bank_account_type: newSupplier.bank_account_type || null,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
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
            const { data, error } = await supabase
                .from('suppliers')
                .update({
                    name: updates.name,
                    rnc: updates.rnc,
                    contact: updates.contact,
                    phone: updates.phone,
                    payment_method: updates.payment_method,
                    bank_name: updates.bank_name,
                    bank_account_number: updates.bank_account_number,
                    bank_account_type: updates.bank_account_type,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
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
            // Desvincular de los gastos para evitar el error de llave foránea (foreign key violation)
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
