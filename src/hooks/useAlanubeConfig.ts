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

    return data as AlanubeConfig & { is_active: boolean };
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
      const existingConfig = await fetchConfig();
      if (existingConfig) {
        // Update
        const { error } = await supabase
          .from('alanube_config')
          .update(newConfig)
          .eq('store_id', storeId);
        
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('alanube_config')
          .insert({
            store_id: storeId,
            api_token: newConfig.api_token || '',
            environment: newConfig.environment || 'SANDBOX',
            base_url: newConfig.base_url || 'https://api.alanube.co',
            rnc_emisor: newConfig.rnc_emisor || '',
            razon_social: newConfig.razon_social || '',
            certificado_digital: newConfig.certificado_digital || null,
            certificado_password: newConfig.certificado_password || null,
            is_active: newConfig.is_active !== undefined ? newConfig.is_active : true
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
