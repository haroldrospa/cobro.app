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
            { id: 'B03', code: 'B03', name: 'Nota de Débito' },
            { id: 'B04', code: 'B04', name: 'Nota de Crédito' },
            { id: 'B11', code: 'B11', name: 'Comprobante de Compras' },
            { id: 'B14', code: 'B14', name: 'Regímenes Especiales' },
            { id: 'B15', code: 'B15', name: 'Gubernamental' },
            { id: 'B16', code: 'B16', name: 'Exportaciones' },
            { id: 'E31', code: 'E31', name: 'Crédito Fiscal Electrónico' },
            { id: 'E32', code: 'E32', name: 'Consumidor Final Electrónico' },
            { id: 'E33', code: 'E33', name: 'Nota de Débito Electrónica' },
            { id: 'E34', code: 'E34', name: 'Nota de Crédito Electrónica' },
            { id: 'E41', code: 'E41', name: 'Comprobante de Compras Electrónico' },
            { id: 'E44', code: 'E44', name: 'Régimen Especial Electrónico' },
            { id: 'E45', code: 'E45', name: 'Gubernamental Electrónico' },
            { id: 'E46', code: 'E46', name: 'Exportación Electrónica' },
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
          try { await offlineDB.put(OfflineStore.INVOICE_TYPES, type); } catch (_) {}
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
          { id: 'B03', code: 'B03', name: 'Nota de Débito' },
          { id: 'B04', code: 'B04', name: 'Nota de Crédito' },
          { id: 'B11', code: 'B11', name: 'Comprobante de Compras' },
          { id: 'B14', code: 'B14', name: 'Regímenes Especiales' },
          { id: 'B15', code: 'B15', name: 'Gubernamental' },
          { id: 'B16', code: 'B16', name: 'Exportaciones' },
          { id: 'E31', code: 'E31', name: 'Crédito Fiscal Electrónico' },
          { id: 'E32', code: 'E32', name: 'Consumidor Final Electrónico' },
          { id: 'E33', code: 'E33', name: 'Nota de Débito Electrónica' },
          { id: 'E34', code: 'E34', name: 'Nota de Crédito Electrónica' },
          { id: 'E41', code: 'E41', name: 'Comprobante de Compras Electrónico' },
          { id: 'E44', code: 'E44', name: 'Régimen Especial Electrónico' },
          { id: 'E45', code: 'E45', name: 'Gubernamental Electrónico' },
          { id: 'E46', code: 'E46', name: 'Exportación Electrónica' },
        ] as InvoiceType[];
      }
    },
  });
};
