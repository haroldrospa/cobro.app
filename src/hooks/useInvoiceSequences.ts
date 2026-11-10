import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';
import { AlanubeService } from '@/services/alanube/AlanubeService';

export interface InvoiceSequence {
  id: string;
  invoice_type_id: string;
  current_number: number;
  end_number?: number | null;
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
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('invoice-sequences-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoice_sequences',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['invoice-sequences'] });
          queryClient.invalidateQueries({ queryKey: ['dgii-sequence-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['invoice-sequences'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase
        .from('invoice_sequences')
        .select('*')
        .order('invoice_type_id');

      if (error) throw error;

      let savedEndNumbers: Record<string, number> = {};
      try {
        savedEndNumbers = JSON.parse(localStorage.getItem('invoice_sequence_end_numbers') || '{}');
      } catch (e) {
        console.error(e);
      }

      const rawSequences = (data || []) as any[];
      const sequences: InvoiceSequence[] = rawSequences.map(seq => ({
        id: seq.id,
        invoice_type_id: seq.invoice_type_id,
        current_number: Number(seq.current_number) || 0,
        end_number: seq.end_number !== undefined && seq.end_number !== null
          ? Number(seq.end_number)
          : (savedEndNumbers[seq.invoice_type_id] !== undefined ? Number(savedEndNumbers[seq.invoice_type_id]) : null),
        created_at: seq.created_at,
        updated_at: seq.updated_at
      }));

      // Si el usuario está autenticado y tiene una tienda asociada, asegurar que existan secuencias tanto para NCF (B) como para e-CF (E)
      if (session?.user?.id) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('store_id')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile?.store_id) {
            const existingTypeIds = new Set(sequences.map(s => s.invoice_type_id));
            const requiredTypes = [
              'B01', 'B02', 'B03', 'B04', 'B11', 'B14', 'B15', 'B16',
              'E31', 'E32', 'E33', 'E34', 'E41', 'E44', 'E45', 'E46'
            ];
            const missingTypes = requiredTypes.filter(t => !existingTypeIds.has(t));

            if (missingTypes.length > 0) {
              const toInsert = missingTypes.map(t => ({
                store_id: profile.store_id,
                invoice_type_id: t,
                current_number: 0
              }));
              const { data: inserted, error: insertErr } = await supabase
                .from('invoice_sequences')
                .insert(toInsert)
                .select();

              if (!insertErr && inserted && inserted.length > 0) {
                return [...sequences, ...(inserted as InvoiceSequence[])].sort((a, b) => a.invoice_type_id.localeCompare(b.invoice_type_id));
              }
            }
          }
        } catch (err) {
          console.warn('Aviso asegurando secuencias:', err);
        }
      }

      return sequences;
    },
    staleTime: 1000 * 60 * 15, // 15 mins
    gcTime: 1000 * 60 * 60, // 1 hour
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

      const allTypes = [
        'B01', 'B02', 'B03', 'B04', 'B11', 'B14', 'B15', 'B16',
        'E31', 'E32', 'E33', 'E34', 'E41', 'E44', 'E45', 'E46'
      ];
      const statsMap: Record<string, DgiiTypeStats> = {};

      for (const t of allTypes) {
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
          .select('invoice_type_id, invoice_number, encf, estado_fiscal, qrcode_url, codigo_seguridad')
          .eq('store_id', profile.store_id)
          .eq('estado_fiscal', 'ACEPTADO')
          .order('created_at', { ascending: false })
          .limit(500),
        AlanubeService.getEmittedCounts(profile.store_id),
      ]);

      if (acceptedSales && acceptedSales.length > 0) {
        const seenEncfPerType: Record<string, Set<number>> = {};
        for (const row of acceptedSales) {
          const rawCode = (row as any).encf || row.invoice_number || '';
          let typeId = row.invoice_type_id || 'B02';

          if (rawCode.startsWith('E')) {
            const prefix = rawCode.slice(0, 3).toUpperCase();
            if (statsMap[prefix]) {
              typeId = prefix;
            }

            // Para comprobantes electrónicos (e-CF), solo considerar válidos los que realmente
            // fueron firmados y aceptados por la DGII (poseen código de seguridad o timbre oficial)
            const secCode = (row as any).codigo_seguridad;
            const hasValidQr = Boolean(
              row.qrcode_url &&
              row.qrcode_url.includes('CodigoSeguridad=') &&
              !row.qrcode_url.includes('CodigoSeguridad=&') &&
              !row.qrcode_url.endsWith('CodigoSeguridad=')
            );
            if (!secCode && !hasValidQr) {
              // Registro fallido o sin firma real de DGII -> ignorar para no inflar secuencias
              continue;
            }
          } else if (rawCode.startsWith('B')) {
            const prefix = rawCode.slice(0, 3).toUpperCase();
            if (statsMap[prefix]) {
              typeId = prefix;
            }
          }

          if (!statsMap[typeId]) continue;
          if (!seenEncfPerType[typeId]) seenEncfPerType[typeId] = new Set<number>();

          const seqNum = extractSeqNum(rawCode);
          if (seqNum > 0 && !seenEncfPerType[typeId].has(seqNum)) {
            seenEncfPerType[typeId].add(seqNum);
            statsMap[typeId].acceptedSeqNumbers.push(seqNum);
            if (seqNum > statsMap[typeId].lastAcceptedSeq) {
              statsMap[typeId].lastAcceptedSeq = seqNum;
              statsMap[typeId].lastAcceptedEncf = rawCode;
            }
          }
        }

        for (const typeId of Object.keys(seenEncfPerType)) {
          statsMap[typeId].emittedCount = seenEncfPerType[typeId].size;
        }
      }

      // Si Alanube reporta un conteo de aceptados mayor (e-CF), sincronizar emittedCount para los tipos E correspondientes
      if (alanubeAcceptedCounts && typeof alanubeAcceptedCounts === 'object') {
        const eMapping: Record<string, string> = {
          B01: 'E31', B02: 'E32', B03: 'E33', B04: 'E34',
          B11: 'E41', B14: 'E44', B15: 'E45', B16: 'E46',
          E31: 'E31', E32: 'E32', E33: 'E33', E34: 'E34',
          E41: 'E41', E44: 'E44', E45: 'E45', E46: 'E46'
        };
        for (const [key, count] of Object.entries(alanubeAcceptedCounts)) {
          const targetType = eMapping[key] || key;
          if (statsMap[targetType]) {
            const remoteAccepted = Number(count) || 0;
            if (remoteAccepted > statsMap[targetType].emittedCount) {
              statsMap[targetType].emittedCount = remoteAccepted;
            }
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
    mutationFn: async ({
      id,
      current_number,
      end_number,
      invoice_type_id
    }: {
      id: string;
      current_number?: number;
      end_number?: number | null;
      invoice_type_id: string;
    }) => {
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      if (current_number !== undefined) {
        updatePayload.current_number = current_number;
      }
      if (end_number !== undefined) {
        updatePayload.end_number = end_number;
      }

      let data: any = null;
      let error: any = null;

      try {
        const res = await supabase
          .from('invoice_sequences')
          .update(updatePayload)
          .eq('id', id)
          .select()
          .single();
        data = res.data;
        error = res.error;
      } catch (err) {
        error = err;
      }

      // Si falló por no existir la columna end_number aún en BD, intentar guardar solo current_number si aplica
      if (error && (error as any).message?.includes('end_number')) {
        console.warn('[useUpdateInvoiceSequence] Columna end_number no existe aún en BD. Guardando solo current_number:', error);
        if (current_number !== undefined) {
          const resFallback = await supabase
            .from('invoice_sequences')
            .update({ current_number, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
          if (resFallback.error) throw resFallback.error;
          data = resFallback.data;
        }
      } else if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: async (_data, variables) => {
      // Guardar rango final en cache local
      if (variables.end_number !== undefined) {
        try {
          const saved = JSON.parse(localStorage.getItem('invoice_sequence_end_numbers') || '{}');
          if (variables.end_number === null) {
            delete saved[variables.invoice_type_id];
          } else {
            saved[variables.invoice_type_id] = variables.end_number;
          }
          localStorage.setItem('invoice_sequence_end_numbers', JSON.stringify(saved));
        } catch (e) {
          console.error(e);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['invoice-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-sequences-alert'] });
      queryClient.invalidateQueries({ queryKey: ['dgii-sequence-stats'] });

      // Actualizar caché offline inmediatamente
      try {
        const isElectronic = variables.invoice_type_id.startsWith('E');
        const settings = await offlineDB.get<any>(OfflineStore.SETTINGS, 'invoice_sequences') || { key: 'invoice_sequences' };
        settings[variables.invoice_type_id] = {
          current: variables.current_number !== undefined ? variables.current_number : (settings[variables.invoice_type_id]?.current || 0),
          end_number: variables.end_number !== undefined ? variables.end_number : (settings[variables.invoice_type_id]?.end_number ?? null),
          prefix: isElectronic ? variables.invoice_type_id : `${variables.invoice_type_id}-`
        };
        await offlineDB.put(OfflineStore.SETTINGS, settings);
        console.log(`💾 Secuencia ${variables.invoice_type_id} guardada en offlineDB: #${variables.current_number ?? ''} (Hasta: #${variables.end_number ?? 'Sin límite'})`);
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
      const isElectronic = invoiceTypeId.startsWith('E');
      const separator = isElectronic ? '' : '-';
      const padding = isElectronic ? 10 : 8;
      return `${invoiceTypeId}${separator}${String(nextNumber).padStart(padding, '0')}`;
    },
    enabled: !!invoiceTypeId,
  });
};
