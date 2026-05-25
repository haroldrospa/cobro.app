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
  });
};

// Hook para obtener el número máximo usado para cada tipo de factura
export const useMaxInvoiceNumbers = () => {
  return useQuery({
    queryKey: ['max-invoice-numbers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('invoice_type_id, invoice_number');

      if (error) throw error;

      // Extraer el número máximo para cada tipo
      const maxNumbers: Record<string, number> = {};

      data?.forEach(sale => {
        if (sale.invoice_type_id && sale.invoice_number) {
          // Extraer el número de la factura (ej: B01-00000012 -> 12)
          const match = sale.invoice_number.match(/-(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!maxNumbers[sale.invoice_type_id] || num > maxNumbers[sale.invoice_type_id]) {
              maxNumbers[sale.invoice_type_id] = num;
            }
          }
        }
      });

      return maxNumbers;
    },
  });
};

export const useUpdateInvoiceSequence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, current_number, invoice_type_id }: { id: string; current_number: number; invoice_type_id: string }) => {
      // Primero verificar el número máximo usado para este tipo
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('invoice_number')
        .eq('invoice_type_id', invoice_type_id);

      if (salesError) throw salesError;

      // Encontrar el número máximo usado
      let maxUsed = 0;
      sales?.forEach(sale => {
        const match = sale.invoice_number.match(/-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxUsed) maxUsed = num;
        }
      });

      // Validar que el nuevo current_number no sea menor al máximo usado
      // current_number representa el último número usado, el próximo será current_number + 1
      /* VALIDATION REMOVED BY USER REQUEST
      if (current_number < maxUsed) {
        throw new Error(`No puedes establecer un próximo número menor a ${maxUsed + 1}. Ya existen facturas hasta ${invoice_type_id}-${String(maxUsed).padStart(8, '0')}.`);
      }
      */

      const { data, error } = await supabase
        .from('invoice_sequences')
        .update({ current_number })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['max-invoice-numbers'] });
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