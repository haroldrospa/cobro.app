
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    staleTime: Infinity, // MasterData: Never refetch automatically
    gcTime: Infinity, // MasterData: Keep in cache indefinitely
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Get current user's store_id to ensure complete isolation
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.store_id) return [];

      // Explicitly filter by store_id to ignore global categories (store_id IS NULL)
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('store_id', profile.store_id)
        .order('name');

      if (error) {
        console.error('Error loading categories:', error);
        throw error;
      }

      // Filter duplicates by name directly in the hook
      const uniqueCategories = new Map();
      (data || []).forEach((cat: Category) => {
        const name = cat.name ? cat.name.trim().toLowerCase() : '';
        if (name && !uniqueCategories.has(name)) {
          uniqueCategories.set(name, cat);
        }
      });

      return Array.from(uniqueCategories.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (category: { name: string; description?: string }) => {
      // Get current user's store_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

      // Check if category with same name already exists for this store
      const { data: existing } = await supabase
        .from('categories')
        .select('*')
        .ilike('name', category.name.trim())
        .maybeSingle();

      if (existing) {
        // Return existing category instead of failing or duplicating
        return existing;
      }

      const { data, error } = await supabase
        .from('categories')
        .insert([{
          ...category,
          name: category.name.trim(),
          store_id: profile?.store_id || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['categories'] });
      const previousCategories = queryClient.getQueryData(['categories']);

      queryClient.setQueryData(['categories'], (old: Category[] | undefined) => {
        return old?.filter(c => c.id !== id) || [];
      });

      return { previousCategories };
    },
    mutationFn: async (id: string) => {
      // 1. Get the category's name to find any hidden duplicates
      const { data: cat } = await supabase
        .from('categories')
        .select('name')
        .eq('id', id)
        .maybeSingle();

      let idsToDelete = [id];

      // 2. If we found the name, look for all category IDs sharing this exact name (case-insensitive)
      if (cat && cat.name) {
        const targetName = cat.name.trim().toLowerCase();
        const { data: allCats } = await supabase
          .from('categories')
          .select('id, name');

        if (allCats && allCats.length > 0) {
          const duplicateIds = allCats
            .filter(c => c.name && c.name.trim().toLowerCase() === targetName)
            .map(c => c.id);

          if (duplicateIds.length > 0) {
            idsToDelete = duplicateIds;
          }
        }
      }

      // 3. Unassign this category from ALL products first to avoid Foreign Key constraint errors!
      const { error: updateErr } = await supabase
        .from('products')
        .update({ category_id: null })
        .in('category_id', idsToDelete);

      if (updateErr) {
        console.warn("Error unassigning products from category:", updateErr);
      }

      // 4. Safely delete all instances of this category from the database
      const { data: deletedRows, error: deleteErr } = await supabase
        .from('categories')
        .delete()
        .in('id', idsToDelete)
        .select();

      if (deleteErr) throw deleteErr;

      if (!deletedRows || deletedRows.length === 0) {
        throw new Error("No tienes permisos para eliminar esta categoría o es una categoría global por defecto.");
      }
    },
    onError: (err, id, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(['categories'], context.previousCategories);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};
export const useUpdateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...category }: { id: string; name: string; description?: string }) => {
      const { data, error } = await supabase
        .from('categories')
        .update(category)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};
