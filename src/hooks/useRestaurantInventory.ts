import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from './useUserStore';

export interface RestaurantIngredient {
  id: string;
  store_id: string;
  name: string;
  unit: string;
  stock: number;
  min_stock: number;
  cost_per_unit: number;
  category: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductRecipe {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;
  ingredient?: RestaurantIngredient;
}

// ─── Ingredients CRUD ────────────────────────────────────────────────────────

export const useRestaurantIngredients = () => {
  const { data: userStore } = useUserStore();
  return useQuery({
    queryKey: ['restaurant-ingredients', userStore?.id],
    queryFn: async () => {
      if (!userStore?.id) return [];
      const { data, error } = await supabase
        .from('restaurant_ingredients')
        .select('*')
        .eq('store_id', userStore.id)
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data as RestaurantIngredient[];
    },
    enabled: !!userStore?.id,
  });
};

export const useCreateIngredient = () => {
  const queryClient = useQueryClient();
  const { data: userStore } = useUserStore();
  return useMutation({
    mutationFn: async (ingredient: Omit<RestaurantIngredient, 'id' | 'created_at' | 'updated_at' | 'store_id'>) => {
      if (!userStore?.id) throw new Error('No store');
      const { data, error } = await supabase
        .from('restaurant_ingredients')
        .insert({ ...ingredient, store_id: userStore.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-ingredients'] });
    },
  });
};

export const useUpdateIngredient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RestaurantIngredient> & { id: string }) => {
      const { error } = await supabase
        .from('restaurant_ingredients')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-ingredients'] });
    },
  });
};

export const useDeleteIngredient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('restaurant_ingredients')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-ingredients'] });
    },
  });
};

// ─── Product Recipes ──────────────────────────────────────────────────────────

export const useProductRecipes = (productId?: string) => {
  return useQuery({
    queryKey: ['product-recipes', productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from('product_recipes')
        .select(`
          *,
          ingredient:restaurant_ingredients(*)
        `)
        .eq('product_id', productId);
      if (error) throw error;
      return data as ProductRecipe[];
    },
    enabled: !!productId,
  });
};

export const useAllProductRecipes = () => {
  const { data: userStore } = useUserStore();
  return useQuery({
    queryKey: ['all-product-recipes', userStore?.id],
    queryFn: async () => {
      if (!userStore?.id) return [];
      const { data, error } = await supabase
        .from('product_recipes')
        .select(`
          *,
          ingredient:restaurant_ingredients!inner(*)
        `)
        .eq('restaurant_ingredients.store_id', userStore.id);
      if (error) throw error;
      return data as ProductRecipe[];
    },
    enabled: !!userStore?.id,
  });
};

export const useUpsertRecipeItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: { product_id: string; ingredient_id: string; quantity: number }) => {
      const { error } = await supabase
        .from('product_recipes')
        .upsert(item, { onConflict: 'product_id,ingredient_id' });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['product-recipes', vars.product_id] });
      queryClient.invalidateQueries({ queryKey: ['all-product-recipes'] });
    },
  });
};

export const useDeleteRecipeItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, product_id }: { id: string; product_id: string }) => {
      const { error } = await supabase
        .from('product_recipes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['product-recipes', vars.product_id] });
      queryClient.invalidateQueries({ queryKey: ['all-product-recipes'] });
    },
  });
};

/**
 * Deduct ingredient stock after a sale.
 * Call this with the list of sold items {product_id, quantity}
 */
export const deductIngredientStockForSale = async (
  soldItems: { product_id: string; quantity: number }[]
) => {
  for (const item of soldItems) {
    const { data: recipes } = await supabase
      .from('product_recipes')
      .select('ingredient_id, quantity')
      .eq('product_id', item.product_id);

    if (!recipes || recipes.length === 0) continue;

    for (const recipe of recipes) {
      const toDeduct = recipe.quantity * item.quantity;
      await supabase.rpc('decrement_ingredient_stock', {
        p_ingredient_id: recipe.ingredient_id,
        p_amount: toDeduct,
      });
    }
  }
};

/**
 * Quick mutation to only update the stock field of a product.
 * Used from the inventory control UI for products without a recipe.
 */
export const useUpdateProductStock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stock }: { id: string; stock: number }) => {
      const { error } = await supabase
        .from('products')
        .update({ stock })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

