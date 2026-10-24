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
    let localCompanyId = typeof window !== 'undefined' ? localStorage.getItem('alanube_company_id') : null;
    if (localCompanyId === '01M0TYPKJGJVM53K56D7X9P7Z') {
      localCompanyId = '01M0TYPKJ0JGVM53K56D7X9P7Z';
      if (typeof window !== 'undefined') localStorage.setItem('alanube_company_id', localCompanyId);
    }
    const localMode = typeof window !== 'undefined' ? localStorage.getItem('alanube_billing_mode') : null;
    const localToken = typeof window !== 'undefined' ? localStorage.getItem('alanube_api_token') : null;
    const localRnc = typeof window !== 'undefined' ? localStorage.getItem('alanube_rnc_emisor') : null;
    const localRazon = typeof window !== 'undefined' ? localStorage.getItem('alanube_razon_social') : null;
    const localEnv = (typeof window !== 'undefined' ? localStorage.getItem('alanube_environment') : null) as 'SANDBOX' | 'PRODUCTION' | null;
    const localBaseUrl = typeof window !== 'undefined' ? localStorage.getItem('alanube_base_url') : null;

    if (!storeId) {
      return {
        api_token: localToken || '',
        environment: localEnv || 'PRODUCTION',
        base_url: localBaseUrl || 'https://api.alanube.co',
        rnc_emisor: localRnc || '',
        razon_social: localRazon || '',
        company_id: localCompanyId || '01M0TYPKJ0JGVM53K56D7X9P7Z',
        is_active: localMode ? localMode === 'e-ncf' : false,
      } as AlanubeConfig & { is_active: boolean };
    }

    const { data, error } = await supabase
      .from('alanube_config')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();

    if (error) {
      console.warn("Error fetching alanube_config:", error);
    }

    const dbIsActive = (data as any)?.is_active;
    const resolvedIsActive = localMode
      ? localMode === 'e-ncf'
      : Boolean(dbIsActive);

    if (typeof window !== 'undefined' && !localMode && dbIsActive !== undefined) {
      localStorage.setItem('alanube_billing_mode', dbIsActive ? 'e-ncf' : 'ncf');
    }

    return {
      ...(data as any),
      api_token: (data as any)?.api_token || localToken || '',
      environment: (data as any)?.environment || localEnv || 'PRODUCTION',
      base_url: (data as any)?.base_url || localBaseUrl || 'https://api.alanube.co',
      rnc_emisor: (data as any)?.rnc_emisor || localRnc || '',
      razon_social: (data as any)?.razon_social || localRazon || '',
      company_id: (data as any)?.company_id || localCompanyId || '01M0TYPKJ0JGVM53K56D7X9P7Z',
      is_active: resolvedIsActive,
    } as AlanubeConfig & { is_active: boolean };
  };

  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ['alanubeConfig', storeId],
    queryFn: fetchConfig,
    enabled: !!storeId,
  });

  const updateConfig = async (newConfig: Partial<AlanubeConfig & { is_active: boolean }>) => {
    setIsUpdating(true);

    try {
      const { company_id, ...supabasePayload } = newConfig;
      let effectiveId = company_id || '01M0TYPKJ0JGVM53K56D7X9P7Z';
      if (effectiveId === '01M0TYPKJGJVM53K56D7X9P7Z') {
        effectiveId = '01M0TYPKJ0JGVM53K56D7X9P7Z';
      }
      if (typeof window !== 'undefined') {
        if (company_id !== undefined) localStorage.setItem('alanube_company_id', effectiveId);
        if (supabasePayload.is_active !== undefined) {
          localStorage.setItem('alanube_billing_mode', supabasePayload.is_active ? 'e-ncf' : 'ncf');
        }
        if (supabasePayload.api_token !== undefined) localStorage.setItem('alanube_api_token', supabasePayload.api_token);
        if (supabasePayload.rnc_emisor !== undefined) localStorage.setItem('alanube_rnc_emisor', supabasePayload.rnc_emisor);
        if (supabasePayload.razon_social !== undefined) localStorage.setItem('alanube_razon_social', supabasePayload.razon_social);
        if (supabasePayload.environment !== undefined) localStorage.setItem('alanube_environment', supabasePayload.environment);
        if (supabasePayload.base_url !== undefined) localStorage.setItem('alanube_base_url', supabasePayload.base_url);
      }

      if (storeId) {
        const { data: existingRow } = await supabase
          .from('alanube_config')
          .select('store_id')
          .eq('store_id', storeId)
          .maybeSingle();

        if (existingRow) {
          const { error } = await supabase
            .from('alanube_config')
            .update(supabasePayload)
            .eq('store_id', storeId);
          
          if (error) console.warn("Warning updating alanube_config in DB:", error);
        } else {
          const { error } = await supabase
            .from('alanube_config')
            .insert({
              store_id: storeId,
              api_token: supabasePayload.api_token || (typeof window !== 'undefined' ? localStorage.getItem('alanube_api_token') || '' : ''),
              environment: supabasePayload.environment || 'PRODUCTION',
              base_url: supabasePayload.base_url || 'https://api.alanube.co',
              rnc_emisor: supabasePayload.rnc_emisor || (typeof window !== 'undefined' ? localStorage.getItem('alanube_rnc_emisor') || '' : ''),
              razon_social: supabasePayload.razon_social || (typeof window !== 'undefined' ? localStorage.getItem('alanube_razon_social') || '' : ''),
              certificado_digital: supabasePayload.certificado_digital || null,
              certificado_password: supabasePayload.certificado_password || null,
              is_active: supabasePayload.is_active !== undefined ? supabasePayload.is_active : true
            });
          
          if (error) console.warn("Warning inserting alanube_config in DB:", error);
        }

        await queryClient.invalidateQueries({ queryKey: ['alanubeConfig'] });
        await refetch();
      }
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
