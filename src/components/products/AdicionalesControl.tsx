import React, { useState, useMemo } from 'react';
import {
  Plus, Edit, Trash2, Search, Calculator, PlusCircle, Scale,
  DollarSign, Sparkles, AlertCircle, Check, Layers, RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { RestaurantIngredient, ProductRecipe, useUpsertRecipeItem, useDeleteRecipeItem } from '@/hooks/useRestaurantInventory';
import { useCreateProductOffline, useUpdateProductOffline, useDeleteProductOffline } from '@/hooks/useProductsOffline';
import { useCategories, useCreateCategory } from '@/hooks/useCategories';
import { useToast } from '@/hooks/use-toast';

interface AdicionalesControlProps {
  ingredients: RestaurantIngredient[];
  products: any[];
  recipes: ProductRecipe[];
  preselectedIngredient?: RestaurantIngredient | null;
  onClearPreselectedIngredient?: () => void;
}

export const AdicionalesControl: React.FC<AdicionalesControlProps> = ({
  ingredients,
  products,
  recipes,
  preselectedIngredient,
  onClearPreselectedIngredient
}) => {
  const { toast } = useToast();
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const createProduct = useCreateProductOffline();
  const updateProduct = useUpdateProductOffline();
  const deleteProduct = useDeleteProductOffline();
  const upsertRecipeItem = useUpsertRecipeItem();
  const deleteRecipeItem = useDeleteRecipeItem();

  const [searchTerm, setSearchTerm] = useState('');
  const [showExtraDialog, setShowExtraDialog] = useState(false);
  const [editingExtra, setEditingExtra] = useState<any | null>(null);

  // Form & Calculator State
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('');
  const [extraName, setExtraName] = useState<string>('');
  const [portionQty, setPortionQty] = useState<number>(1);
  const [markupPercent, setMarkupPercent] = useState<number>(100);
  const [manualPrice, setManualPrice] = useState<string>('');
  const [useManualPrice, setUseManualPrice] = useState<boolean>(false);

  // Handle opening dialog with preselected ingredient
  React.useEffect(() => {
    if (preselectedIngredient) {
      handleOpenCreateDialog(preselectedIngredient);
      if (onClearPreselectedIngredient) onClearPreselectedIngredient();
    }
  }, [preselectedIngredient]);

  // Find or create 'Adicionales' category
  const adicionalesCategory = useMemo(() => {
    return categories.find(c => c.name.toLowerCase().includes('adicional') || c.name.toLowerCase().includes('extra'));
  }, [categories]);

  // Filter products that are in 'Adicionales' category or have extra recipes
  const extraProducts = useMemo(() => {
    return products.filter(p => {
      const isCat = adicionalesCategory && p.category_id === adicionalesCategory.id;
      const isAdicionalName = p.name.toLowerCase().startsWith('extra ') || p.name.toLowerCase().includes('adicional');
      const hasRecipe = recipes.some(r => r.product_id === p.id);
      return isCat || isAdicionalName || hasRecipe;
    });
  }, [products, adicionalesCategory, recipes]);

  const filteredExtras = useMemo(() => {
    if (!searchTerm) return extraProducts;
    const term = searchTerm.toLowerCase();
    return extraProducts.filter(p => p.name.toLowerCase().includes(term));
  }, [extraProducts, searchTerm]);

  // Selected Ingredient for Form
  const selectedIngredient = useMemo(() => {
    return ingredients.find(i => i.id === selectedIngredientId);
  }, [ingredients, selectedIngredientId]);

  // Calculated portion cost and sale price
  const portionCost = useMemo(() => {
    if (!selectedIngredient) return 0;
    return (selectedIngredient.cost_per_unit || 0) * (portionQty || 0);
  }, [selectedIngredient, portionQty]);

  const calculatedSalePrice = useMemo(() => {
    if (portionCost <= 0) return 0;
    return portionCost * (1 + (markupPercent || 0) / 100);
  }, [portionCost, markupPercent]);

  const finalSalePrice = useMemo(() => {
    if (useManualPrice && manualPrice !== '') {
      return Number(manualPrice) || 0;
    }
    return Math.round(calculatedSalePrice);
  }, [useManualPrice, manualPrice, calculatedSalePrice]);

  const netProfit = useMemo(() => {
    return finalSalePrice - portionCost;
  }, [finalSalePrice, portionCost]);

  const realMarkup = useMemo(() => {
    if (portionCost <= 0) return 0;
    return Math.round(((finalSalePrice - portionCost) / portionCost) * 100);
  }, [finalSalePrice, portionCost]);

  // Open Create Dialog
  const handleOpenCreateDialog = (ing?: RestaurantIngredient) => {
    setEditingExtra(null);
    if (ing) {
      setSelectedIngredientId(ing.id);
      setExtraName(`Extra ${ing.name}`);
      setPortionQty(ing.unit === 'lb' ? 0.25 : 1);
    } else if (ingredients.length > 0) {
      setSelectedIngredientId(ingredients[0].id);
      setExtraName(`Extra ${ingredients[0].name}`);
      setPortionQty(ingredients[0].unit === 'lb' ? 0.25 : 1);
    } else {
      setSelectedIngredientId('');
      setExtraName('');
      setPortionQty(1);
    }
    setMarkupPercent(100);
    setUseManualPrice(false);
    setManualPrice('');
    setShowExtraDialog(true);
  };

  // Open Edit Dialog
  const handleOpenEditDialog = (product: any) => {
    setEditingExtra(product);
    setExtraName(product.name);
    setManualPrice(String(product.price));
    setUseManualPrice(true);

    const recipe = recipes.find(r => r.product_id === product.id);
    if (recipe) {
      setSelectedIngredientId(recipe.ingredient_id);
      setPortionQty(recipe.quantity);
      const ing = ingredients.find(i => i.id === recipe.ingredient_id);
      if (ing && ing.cost_per_unit > 0) {
        const cost = ing.cost_per_unit * recipe.quantity;
        const margin = Math.round(((product.price - cost) / cost) * 100);
        setMarkupPercent(margin > 0 ? margin : 100);
      }
    }
    setShowExtraDialog(true);
  };

  // Save Extra
  const handleSaveExtra = async () => {
    if (!extraName.trim()) {
      toast({ title: 'Campo requerido', description: 'Por favor ingresa un nombre para el adicional.', variant: 'destructive' });
      return;
    }
    if (finalSalePrice < 0) {
      toast({ title: 'Precio inválido', description: 'El precio de venta no puede ser negativo.', variant: 'destructive' });
      return;
    }

    try {
      // 1. Ensure 'Adicionales' category exists
      let targetCategoryId = adicionalesCategory?.id;
      if (!targetCategoryId) {
        try {
          const newCat = await createCategory.mutateAsync({ name: 'Adicionales', is_active: true });
          if (newCat && newCat.id) targetCategoryId = newCat.id;
        } catch (catErr) {
          console.warn('Could not auto-create category Adicionales:', catErr);
        }
      }

      let productId = editingExtra?.id;

      if (editingExtra) {
        // Update Existing Product
        await updateProduct.mutateAsync({
          id: editingExtra.id,
          name: extraName.trim(),
          price: finalSalePrice,
          cost: portionCost,
          category_id: targetCategoryId || editingExtra.category_id,
          status: 'active'
        });
      } else {
        // Create New Product
        const newProduct = await createProduct.mutateAsync({
          name: extraName.trim(),
          price: finalSalePrice,
          cost: portionCost,
          category_id: targetCategoryId || null,
          stock: 9999,
          min_stock: 0,
          status: 'active',
          track_inventory: true
        });
        if (newProduct && newProduct.id) {
          productId = newProduct.id;
        }
      }

      // 2. Link Recipe to Ingredient if ingredient selected
      if (productId && selectedIngredientId && portionQty > 0) {
        await upsertRecipeItem.mutateAsync({
          product_id: productId,
          ingredient_id: selectedIngredientId,
          quantity: portionQty
        });
      }

      toast({
        title: editingExtra ? 'Adicional actualizado' : 'Adicional creado',
        description: `"${extraName}" guardado con éxito. Precio de venta: $${finalSalePrice.toLocaleString()}`,
      });

      setShowExtraDialog(false);
      setEditingExtra(null);
    } catch (err: any) {
      console.error('Error saving extra:', err);
      toast({
        title: 'Error al guardar',
        description: err.message || 'No se pudo guardar el adicional.',
        variant: 'destructive'
      });
    }
  };

  // Delete Extra
  const handleDeleteExtra = async (product: any) => {
    if (!confirm(`¿Estás seguro de eliminar el adicional "${product.name}"?`)) return;

    try {
      const recipe = recipes.find(r => r.product_id === product.id);
      if (recipe) {
        await deleteRecipeItem.mutateAsync({ id: recipe.id, product_id: product.id });
      }
      await deleteProduct.mutateAsync(product.id);
      toast({ title: 'Adicional eliminado', description: `"${product.name}" ha sido eliminado del menú.` });
    } catch (err: any) {
      toast({ title: 'Error al eliminar', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Calculator Intro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">
              <PlusCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Adicionales Configurados</p>
              <h3 className="text-2xl font-black text-foreground">{extraProducts.length} <span className="text-xs font-normal text-muted-foreground">adicionales en menú</span></h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Margen de Ganancia Base</p>
              <h3 className="text-2xl font-black text-amber-400">100% <span className="text-xs font-normal text-muted-foreground">(Duplica el costo porción)</span></h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20 flex items-center justify-center p-4">
          <Button onClick={() => handleOpenCreateDialog()} className="w-full h-full text-sm font-bold bg-emerald-600 hover:bg-emerald-500 gap-2 shadow-lg shadow-emerald-600/20 rounded-xl">
            <Plus className="h-5 w-5" />
            Crear Nuevo Adicional / Extra
          </Button>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar adicional o extra por nombre..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => handleOpenCreateDialog()} variant="outline" className="gap-2 shrink-0 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10">
          <Sparkles className="h-4 w-4" />
          Calculadora de Adicionales
        </Button>
      </div>

      {/* Extras Grid */}
      {filteredExtras.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <PlusCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-bold text-lg text-foreground">No tienes adicionales registrados</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
            Crea extras para tus platos (ej: Extra Carne Salada, Extra Queso, Extra Chicharrón). Calcula su precio de venta en base al costo del ingrediente y tu margen de ganancia.
          </p>
          <Button onClick={() => handleOpenCreateDialog()} className="bg-emerald-600 hover:bg-emerald-500">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Primer Adicional
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExtras.map(product => {
            const recipe = recipes.find(r => r.product_id === product.id);
            const ingredient = recipe ? ingredients.find(i => i.id === recipe.ingredient_id) : null;
            const portion = recipe ? recipe.quantity : 0;
            const unitCost = ingredient ? ingredient.cost_per_unit * portion : (product.cost || 0);
            const profit = product.price - unitCost;
            const marginPct = unitCost > 0 ? Math.round((profit / unitCost) * 100) : 0;
            
            // Calculate available portions in stock
            const portionsAvailable = ingredient && portion > 0 ? Math.floor(ingredient.stock / portion) : null;

            return (
              <Card key={product.id} className="bg-card border-border/60 hover:border-emerald-500/40 transition-all shadow-sm group">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-base text-foreground group-hover:text-emerald-400 transition-colors">
                        {product.name}
                      </h4>
                      {ingredient ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Layers className="h-3 w-3 text-emerald-400" />
                          Ingrediente: <span className="font-semibold text-foreground">{ingredient.name}</span> ({portion} {ingredient.unit})
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">Adicional sin receta vinculada</p>
                      )}
                    </div>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-black text-sm px-2.5 py-1">
                      ${product.price.toLocaleString()}
                    </Badge>
                  </div>

                  {/* Financial Metrics */}
                  <div className="grid grid-cols-3 gap-2 bg-muted/20 p-2.5 rounded-xl text-xs border border-border/40">
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase block font-semibold">Costo Porción</span>
                      <span className="font-bold text-foreground">${unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase block font-semibold">Margen %</span>
                      <span className="font-bold text-emerald-400">+{marginPct}%</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase block font-semibold">Ganancia Neta</span>
                      <span className="font-bold text-emerald-400">+${profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Stock Availability */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    {portionsAvailable !== null ? (
                      <span className={`font-semibold flex items-center gap-1 text-[11px] ${portionsAvailable <= 5 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                        <Scale className="h-3 w-3" />
                        Disponibles: <strong className="text-foreground">{portionsAvailable} porciones</strong> ({ingredient?.stock} {ingredient?.unit} en inv.)
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Disponibilidad según POS</span>
                    )}

                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg" onClick={() => handleOpenEditDialog(product)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-lg" onClick={() => handleDeleteExtra(product)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Calculator Modal Dialog */}
      <Dialog open={showExtraDialog} onOpenChange={setShowExtraDialog}>
        <DialogContent className="max-w-md bg-card border-border/80 text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-emerald-400">
              <Calculator className="h-5 w-5 text-emerald-400" />
              {editingExtra ? 'Editar Adicional' : 'Calculadora de Adicionales & Extras'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configura el precio de venta calculando el costo por porción y tu margen de ganancia deseado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* 1. Select Ingredient */}
            <div className="space-y-1.5">
              <Label className="font-bold text-foreground">1. Ingrediente Base del Adicional</Label>
              <Select value={selectedIngredientId} onValueChange={id => {
                setSelectedIngredientId(id);
                const ing = ingredients.find(i => i.id === id);
                if (ing) {
                  setExtraName(`Extra ${ing.name}`);
                  setPortionQty(ing.unit === 'lb' ? 0.25 : 1);
                }
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un ingrediente de inventario..." />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map(ing => (
                    <SelectItem key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit}) — Costo: ${ing.cost_per_unit.toLocaleString()}/{ing.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Extra Name */}
            <div className="space-y-1.5">
              <Label className="font-bold text-foreground">2. Nombre del Adicional (Menú / POS)</Label>
              <Input
                value={extraName}
                onChange={e => setExtraName(e.target.value)}
                placeholder="Ej. Extra Carne Salada, Extra Queso..."
              />
            </div>

            {/* 3. Portion Quantity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-bold text-foreground">3. Porción por Adicional</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={portionQty}
                    onChange={e => setPortionQty(Number(e.target.value))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-[11px]">
                    {selectedIngredient?.unit || 'unidad'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-foreground">Costo de Porción</Label>
                <div className="p-2 bg-muted/30 border border-border/50 rounded-md font-bold text-sm text-amber-400 flex items-center justify-between">
                  <span>Calculado:</span>
                  <span>${portionCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* 4. Markup Percentage Slider / Buttons */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="flex justify-between items-center">
                <Label className="font-bold text-foreground">4. Margen de Ganancia (%)</Label>
                <span className="font-black text-emerald-400 text-sm">+{markupPercent}%</span>
              </div>
              
              <div className="flex gap-2">
                {[50, 100, 150, 200, 300].map(pct => (
                  <Button
                    key={pct}
                    type="button"
                    size="sm"
                    variant={markupPercent === pct ? 'default' : 'outline'}
                    className={`flex-1 h-7 text-xs ${markupPercent === pct ? 'bg-emerald-600 hover:bg-emerald-500 font-bold' : ''}`}
                    onClick={() => {
                      setMarkupPercent(pct);
                      setUseManualPrice(false);
                    }}
                  >
                    {pct}%
                  </Button>
                ))}
              </div>

              <Input
                type="number"
                min="0"
                step="5"
                value={markupPercent}
                onChange={e => {
                  setMarkupPercent(Number(e.target.value));
                  setUseManualPrice(false);
                }}
                placeholder="Porcentaje de margen personalizado..."
                className="mt-1.5"
              />
            </div>

            {/* Live Formula Breakdown Box */}
            <div className="p-3 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 rounded-xl space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Fórmula de cálculo:</span>
                <span className="font-semibold text-foreground">Costo (${portionCost}) × (1 + {markupPercent}%)</span>
              </div>
              <div className="flex justify-between items-center text-sm pt-1 border-t border-emerald-500/20">
                <span className="font-bold text-foreground">Precio de Venta Sugerido:</span>
                <span className="text-base font-black text-emerald-400">${Math.round(calculatedSalePrice).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[11px] text-emerald-400/90 font-medium">
                <span>Ganancia Neta estimada:</span>
                <span>+${(Math.round(calculatedSalePrice) - portionCost).toLocaleString()} por porción</span>
              </div>
            </div>

            {/* 5. Custom / Rounded Final Selling Price */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="font-bold text-foreground">5. Precio Final de Venta en POS ($)</Label>
                <button
                  type="button"
                  onClick={() => setUseManualPrice(!useManualPrice)}
                  className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className="h-3 w-3" />
                  {useManualPrice ? 'Usar precio sugerido' : 'Personalizar o redondear'}
                </button>
              </div>

              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                <Input
                  type="number"
                  step="1"
                  value={useManualPrice ? manualPrice : Math.round(calculatedSalePrice)}
                  onChange={e => {
                    setUseManualPrice(true);
                    setManualPrice(e.target.value);
                  }}
                  className="pl-9 font-black text-base text-emerald-400 bg-emerald-500/5 border-emerald-500/40"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setShowExtraDialog(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSaveExtra} className="bg-emerald-600 hover:bg-emerald-500 font-bold gap-2">
              <Check className="h-4 w-4" />
              {editingExtra ? 'Guardar Cambios' : 'Crear Adicional'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdicionalesControl;
