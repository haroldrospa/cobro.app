import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { shopperSupabase } from '@/integrations/supabase/shopperClient';
import { useUserStore } from '@/hooks/useUserStore';
import { useToast } from '@/hooks/use-toast';

export interface PromotionalBanner {
  id: string;
  store_id: string | null;
  title: string | null;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const usePromotionalBanners = () => {
  const { data: userStore } = useUserStore();

  return useQuery({
    queryKey: ['promotional-banners', userStore?.id],
    queryFn: async () => {
      if (!userStore?.id) return [];

      const { data, error } = await supabase
        .from('promotional_banners')
        .select('*')
        .eq('store_id', userStore.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as PromotionalBanner[];
    },
    enabled: !!userStore?.id,
  });
};

export const useStoreBanners = (storeId: string | undefined) => {
  return useQuery({
    queryKey: ['store-banners', storeId],
    queryFn: async () => {
      if (!storeId) return [];

      const { data, error } = await shopperSupabase
        .from('promotional_banners')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as PromotionalBanner[];
    },
    enabled: !!storeId,
  });
};

export const useCreateBanner = () => {
  const queryClient = useQueryClient();
  const { data: userStore } = useUserStore();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (banner: Partial<PromotionalBanner>) => {
      if (!userStore?.id) throw new Error('No store found');

      const { data, error } = await supabase
        .from('promotional_banners')
        .insert({
          store_id: userStore.id,
          title: banner.title,
          subtitle: banner.subtitle,
          image_url: banner.image_url,
          link_url: banner.link_url,
          is_active: banner.is_active ?? true,
          sort_order: banner.sort_order ?? 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotional-banners'] });
      toast({ title: 'Banner creado', description: 'El banner se ha creado correctamente.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateBanner = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PromotionalBanner> & { id: string }) => {
      const { data, error } = await supabase
        .from('promotional_banners')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotional-banners'] });
      toast({ title: 'Banner actualizado', description: 'El banner se ha actualizado correctamente.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteBanner = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('promotional_banners')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotional-banners'] });
      toast({ title: 'Banner eliminado', description: 'El banner se ha eliminado correctamente.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
};
