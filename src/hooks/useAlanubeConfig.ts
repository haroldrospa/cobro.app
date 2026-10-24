import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/hooks/useUserStore';
import { AlanubeConfig } from '@/services/alanube/types';

export const useAlanubeConfig = () => {
  const { data: store, isLoading: isUserStoreLoading } = useUserStore();
  const storeId = store?.id;
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();

  const fetchConfig = async () => {
    if (!storeId) return null;

    const { data, error } = await supabase
      .from('alanube_config')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();

    if (error) {
      console.warn("Error fetching alanube_config:", error);
      return null;
    }

    let localCompanyId = typeof window !== 'undefined' ? localStorage.getItem('alanube_company_id') : null;
    if (localCompanyId === '01M0TYPKJGJVM53K56D7X9P7Z') {
      localCompanyId = '01M0TYPKJ0JGVM53K56D7X9P7Z';
      if (typeof window !== 'undefined') localStorage.setItem('alanube_company_id', localCompanyId);
    }

    return {
      ...(data as any),
      company_id: (data as any)?.company_id || localCompanyId || '01M0TYPKJ0JGVM53K56D7X9P7Z'
    } as AlanubeConfig & { is_active: boolean };
  };

  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ['alanubeConfig', storeId],
    queryFn: fetchConfig,
    enabled: !!storeId,
  });

  const updateConfig = async (newConfig: Partial<AlanubeConfig & { is_active: boolean }>) => {
    if (!storeId) return;
    setIsUpdating(true);

    try {
      // Manejar company_id de manera segura con localStorage por compatibilidad con cualquier esquema
      const { company_id, ...supabasePayload } = newConfig;
      let effectiveId = company_id || '01M0TYPKJ0JGVM53K56D7X9P7Z';
      if (effectiveId === '01M0TYPKJGJVM53K56D7X9P7Z') {
        effectiveId = '01M0TYPKJ0JGVM53K56D7X9P7Z';
      }
      if (company_id !== undefined && typeof window !== 'undefined') {
        localStorage.setItem('alanube_company_id', effectiveId);
      }

      const existingConfig = await fetchConfig();
      if (existingConfig) {
        // Update
        const { error } = await supabase
          .from('alanube_config')
          .update(supabasePayload)
          .eq('store_id', storeId);
        
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('alanube_config')
          .insert({
            store_id: storeId,
            api_token: supabasePayload.api_token || '',
            environment: supabasePayload.environment || 'SANDBOX',
            base_url: supabasePayload.base_url || 'https://api.alanube.co',
            rnc_emisor: supabasePayload.rnc_emisor || '',
            razon_social: supabasePayload.razon_social || '',
            certificado_digital: supabasePayload.certificado_digital || null,
            certificado_password: supabasePayload.certificado_password || null,
            is_active: supabasePayload.is_active !== undefined ? supabasePayload.is_active : true
          });
        
        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ['alanubeConfig', storeId] });
      await refetch();
    } catch (err) {
      console.error("Error updating Alanube config:", err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    config,
    isLoading: isLoading || isUserStoreLoading,
    isUpdating,
    updateConfig
  };
};
