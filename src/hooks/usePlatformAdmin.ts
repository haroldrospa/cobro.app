import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Único lugar del frontend que decide si el usuario actual es admin de la
// PLATAFORMA (para mostrar/ocultar el link a "Panel Maestro" y la UI de
// SuperAdmin.tsx) — nunca confundir con profile.role ('admin'/'owner' de
// profiles.role es un rol POR TIENDA, cualquier dueño de tienda normal
// puede tenerlo).
//
// Esto es solo para decidir qué mostrar en pantalla — la seguridad real
// vive en la función is_platform_admin() de Postgres, que cada RPC de
// alcance multi-tienda (get_all_stores_admin, toggle_store_status, etc.)
// verifica server-side por su cuenta. Aunque este hook devolviera true
// incorrectamente, esas funciones seguirían rechazando a quien no sea
// admin real.
export const usePlatformAdmin = () => {
  const query = useQuery<boolean>({
    queryKey: ['is-platform-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_platform_admin');
      if (error) {
        console.warn('[usePlatformAdmin] check falló:', error.message);
        return false;
      }
      return data === true;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    isPlatformAdmin: query.data ?? false,
    loading: query.isLoading,
  };
};
