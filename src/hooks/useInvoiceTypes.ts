
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

export const useInvoiceTypes = () => {
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey: ['invoice-types'],
    staleTime: 1000 * 60 * 60 * 24, // 24 hours cache (static data)
    queryFn: async () => {
      try {
        if (!isOnline) {
          // Load from IndexedDB when offline
          console.log('📄 Cargando tipos de factura desde IndexedDB (modo offline)');
          const localTypes = await offlineDB.getAll<InvoiceType>(OfflineStore.INVOICE_TYPES);
          if (localTypes.length > 0) return localTypes;
          // Return minimal fallback data if IndexedDB is empty
          return [
            { id: 'B01', code: 'B01', name: 'Crédito Fiscal' },
            { id: 'B02', code: 'B02', name: 'Consumidor Final' },
            { id: 'B04', code: 'B04', name: 'Nota de Débito' },
            { id: 'B15', code: 'B15', name: 'Gubernamental' },
          ] as InvoiceType[];
        }

        const { data, error } = await supabase
          .from('invoice_types')
          .select('*')
          .order('code');

        if (error) throw error;

        const types = data as InvoiceType[];

        // Save all types to IndexedDB for offline use
        for (const type of types) {
          await offlineDB.put(OfflineStore.INVOICE_TYPES, type);
        }

        return types;
      } catch (error) {
        // Fallback to IndexedDB
        console.log('📄 Error en Supabase, cargando tipos de factura desde IndexedDB:', error);
        const localTypes = await offlineDB.getAll<InvoiceType>(OfflineStore.INVOICE_TYPES);
        if (localTypes.length > 0) return localTypes;
        return [
          { id: 'B01', code: 'B01', name: 'Crédito Fiscal' },
          { id: 'B02', code: 'B02', name: 'Consumidor Final' },
          { id: 'B04', code: 'B04', name: 'Nota de Débito' },
          { id: 'B15', code: 'B15', name: 'Gubernamental' },
        ] as InvoiceType[];
      }
    },
  });
};
