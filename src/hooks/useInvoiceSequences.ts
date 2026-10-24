import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';
import { AlanubeService } from '@/services/alanube/AlanubeService';

export interface InvoiceSequence {
  id: string;
  invoice_type_id: string;
  current_number: number;
  created_at: string;
  updated_at: string;
}

export interface DgiiTypeStats {
  emittedCount: number; // Cantidad real de comprobantes aceptados en DGII (ej. 2)
  lastAcceptedSeq: number; // Número de secuencia del último comprobante aceptado (ej. 6)
  lastAcceptedEncf: string | null; // Código del último e-NCF aceptado (ej. E320000000006)
  acceptedSeqNumbers: number[]; // Lista de números de secuencia ya aceptados en DGII (ej. [3, 6])
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

const extractSeqNum = (str?: string | null): number => {
  if (!str) return 0;
  const m = str.match(/(?:-|E\d{2})(\d{1,10})$/);
  if (m) return parseInt(m[1], 10) || 0;
  const tail = str.match(/(\d{1,10})$/);
  if (tail) {
    const raw = tail[1];
    return parseInt(raw.length > 10 ? raw.slice(-10) : raw, 10) || 0;
  }
  return 0;
};

/**
 * Obtiene las estadísticas reales de comprobantes aceptados por la DGII para cada tipo:
 * - cuántos comprobantes han sido realmente emitidos/aceptados (emittedCount)
 * - cuál fue el último comprobante aceptado (lastAcceptedSeq / lastAcceptedEncf)
 */
export const useDgiiSequenceStats = () => {
  return useQuery({
    queryKey: ['dgii-sequence-stats'],
    queryFn: async (): Promise<Record<string, DgiiTypeStats>> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return {};

      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', session.user.id)
        .single();

      if (!profile?.store_id) return {};

      const invoiceTypes = ['B01', 'B02', 'B03', 'B04', 'B11', 'B14', 'B15', 'B16'];
      const statsMap: Record<string, DgiiTypeStats> = {};

      for (const t of invoiceTypes) {
        statsMap[t] = {
          emittedCount: 0,
          lastAcceptedSeq: 0,
          lastAcceptedEncf: null,
          acceptedSeqNumbers: [],
        };
      }

      // Consultar las facturas electrónicas ACEPTADAS de esta tienda en una sola consulta ligera
      const [{ data: acceptedSales }, alanubeAcceptedCounts] = await Promise.all([
        supabase
          .from('sales')
          .select('invoice_type_id, invoice_number, encf, estado_fiscal, qrcode_url')
          .eq('store_id', profile.store_id)
          .eq('estado_fiscal', 'ACEPTADO')
          .order('created_at', { ascending: false })
          .limit(500),
        AlanubeService.getEmittedCounts(profile.store_id),
      ]);

      if (acceptedSales && acceptedSales.length > 0) {
        const seenEncfPerType: Record<string, Set<number>> = {};
        for (const row of acceptedSales) {
          const typeId = row.invoice_type_id || 'B02';
          if (!statsMap[typeId]) continue;
          if (!seenEncfPerType[typeId]) seenEncfPerType[typeId] = new Set<number>();

          const rawCode = (row as any).encf || row.invoice_number || '';
          const seqNum = extractSeqNum(rawCode);
          if (seqNum > 0 && !seenEncfPerType[typeId].has(seqNum)) {
            seenEncfPerType[typeId].add(seqNum);
            statsMap[typeId].acceptedSeqNumbers.push(seqNum);
            if (seqNum > statsMap[typeId].lastAcceptedSeq) {
              statsMap[typeId].lastAcceptedSeq = seqNum;
              statsMap[typeId].lastAcceptedEncf = rawCode.startsWith('E') ? rawCode : null;
            }
          }
        }

        for (const typeId of Object.keys(seenEncfPerType)) {
          statsMap[typeId].emittedCount = seenEncfPerType[typeId].size;
        }
      }

      // Si Alanube reporta un conteo de aceptados mayor (por ej. facturas previas), sincronizar emittedCount
      if (alanubeAcceptedCounts && typeof alanubeAcceptedCounts === 'object') {
        for (const typeId of invoiceTypes) {
          const remoteAccepted = Number(alanubeAcceptedCounts[typeId]) || 0;
          if (remoteAccepted > statsMap[typeId].emittedCount) {
            statsMap[typeId].emittedCount = remoteAccepted;
          }
        }
      }

      return statsMap;
    },
    staleTime: 1000 * 15, // 15 seconds
    gcTime: 1000 * 60 * 10,
  });
};

// Hook de compatibilidad para obtener el último número aceptado por cada tipo de factura
export const useMaxInvoiceNumbers = () => {
  const { data: statsMap, ...rest } = useDgiiSequenceStats();
  const maxNumbers: Record<string, number> = {};
  if (statsMap) {
    for (const [typeId, st] of Object.entries(statsMap)) {
      if (st.lastAcceptedSeq > 0) {
        maxNumbers[typeId] = st.lastAcceptedSeq;
      }
    }
  }
  return { data: maxNumbers, statsMap, ...rest };
};

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
      queryClient.invalidateQueries({ queryKey: ['dgii-sequence-stats'] });

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
