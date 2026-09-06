import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InvoiceSequence {
  id: string;
  invoice_type_id: string;
  current_number: number;
  created_at: string;
  updated_at: string;
}

export const useInvoiceSequences = () => {
  return useQuery({
    queryKey: ['invoice-sequences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_sequences')
        .select('*')
        .order('invoice_type_id');

      if (error) throw error;
      return data as InvoiceSequence[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 2, // 2 hours
  });
};

// Hook para obtener el número máximo usado para cada tipo de factura
export const useMaxInvoiceNumbers = () => {
  return useQuery({
    queryKey: ['max-invoice-numbers'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return {};

      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', session.user.id)
        .single();

      if (!profile?.store_id) return {};

      const invoiceTypes = ['B01', 'B02', 'B03', 'B04', 'B14', 'B15', 'B16'];
      const maxNumbers: Record<string, number> = {};

      await Promise.all(invoiceTypes.map(async (typeId) => {
        const { data, error } = await supabase
          .from('sales')
          .select('invoice_number')
          .eq('store_id', profile.store_id)
          .eq('invoice_type_id', typeId)
          .not('invoice_number', 'like', '%OFFLINE%')
          .order('invoice_number', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          const match = data[0].invoice_number.match(/-(\d{1,9})$/);
          if (match) {
            maxNumbers[typeId] = parseInt(match[1], 10);
          }
        }
      }));

      return maxNumbers;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
};

import { offlineDB, OfflineStore } from '@/lib/offlineDB';

export const useUpdateInvoiceSequence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, current_number, invoice_type_id }: { id: string; current_number: number; invoice_type_id: string }) => {
      const { data, error } = await supabase
        .from('invoice_sequences')
        .update({ current_number, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['max-invoice-numbers'] });

      // Actualizar caché offline inmediatamente
      try {
        const settings = await offlineDB.get<any>(OfflineStore.SETTINGS, 'invoice_sequences') || { key: 'invoice_sequences' };
        settings[variables.invoice_type_id] = {
          current: variables.current_number,
          prefix: `${variables.invoice_type_id}-`
        };
        await offlineDB.put(OfflineStore.SETTINGS, settings);
        console.log(`💾 Secuencia ${variables.invoice_type_id} guardada en offlineDB: #${variables.current_number}`);
      } catch (e) {
        console.error('Error actualizando offlineDB para secuencias:', e);
      }
    },
  });
};

export const useGetNextInvoiceNumber = (invoiceTypeId: string) => {
  return useQuery({
    queryKey: ['next-invoice-number', invoiceTypeId],
    queryFn: async () => {
      if (!invoiceTypeId) return null;

      const { data, error } = await supabase
        .from('invoice_sequences')
        .select('current_number')
        .eq('invoice_type_id', invoiceTypeId)
        .single();

      if (error) throw error;

      // Format the next number
      const nextNumber = data.current_number + 1;
      return `${invoiceTypeId}-${String(nextNumber).padStart(8, '0')}`;
    },
    enabled: !!invoiceTypeId,
  });
};