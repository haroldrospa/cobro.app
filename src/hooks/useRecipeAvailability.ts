/**
 * useRecipeAvailability
 *
 * Returns a Map<productId, availableUnits> computed from the current
 * ingredient stocks and the product recipes.
 *
 * - Products WITH a recipe → min(floor(ingredient.stock / qty_per_unit))
 * - Products WITHOUT a recipe → undefined (not in the map)
 *
 * The map is shared across Products page, POS, and any other view that
 * needs to show how many units of each menu item can be assembled.
 */
import { useMemo } from 'react';
import { useAllProductRecipes, useRestaurantIngredients } from './useRestaurantInventory';
import { useBusinessType } from './useBusinessType';

export const useRecipeAvailability = () => {
  const { isRestaurant } = useBusinessType();

  // Only fetch data when the business is a restaurant
  const { data: allRecipes = [] } = useAllProductRecipes();
  const { data: ingredients = [] } = useRestaurantIngredients();

  const availabilityMap = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    if (!isRestaurant || allRecipes.length === 0) return map;

    // Build a lookup: ingredientId → latest stock
    const stockById = new Map<string, number>();
    for (const ing of ingredients) {
      stockById.set(ing.id, ing.stock);
    }

    // Group recipes by product
    const recipesByProduct = new Map<string, typeof allRecipes>();
    for (const r of allRecipes) {
      if (!recipesByProduct.has(r.product_id)) {
        recipesByProduct.set(r.product_id, []);
      }
      recipesByProduct.get(r.product_id)!.push(r);
    }

    // For each product, compute the bottleneck
    for (const [productId, recipes] of recipesByProduct.entries()) {
      let minUnits = Infinity;
      for (const r of recipes) {
        const ingStock = stockById.get(r.ingredient_id) ?? (r.ingredient?.stock ?? 0);
        const perUnit = r.quantity;
        if (perUnit <= 0) continue;
        const can = Math.floor(ingStock / perUnit);
        if (can < minUnits) minUnits = can;
      }
      map.set(productId, minUnits === Infinity ? 0 : minUnits);
    }

    return map;
  }, [isRestaurant, allRecipes, ingredients]);

  return availabilityMap;
};
