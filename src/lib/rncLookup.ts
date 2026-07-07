import { supabase } from '@/integrations/supabase/client';

export interface RncLookupResponse {
  success: boolean;
  rnc?: string;
  name?: string;
  error?: string;
}

export const lookupRnc = async (rnc: string): Promise<RncLookupResponse> => {
  try {
    if (!rnc) return { success: false, error: 'RNC requerido' };

    const { data, error } = await supabase.functions.invoke('rnc-lookup', {
      body: { rnc }
    });

    if (error) {
      console.error('Error invocando rnc-lookup:', error);
      return { success: false, error: error.message || 'Error de conexión' };
    }

    return data as RncLookupResponse;
  } catch (err: any) {
    console.error('Error en lookupRnc:', err);
    return { success: false, error: err.message || 'Error desconocido' };
  }
};
