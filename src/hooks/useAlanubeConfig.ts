import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/hooks/useUserStore';
import { AlanubeConfig } from '@/services/alanube/types';

export const useAlanubeConfig = () => {
  const { data: store, isLoading: isUserStoreLoading } = useUserStore();
  const storeId = store?.id;
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();

  // Real-time listener: cuando cualquier dispositivo actualiza alanube_config, todas las PCs se sincronizan en vivo
  useEffect(() => {
    if (!storeId) return;

    const channel = supabase
      .channel(`alanube-config-sync-${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alanube_config',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          console.log('⚡ [useAlanubeConfig] Sincronización en tiempo real desde Supabase:', payload);
          queryClient.invalidateQueries({ queryKey: ['alanubeConfig', storeId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, queryClient]);

  const fetchConfig = async (): Promise<(AlanubeConfig & { is_active: boolean }) | null> => {
    if (!storeId) return null;

    try {
      const { data, error } = await supabase
        .from('alanube_config')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching alanube_config from Supabase:', error);
      }

      if (data) {
        const rawRnc = ((data as any)?.rnc_emisor || '').replace(/[^0-9]/g, '');
        let effectiveCompanyId = (data as any)?.company_id || (rawRnc === '133695189' ? '01M2RBT1TH2R6NFHSEJH2GB672' : '01M0TYPKJ0JGVM53K56D7X9P7Z');
        if (rawRnc === '133695189' && (!effectiveCompanyId || effectiveCompanyId.startsWith('01M0TYPK'))) {
          effectiveCompanyId = '01M2RBT1TH2R6NFHSEJH2GB672';
        } else if (effectiveCompanyId === '01M0TYPKJGJVM53K56D7X9P7Z') {
          effectiveCompanyId = '01M0TYPKJ0JGVM53K56D7X9P7Z';
        }

        const resolvedConfig = {
          api_token: (data as any)?.api_token || '',
          environment: ((data as any)?.environment as 'SANDBOX' | 'PRODUCTION') || 'PRODUCTION',
          base_url: (data as any)?.base_url || 'https://api.alanube.co',
          rnc_emisor: (data as any)?.rnc_emisor || '',
          razon_social: (data as any)?.razon_social || '',
          company_id: effectiveCompanyId,
          sequence_due_date: (data as any)?.sequence_due_date || '2027-12-31',
          certificado_digital: (data as any)?.certificado_digital || null,
          certificado_password: (data as any)?.certificado_password || null,
          is_active: Boolean((data as any)?.is_active),
        };

        // Guardar copia local de respaldo offline con los datos reales de Supabase
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`alanube_cache_${storeId}`, JSON.stringify(resolvedConfig));
            localStorage.setItem('alanube_billing_mode', resolvedConfig.is_active ? 'e-ncf' : 'ncf');
            localStorage.setItem('alanube_company_id', resolvedConfig.company_id);
            localStorage.setItem('alanube_rnc_emisor', resolvedConfig.rnc_emisor);
            localStorage.setItem('alanube_razon_social', resolvedConfig.razon_social);
            localStorage.setItem('alanube_environment', resolvedConfig.environment);
            localStorage.setItem('alanube_base_url', resolvedConfig.base_url);
            localStorage.setItem('alanube_sequence_due_date', resolvedConfig.sequence_due_date);
          } catch (e) {
            console.warn('No se pudo guardar cache local de alanube:', e);
          }
        }

        return resolvedConfig;
      }

      // Si no existe fila en Supabase para este store, verificar respaldo offline
      if (typeof window !== 'undefined') {
        const cachedStr = localStorage.getItem(`alanube_cache_${storeId}`);
        if (cachedStr) {
          try {
            return JSON.parse(cachedStr);
          } catch (e) {}
        }
      }

      return {
        api_token: '',
        environment: 'PRODUCTION',
        base_url: 'https://api.alanube.co',
        rnc_emisor: '',
        razon_social: '',
        company_id: '01M0TYPKJ0JGVM53K56D7X9P7Z',
        sequence_due_date: '2027-12-31',
        is_active: false,
      };
    } catch (err) {
      console.error('Excepción al consultar alanube_config:', err);
      // Fallback offline seguro
      if (typeof window !== 'undefined') {
        const cachedStr = localStorage.getItem(`alanube_cache_${storeId}`);
        if (cachedStr) {
          try {
            return JSON.parse(cachedStr);
          } catch (e) {}
        }
      }
      return null;
    }
  };

  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ['alanubeConfig', storeId],
    queryFn: fetchConfig,
    enabled: !!storeId,
    staleTime: 1000 * 30, // 30 segundos
    refetchOnWindowFocus: true,
  });

  const updateConfig = async (newConfig: Partial<AlanubeConfig & { is_active: boolean }>) => {
    if (!storeId) {
      throw new Error('No se ha encontrado la tienda activa para guardar la configuración.');
    }

    setIsUpdating(true);

    try {
      const rawRnc = (newConfig.rnc_emisor || '').replace(/[^0-9]/g, '');
      let effectiveId = newConfig.company_id || (rawRnc === '133695189' ? '01M2RBT1TH2R6NFHSEJH2GB672' : '01M0TYPKJ0JGVM53K56D7X9P7Z');
      if (rawRnc === '133695189' && (!effectiveId || effectiveId.startsWith('01M0TYPK'))) {
        effectiveId = '01M2RBT1TH2R6NFHSEJH2GB672';
      } else if (effectiveId === '01M0TYPKJGJVM53K56D7X9P7Z') {
        effectiveId = '01M0TYPKJ0JGVM53K56D7X9P7Z';
      }

      // 1. Verificar si la fila ya existe en Supabase
      const { data: existingRow } = await supabase
        .from('alanube_config')
        .select('id')
        .eq('store_id', storeId)
        .maybeSingle();

      const payload: any = {
        updated_at: new Date().toISOString()
      };

      if (newConfig.api_token !== undefined) payload.api_token = newConfig.api_token.trim();
      if (newConfig.environment !== undefined) payload.environment = newConfig.environment;
      if (newConfig.base_url !== undefined) payload.base_url = newConfig.base_url.trim();
      if (newConfig.rnc_emisor !== undefined) payload.rnc_emisor = newConfig.rnc_emisor.trim();
      if (newConfig.razon_social !== undefined) payload.razon_social = newConfig.razon_social.trim();
      if (newConfig.company_id !== undefined || !existingRow) payload.company_id = effectiveId.trim();
      if ((newConfig as any).sequence_due_date !== undefined || !existingRow) {
        payload.sequence_due_date = ((newConfig as any).sequence_due_date || '2027-12-31').trim();
      }
      if (newConfig.certificado_digital !== undefined) payload.certificado_digital = newConfig.certificado_digital;
      if (newConfig.certificado_password !== undefined) payload.certificado_password = newConfig.certificado_password;
      if (newConfig.is_active !== undefined) payload.is_active = Boolean(newConfig.is_active);

      if (existingRow) {
        const { error } = await supabase
          .from('alanube_config')
          .update(payload)
          .eq('store_id', storeId);

        if (error) {
          console.error('Error al actualizar alanube_config en Supabase:', error);
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('alanube_config')
          .insert({
            store_id: storeId,
            api_token: payload.api_token || '',
            environment: payload.environment || 'PRODUCTION',
            base_url: payload.base_url || 'https://api.alanube.co',
            rnc_emisor: payload.rnc_emisor || '',
            razon_social: payload.razon_social || '',
            company_id: payload.company_id || effectiveId,
            sequence_due_date: payload.sequence_due_date || '2027-12-31',
            certificado_digital: payload.certificado_digital || null,
            certificado_password: payload.certificado_password || null,
            is_active: payload.is_active !== undefined ? payload.is_active : true,
          });

        if (error) {
          console.error('Error al insertar alanube_config en Supabase:', error);
          throw error;
        }
      }

      // 2. Actualizar cache local
      if (typeof window !== 'undefined') {
        try {
          const merged = { ...config, ...payload };
          localStorage.setItem(`alanube_cache_${storeId}`, JSON.stringify(merged));
          if (payload.is_active !== undefined) {
            localStorage.setItem('alanube_billing_mode', payload.is_active ? 'e-ncf' : 'ncf');
          }
          if (payload.company_id) localStorage.setItem('alanube_company_id', payload.company_id);
          if (payload.rnc_emisor) localStorage.setItem('alanube_rnc_emisor', payload.rnc_emisor);
          if (payload.razon_social) localStorage.setItem('alanube_razon_social', payload.razon_social);
          if (payload.environment) localStorage.setItem('alanube_environment', payload.environment);
          if (payload.base_url) localStorage.setItem('alanube_base_url', payload.base_url);
          if (payload.sequence_due_date) localStorage.setItem('alanube_sequence_due_date', payload.sequence_due_date);
        } catch (e) {
          console.warn('Error sincronizando cache local de alanube:', e);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['alanubeConfig', storeId] });
      await refetch();
    } catch (err) {
      console.error('Error updating Alanube config:', err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    config,
    isLoading: isLoading || isUserStoreLoading,
    isUpdating,
    updateConfig,
    refetch
  };
};
