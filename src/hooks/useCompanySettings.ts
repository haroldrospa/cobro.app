import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from './useUserStore';
import { useToast } from './use-toast';
import { useEffect } from 'react';

export interface CompanySettings {
  id: string;
  company_name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  rnc: string | null;
  slogan: string | null;
  meta_description: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_twitter: string | null;
  logo_cart_size: number;
  logo_summary_size: number;
  logo_invoice_size: number;
}

export const useCompanySettings = () => {
  const { data: userStore, isLoading: isUserStoreLoading } = useUserStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['company-settings', userStore?.id],
    staleTime: 1000 * 60 * 30, // 30 minutes - company settings rarely change
    gcTime: 1000 * 60 * 60 * 2, // 2 hours in cache
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const isUUID = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      
      if (!isUUID(userStore?.id)) {
        console.warn('useCompanySettings: storeId is missing or invalid UUID. Skipping fetch.');
        return null;
      }

      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('store_id', userStore.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error loading company settings:', error);
        return null;
      }

      const row = (data?.[0] ?? null) as CompanySettings | null;

      return row;
    },
    enabled: !!userStore?.id,
  });

  // Real-time subscription for company settings
  useEffect(() => {
    if (!userStore?.id) return;

    const channel = supabase
      .channel('company-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_settings',
          filter: `store_id=eq.${userStore.id}`,
        },
        (payload) => {
          console.log('Company settings changed:', payload);
          queryClient.invalidateQueries({ queryKey: ['company-settings', userStore.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userStore?.id, queryClient]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<CompanySettings>) => {
      if (!userStore?.id) throw new Error('No store configured');

      if (settings?.id) {
        // Update existing settings
        const { error } = await supabase
          .from('company_settings')
          .update(updates)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Create new settings if none exist
        const { error } = await supabase
          .from('company_settings')
          .insert({
            store_id: userStore.id,
            company_name: updates.company_name || userStore.store_name,
            ...updates,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      toast({
        title: "Configuración guardada",
        description: "Los cambios se han sincronizado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la configuración.",
        variant: "destructive",
      });
    },
  });

  // Upload logo to storage
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!userStore?.id) throw new Error('No store');

      const fileExt = file.name.split('.').pop();
      // Add timestamp to filename to prevent caching issues and ensure unique URL
      const fileName = `${userStore.id}/logo-${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      // Update company settings with logo URL
      await updateSettingsMutation.mutateAsync({ logo_url: publicUrl });

      return publicUrl;
    },
  });

  return {
    settings,
    isLoading: isLoading || isUserStoreLoading,
    updateSettings: updateSettingsMutation.mutateAsync,
    isUpdating: updateSettingsMutation.isPending,
    uploadLogo: uploadLogoMutation.mutateAsync,
    isUploadingLogo: uploadLogoMutation.isPending,
  };
};
