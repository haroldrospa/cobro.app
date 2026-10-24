import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';
import { useOnlineStatus } from './useProductsOffline';

export interface InvoiceType {
  id: string;
  name: string;
  description?: string;
  code: string;
}

let internalTypeEnsured = false;

export const useInvoiceTypes = () => {
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey: ['invoice-types'],
    staleTime: 1000 * 60 * 60 * 24, // 24 hours cache (static data)
    queryFn: async () => {
      try {
        if (!isOnline) {
          console.log('📄 Cargando tipos de factura desde IndexedDB (modo offline)');
          const localTypes = await offlineDB.getAll<InvoiceType>(OfflineStore.INVOICE_TYPES);
          if (localTypes.length > 0) return localTypes;
          return [
            { id: 'FAC', code: 'FAC', name: 'Factura Interna' },
            { id: 'B01', code: 'B01', name: 'Crédito Fiscal' },
            { id: 'B02', code: 'B02', name: 'Consumidor Final' },
            { id: 'B04', code: 'B04', name: 'Nota de Débito' },
            { id: 'B11', code: 'B11', name: 'Comprobante de Compras' },
            { id: 'B15', code: 'B15', name: 'Gubernamental' },
          ] as InvoiceType[];
        }

        const { data, error } = await supabase
          .from('invoice_types')
          .select('*')
          .order('code');

        if (error) throw error;

        const types = (data || []) as InvoiceType[];

        // Asegurar que exista el tipo 'FAC' (Factura Interna) en la tabla invoice_types para integridad de FK en sales
        if (!types.some(t => t.id === 'FAC' || t.code === 'FAC') && !internalTypeEnsured) {
          internalTypeEnsured = true;
          const internalType: InvoiceType = {
            id: 'FAC',
            code: 'FAC',
            name: 'Factura Interna',
            description: 'Factura interna del sistema (sin valor fiscal)',
          };
          supabase
            .from('invoice_types')
            .upsert(internalType as any, { onConflict: 'id' })
            .then(({ error: upsertErr }) => {
              if (upsertErr) console.warn('Aviso al registrar tipo FAC en invoice_types:', upsertErr);
            });
          types.unshift(internalType);
        }

        for (const type of types) {
          await offlineDB.put(OfflineStore.INVOICE_TYPES, type);
        }

        return types;
      } catch (error) {
        console.log('📄 Error en Supabase, cargando tipos de factura desde IndexedDB:', error);
        const localTypes = await offlineDB.getAll<InvoiceType>(OfflineStore.INVOICE_TYPES);
        if (localTypes.length > 0) return localTypes;
        return [
          { id: 'FAC', code: 'FAC', name: 'Factura Interna' },
          { id: 'B01', code: 'B01', name: 'Crédito Fiscal' },
          { id: 'B02', code: 'B02', name: 'Consumidor Final' },
          { id: 'B04', code: 'B04', name: 'Nota de Débito' },
          { id: 'B15', code: 'B15', name: 'Gubernamental' },
        ] as InvoiceType[];
      }
    },
  });
};
