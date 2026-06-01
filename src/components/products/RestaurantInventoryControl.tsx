import { useState, useMemo, useCallback } from 'react';
import {
  Plus, Edit, Trash2, Search, ChefHat, Package, AlertTriangle,
  Save, X, ChevronDown, ChevronRight, FlaskConical, Scale, Loader2,
  BookOpen, ShoppingBag, CheckCircle2, DollarSign, Printer
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  useRestaurantIngredients,
  useCreateIngredient,
  useUpdateIngredient,
  useDeleteIngredient,
  useAllProductRecipes,
  useUpsertRecipeItem,
  useDeleteRecipeItem,
  useUpdateProductStock,
  RestaurantIngredient,
  ProductRecipe,
} from '@/hooks/useRestaurantInventory';
import { useProductsOffline } from '@/hooks/useProductsOffline';
import { useToast } from '@/hooks/use-toast';
import { useUserStore } from '@/hooks/useUserStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const UNITS = [
  'unidad', 'par', 'docena',
  'lb', 'oz', 'kg', 'g',
  'lt', 'ml', 'gal', 'taza',
  'paquete', 'lata', 'botella', 'bolsa',
];

const INGREDIENT_CATEGORIES = [
  'Carnes', 'Embutidos', 'Lacteos', 'Panaderia', 'Vegetales',
  'Condimentos', 'Bebidas', 'Granos', 'Aceites', 'General',
];

// ─── Direct-stock products stored in localStorage ─────────────────────────────
// Products marked as "usa stock directo" don't need a recipe — their own
// product stock is decremented at sale time (which already happens by default).

const DIRECT_STOCK_KEY = 'cobro_direct_stock_products';

const getDirectStockSet = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DIRECT_STOCK_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

const saveDirectStockSet = (ids: Set<string>) => {
  localStorage.setItem(DIRECT_STOCK_KEY, JSON.stringify([...ids]));
};

// ─── Types ─────────────────────────────────────────────────────────────────────

type IngredientForm = Omit<RestaurantIngredient, 'id' | 'store_id' | 'created_at' | 'updated_at'>;

const emptyIngredient = (): IngredientForm => ({
  name: '',
  unit: 'unidad',
  stock: 0,
  min_stock: 0,
  cost_per_unit: 0,
  category: 'General',
  notes: '',
});

// ─── IngredientDialog ─────────────────────────────────────────────────────────

interface IngredientDialogProps {
  open: boolean;
  initial?: RestaurantIngredient | null;
  onClose: () => void;
}

const IngredientDialog: React.FC<IngredientDialogProps> = ({ open, initial, onClose }) => {
  const { toast } = useToast();
  const createMutation = useCreateIngredient();
  const updateMutation = useUpdateIngredient();
  const [form, setForm] = useState<IngredientForm>(initial ? {
    name: initial.name,
    unit: initial.unit,
    stock: initial.stock,
    min_stock: initial.min_stock,
    cost_per_unit: initial.cost_per_unit,
    category: initial.category,
    notes: initial.notes || '',
  } : emptyIngredient());

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'Nombre requerido' });
      return;
    }
    try {
      if (initial) {
        await updateMutation.mutateAsync({ id: initial.id, ...form });
        toast({ title: 'Ingrediente actualizado' });
      } else {
        await createMutation.mutateAsync(form);
        toast({ title: 'Ingrediente creado' });
      }
      onClose();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const set = (k: keyof IngredientForm, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            {initial ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre del ingrediente *</label>
            <Input
              placeholder="Ej: Salchichas, Pan de hot dog, Carne molida..."
              value={form.name}
              onChange={e => set('name', e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Categoría</label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INGREDIENT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Unidad de medida</label>
              <Select value={form.unit} onValueChange={v => set('unit', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Stock actual</label>
              <Input type="number" min={0} step="0.1" value={form.stock}
                onChange={e => set('stock', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Stock mínimo</label>
              <Input type="number" min={0} step="0.1" value={form.min_stock}
                onChange={e => set('min_stock', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Costo/{form.unit}</label>
              <Input type="number" min={0} step="0.01" value={form.cost_per_unit}
                onChange={e => set('cost_per_unit', parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notas (opcional)</label>
            <Input placeholder="Marca, proveedor, observaciones..."
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── RecipeDialog ─────────────────────────────────────────────────────────────

interface RecipeDialogProps {
  open: boolean;
  productId: string;
  productName: string;
  recipes: ProductRecipe[];
  ingredients: RestaurantIngredient[];
  isDirectStock: boolean;
  onToggleDirectStock: () => void;
  onClose: () => void;
}

const RecipeDialog: React.FC<RecipeDialogProps> = ({
  open, productId, productName, recipes, ingredients,
  isDirectStock, onToggleDirectStock, onClose
}) => {
  const { toast } = useToast();
  const upsert = useUpsertRecipeItem();
  const deleteItem = useDeleteRecipeItem();
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [qty, setQty] = useState('1');

  const handleAdd = async () => {
    if (!selectedIngredientId) return;
    const q = parseFloat(qty);
    if (isNaN(q) || q <= 0) {
      toast({ variant: 'destructive', title: 'Cantidad inválida' });
      return;
    }
    try {
      await upsert.mutateAsync({ product_id: productId, ingredient_id: selectedIngredientId, quantity: q });
      setSelectedIngredientId('');
      setQty('1');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const availableIngredients = ingredients.filter(
    ing => !recipes.some(r => r.ingredient_id === ing.id)
  );

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {productName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* ── Mode toggle ── */}
          <div className="flex gap-2 p-1 bg-muted/40 rounded-xl border border-border/30">
            <button
              onClick={() => isDirectStock && onToggleDirectStock()}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                !isDirectStock
                  ? 'bg-background shadow-sm text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ChefHat className="h-4 w-4" />
              Tiene receta
            </button>
            <button
              onClick={() => !isDirectStock && onToggleDirectStock()}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                isDirectStock
                  ? 'bg-background shadow-sm text-emerald-600 border border-emerald-500/20'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              Usa stock directo
            </button>
          </div>

          {/* ── Direct stock mode ── */}
          {isDirectStock ? (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <p className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">
                  Stock directo activado
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Al vender <strong>{productName}</strong>, el sistema simplemente descontará 1 unidad del stock del producto directamente. No se descontarán ingredientes adicionales.
              </p>
              <p className="text-xs text-muted-foreground">
                Ideal para jugos, bebidas, postres u otros productos que ya manejan su propio stock.
              </p>
            </div>
          ) : (
            /* ── Recipe mode ── */
            <>
              <p className="text-sm text-muted-foreground">
                Define qué ingredientes se consumen cada vez que se vende <strong>{productName}</strong>.
              </p>

              {recipes.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                    Ingredientes actuales
                  </p>
                  {recipes.map(r => {
                    const lineCost = (r.ingredient?.cost_per_unit ?? 0) * r.quantity;
                    return (
                      <div key={r.id} className="flex items-center justify-between p-2.5 bg-muted/40 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{r.ingredient?.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {r.quantity} {r.ingredient?.unit}
                          </span>
                        </div>
                        {/* Line cost */}
                        <span className="text-xs font-semibold text-muted-foreground mr-2 tabular-nums">
                          ${lineCost.toFixed(2)}
                        </span>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => deleteItem.mutate({ id: r.id, product_id: productId })}
                          disabled={deleteItem.isPending}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}

                  {/* Total cost banner */}
                  {(() => {
                    const totalCost = recipes.reduce(
                      (sum, r) => sum + (r.ingredient?.cost_per_unit ?? 0) * r.quantity, 0
                    );
                    return (
                      <div className="flex items-center justify-between mt-1 px-2.5 py-2 rounded-lg bg-primary/10 border border-primary/20">
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-bold uppercase tracking-wide text-primary">Costo total de receta</span>
                        </div>
                        <span className="text-sm font-bold text-primary tabular-nums">
                          ${totalCost.toFixed(2)}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  <ChefHat className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Aún no hay ingredientes en esta receta
                </div>
              )}

              {availableIngredients.length > 0 && (
                <div className="border-t pt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                    Agregar ingrediente
                  </p>
                  <div className="flex gap-2">
                    <Select value={selectedIngredientId} onValueChange={setSelectedIngredientId}>
                      <SelectTrigger className="flex-1 text-sm">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableIngredients.map(ing => (
                          <SelectItem key={ing.id} value={ing.id}>
                            {ing.name} ({ing.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number" min="0.1" step="0.1"
                      value={qty} onChange={e => setQty(e.target.value)}
                      className="w-20 text-sm" placeholder="Cant."
                    />
                    <Button size="sm" onClick={handleAdd}
                      disabled={!selectedIngredientId || upsert.isPending}>
                      {upsert.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Helper: how many units of a product can be made from current ingredient stocks?
// Returns the minimum of floor(stock / quantity_per_unit) across all recipe items.
const computeAvailableFromRecipe = (recipes: ProductRecipe[]): number => {
  if (recipes.length === 0) return 0;
  let min = Infinity;
  for (const r of recipes) {
    const ingStock = r.ingredient?.stock ?? 0;
    const perUnit = r.quantity;
    if (perUnit <= 0) continue;
    const can = Math.floor(ingStock / perUnit);
    if (can < min) min = can;
  }
  return min === Infinity ? 0 : min;
};

// ─── Main Component ────────────────────────────────────────────────────────────

type Tab = 'ingredients' | 'recipes';

export const RestaurantInventoryControl: React.FC = () => {
  const { toast } = useToast();
  const { data: userStore, isLoading: isStoreLoading } = useUserStore();
  const { data: ingredients = [], isLoading: isIngredientsLoading } = useRestaurantIngredients();
  const { data: products = [], isLoading: isProductsLoading } = useProductsOffline();
  const { data: allRecipes = [], isLoading: isRecipesLoading } = useAllProductRecipes();
  const deleteIngredient = useDeleteIngredient();
  const updateProductStock = useUpdateProductStock();

  const isLoading = isStoreLoading || isIngredientsLoading || isProductsLoading || isRecipesLoading || !userStore?.id;

  const [tab, setTab] = useState<Tab>('ingredients');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showIngredientDialog, setShowIngredientDialog] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<RestaurantIngredient | null>(null);
  const [recipeProduct, setRecipeProduct] = useState<{ id: string; name: string } | null>(null);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  // inline stock edit state for products without recipe
  const [stockEditId, setStockEditId] = useState<string | null>(null);
  const [stockEditValue, setStockEditValue] = useState('0');

  // Direct-stock products: stored in localStorage, loaded once, kept in state
  const [directStockIds, setDirectStockIds] = useState<Set<string>>(getDirectStockSet);

  const toggleDirectStock = useCallback((productId: string) => {
    setDirectStockIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      saveDirectStockSet(next);
      return next;
    });
  }, []);

  // Stats
  const lowStockIngredients = useMemo(() => ingredients.filter(i => i.stock <= i.min_stock), [ingredients]);
  const lowStockCount = lowStockIngredients.length;
  const totalInventoryValue = ingredients.reduce((sum, i) => sum + (i.stock * i.cost_per_unit), 0);

  const handlePrintShoppingList = () => {
    const businessName = userStore?.store_name || "MI NEGOCIO";

    const date = new Date().toLocaleDateString('es-DO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lista de Compras - Ingredientes de Stock Bajo</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header p { font-size: 12px; color: #666; }
          .info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
          .title { background: #f0f0f0; padding: 10px; text-align: center; font-weight: bold; margin-bottom: 15px; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f0f0f0; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${businessName}</h1>
          <p>Control de Inventario - Materia Prima (Restaurante)</p>
        </div>
        <div class="info">
          <div><strong>Fecha:</strong> ${date}</div>
          <div><strong>Total de ingredientes bajos:</strong> ${lowStockIngredients.length}</div>
        </div>
        <div class="title">📋 LISTA DE COMPRAS - INGREDIENTES CON STOCK BAJO</div>
        <table>
          <thead>
            <tr>
              <th style="width: 5%">#</th>
              <th style="width: 45%">Ingrediente</th>
              <th style="width: 25%">Categoría</th>
              <th class="text-center" style="width: 15%">Stock Actual</th>
              <th class="text-center" style="width: 10%">Mínimo</th>
            </tr>
          </thead>
          <tbody>
            ${lowStockIngredients.map((ing, index) => `
              <tr>
                <td class="text-center">${index + 1}</td>
                <td><strong>${ing.name}</strong></td>
                <td>${ing.category || 'General'}</td>
                <td class="text-center" style="color: red; font-weight: bold;">${ing.stock} ${ing.unit}</td>
                <td class="text-center">${ing.min_stock} ${ing.unit}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          <p>Documento generado el ${new Date().toLocaleString('es-DO')}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); }, 250);
    }
  };

  const filteredIngredients = useMemo(() => {
    return ingredients.filter(ing => {
      const matchesSearch = !searchTerm || ing.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCat = selectedCategory === 'all' || ing.category === selectedCategory;
      const matchesLowStock = !showLowStockOnly || ing.stock <= ing.min_stock;
      return matchesSearch && matchesCat && matchesLowStock;
    });
  }, [ingredients, searchTerm, selectedCategory, showLowStockOnly]);

  const groupedIngredients = useMemo(() => {
    const groups: Record<string, RestaurantIngredient[]> = {};
    filteredIngredients.forEach(ing => {
      const cat = ing.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(ing);
    });
    return groups;
  }, [filteredIngredients]);

  const filteredProducts = useMemo(() => {
    if (!recipeSearch) return products;
    return products.filter(p => p.name.toLowerCase().includes(recipeSearch.toLowerCase()));
  }, [products, recipeSearch]);

  const handleDeleteIngredient = async (ingredient: RestaurantIngredient) => {
    if (!window.confirm(`¿Eliminar "${ingredient.name}"?`)) return;
    try {
      await deleteIngredient.mutateAsync(ingredient.id);
      toast({ title: 'Ingrediente eliminado' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const getRecipesForProduct = (productId: string): ProductRecipe[] =>
    allRecipes.filter(r => r.product_id === productId);

  const recipeProductRecipes = recipeProduct ? getRecipesForProduct(recipeProduct.id) : [];

  const handleSaveStock = async (productId: string) => {
    const val = parseFloat(stockEditValue);
    if (isNaN(val) || val < 0) {
      toast({ variant: 'destructive', title: 'Cantidad inválida' });
      return;
    }
    try {
      await updateProductStock.mutateAsync({ id: productId, stock: val });
      toast({ title: 'Stock actualizado' });
      setStockEditId(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-orange-500/10 via-red-500/10 to-amber-500/10 border border-orange-200/30 p-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-orange-500/20 rounded-xl">
            <ChefHat className="h-5 w-5 text-orange-600" />
          </div>
          <h2 className="text-lg font-bold">Control de Inventario — Restaurante</h2>
        </div>
        <p className="text-sm text-muted-foreground pl-12">
          Administra tus ingredientes y define las recetas de cada platillo. Al vender, los ingredientes se descuentan automáticamente.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <FlaskConical className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ingredientes</p>
              <p className="text-xl font-bold text-emerald-600">{ingredients.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`border-0 shadow-sm cursor-pointer transition-all duration-300 ${
            showLowStockOnly 
              ? 'ring-2 ring-destructive bg-destructive/20 shadow-lg shadow-destructive/10' 
              : 'bg-gradient-to-r from-destructive/10 to-orange-500/10 hover:scale-[1.02]'
          }`}
          onClick={() => {
            setTab('ingredients');
            setShowLowStockOnly(!showLowStockOnly);
          }}
        >
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/20 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Stock Bajo {showLowStockOnly && <span className="text-destructive font-bold text-[9px]">(Filtrado)</span>}
                </p>
                <p className="text-xl font-bold text-destructive">{lowStockCount}</p>
              </div>
            </div>
            {lowStockCount > 0 && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border-destructive/20 bg-destructive/10 hover:bg-destructive hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrintShoppingList();
                }}
                title="Imprimir lista de compra"
              >
                <Printer className="h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/10 to-blue-500/10">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Scale className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-lg font-bold text-primary">
                ${totalInventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2 p-1 bg-muted/40 rounded-lg w-fit">
        <Button variant={tab === 'ingredients' ? 'default' : 'ghost'} size="sm"
          onClick={() => setTab('ingredients')} className="rounded-md">
          <FlaskConical className="h-3.5 w-3.5 mr-1.5" />Ingredientes
        </Button>
        <Button variant={tab === 'recipes' ? 'default' : 'ghost'} size="sm"
          onClick={() => setTab('recipes')} className="rounded-md">
          <BookOpen className="h-3.5 w-3.5 mr-1.5" />Recetas por Producto
        </Button>
      </div>

      {/* ───── TAB: INGREDIENTS ───── */}
      {tab === 'ingredients' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar ingrediente..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {INGREDIENT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditingIngredient(null); setShowIngredientDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />Nuevo Ingrediente
            </Button>
          </div>

          {Object.keys(groupedIngredients).length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <FlaskConical className="h-14 w-14 text-muted-foreground/30 mx-auto" />
              <p className="text-muted-foreground font-medium">No hay ingredientes registrados</p>
              <Button onClick={() => setShowIngredientDialog(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />Agregar primer ingrediente
              </Button>
            </div>
          ) : (
            Object.entries(groupedIngredients).map(([category, items]) => {
              const isOpen = expandedCategory === null || expandedCategory === category;
              const catLowStock = items.filter(i => i.stock <= i.min_stock).length;
              return (
                <div key={category} className="rounded-xl border border-border/50 overflow-hidden shadow-sm">
                  <button
                    className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedCategory(isOpen && expandedCategory === category ? null : category)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{category}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{items.length}</Badge>
                      {catLowStock > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          {catLowStock} bajo stock
                        </Badge>
                      )}
                    </div>
                    {expandedCategory === category
                      ? <ChevronDown className="h-4 w-4" />
                      : <ChevronRight className="h-4 w-4" />}
                  </button>
                  {(expandedCategory === null || expandedCategory === category) && (
                    <div className="divide-y divide-border/30">
                      {items.map(ing => {
                        const isLow = ing.stock <= ing.min_stock;
                        return (
                          <div key={ing.id}
                            className={`flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors ${isLow ? 'bg-destructive/5' : ''}`}>
                            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${isLow ? 'bg-destructive' : 'bg-emerald-500'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{ing.name}</p>
                              {ing.notes && <p className="text-xs text-muted-foreground truncate">{ing.notes}</p>}
                            </div>
                            <div className="hidden sm:flex items-center gap-4 text-sm">
                              <div className="text-center min-w-[70px]">
                                <p className={`font-bold ${isLow ? 'text-destructive' : 'text-foreground'}`}>
                                  {ing.stock} <span className="text-xs font-normal text-muted-foreground">{ing.unit}</span>
                                </p>
                                <p className="text-[10px] text-muted-foreground">Mín: {ing.min_stock}</p>
                              </div>
                              <div className="text-center min-w-[70px]">
                                <p className="font-semibold text-muted-foreground text-xs">
                                  ${ing.cost_per_unit.toFixed(2)}/{ing.unit}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  Val: ${(ing.stock * ing.cost_per_unit).toFixed(2)}
                                </p>
                              </div>
                            </div>
                            <div className="sm:hidden text-right">
                              <p className={`font-bold text-sm ${isLow ? 'text-destructive' : ''}`}>
                                {ing.stock} {ing.unit}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded-full"
                                onClick={() => { setEditingIngredient(ing); setShowIngredientDialog(true); }}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                                onClick={() => handleDeleteIngredient(ing)}
                                disabled={deleteIngredient.isPending}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ───── TAB: RECIPES ───── */}
      {tab === 'recipes' && (
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary inline-block" />
              Tiene receta
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
              Usa stock directo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-400 inline-block" />
              Sin configurar
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar platillo del menú..." value={recipeSearch}
              onChange={e => setRecipeSearch(e.target.value)} className="pl-9" />
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No hay productos registrados en el menú</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {filteredProducts.map(product => {
                const recipes = getRecipesForProduct(product.id);
                const isDirectStock = directStockIds.has(product.id);
                const hasRecipe = recipes.length > 0;
                const availableUnits = hasRecipe ? computeAvailableFromRecipe(recipes) : null;
                const isEditingStock = stockEditId === product.id;

                // Determine visual state
                let statusDot = 'bg-orange-400';

                if (hasRecipe) statusDot = 'bg-primary';
                else if (isDirectStock) statusDot = 'bg-emerald-500';

                // Limiting ingredient (for recipe products)
                const limitingIngredient = hasRecipe
                  ? recipes.reduce((min, r) => {
                      const can = Math.floor((r.ingredient?.stock ?? 0) / r.quantity);
                      const minCan = Math.floor((min.ingredient?.stock ?? 0) / min.quantity);
                      return can < minCan ? r : min;
                    }, recipes[0])
                  : null;

                return (
                  <div
                    key={product.id}
                    className="border border-border/50 rounded-xl overflow-hidden hover:shadow-sm transition-all"
                  >
                    {/* Main row — clickable to open recipe dialog */}
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer group"
                      onClick={() => {
                        if (!isEditingStock) setRecipeProduct({ id: product.id, name: product.name });
                      }}
                    >
                      {/* Status dot */}
                      <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${statusDot}`} />

                      {/* Product image */}
                      <div className="h-10 w-10 bg-muted/40 rounded-lg overflow-hidden flex-shrink-0">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>

                      {/* Name + description */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        {hasRecipe ? (
                          <p className="text-xs text-muted-foreground">
                            {recipes.slice(0, 2).map(r => r.ingredient?.name).join(', ')}
                            {recipes.length > 2 ? ` +${recipes.length - 2} más` : ''}
                          </p>
                        ) : isDirectStock ? (
                          <p className="text-xs text-emerald-600">Stock directo</p>
                        ) : (
                          <p className="text-xs text-orange-500">Sin configurar — haz clic para configurar</p>
                        )}
                      </div>

                      {/* Availability pill */}
                      {hasRecipe && availableUnits !== null && (
                        <div className={`flex-shrink-0 flex flex-col items-center px-3 py-1 rounded-lg border ${
                          availableUnits === 0
                            ? 'border-destructive/40 bg-destructive/10 text-destructive'
                            : availableUnits <= 3
                            ? 'border-orange-400/40 bg-orange-400/10 text-orange-500'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                        }`}>
                          <span className="text-lg font-bold leading-tight">{availableUnits}</span>
                          <span className="text-[10px] font-medium uppercase tracking-wide">disponibles</span>
                        </div>
                      )}

                      {/* Direct stock: show current stock */}
                      {isDirectStock && !hasRecipe && (
                        <div className="flex-shrink-0 flex flex-col items-center px-3 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-600">
                          <span className="text-lg font-bold leading-tight">{product.stock ?? 0}</span>
                          <span className="text-[10px] font-medium uppercase tracking-wide">en stock</span>
                        </div>
                      )}

                      {/* Not configured */}
                      {!hasRecipe && !isDirectStock && (
                        <Badge variant="outline" className="flex-shrink-0 text-orange-500 border-orange-300 text-xs">
                          Sin configurar
                        </Badge>
                      )}

                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </div>

                    {/* ── Limiting ingredient info for recipe products ── */}
                    {hasRecipe && limitingIngredient && (
                      <div className="px-4 pb-2.5 flex items-center gap-2 text-xs text-muted-foreground border-t border-border/30 pt-2">
                        <AlertTriangle className={`h-3 w-3 flex-shrink-0 ${
                          availableUnits === 0 ? 'text-destructive' : 'text-orange-400'
                        }`} />
                        <span>
                          Ingrediente limitante:{' '}
                          <strong>{limitingIngredient.ingredient?.name}</strong>
                          {' '}— {limitingIngredient.ingredient?.stock ?? 0} {limitingIngredient.ingredient?.unit} disponibles
                          {' '}(necesita {limitingIngredient.quantity} por unidad)
                        </span>
                      </div>
                    )}

                    {/* ── Inline stock editor for products without recipe ── */}
                    {!hasRecipe && !isDirectStock && (
                      <div
                        className="px-4 pb-3 border-t border-border/30 pt-2.5"
                        onClick={e => e.stopPropagation()}
                      >
                        <p className="text-xs text-muted-foreground mb-2">
                          Este producto no tiene receta. Ingresa el stock disponible:
                        </p>
                        {isEditingStock ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number" min={0} step={1} autoFocus
                              value={stockEditValue}
                              onChange={e => setStockEditValue(e.target.value)}
                              className="h-8 w-28 text-sm"
                            />
                            <Button size="sm" className="h-8"
                              onClick={() => handleSaveStock(product.id)}
                              disabled={updateProductStock.isPending}>
                              {updateProductStock.isPending
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Save className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8"
                              onClick={() => setStockEditId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline" size="sm" className="h-8 gap-2 text-xs"
                            onClick={() => {
                              setStockEditId(product.id);
                              setStockEditValue(String(product.stock ?? 0));
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {product.stock > 0 ? `Stock: ${product.stock} — Editar` : 'Agregar stock'}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      {showIngredientDialog && (
        <IngredientDialog
          open={showIngredientDialog}
          initial={editingIngredient}
          onClose={() => { setShowIngredientDialog(false); setEditingIngredient(null); }}
        />
      )}

      {recipeProduct && (
        <RecipeDialog
          open={!!recipeProduct}
          productId={recipeProduct.id}
          productName={recipeProduct.name}
          recipes={recipeProductRecipes}
          ingredients={ingredients}
          isDirectStock={directStockIds.has(recipeProduct.id)}
          onToggleDirectStock={() => toggleDirectStock(recipeProduct.id)}
          onClose={() => setRecipeProduct(null)}
        />
      )}
    </div>
  );
};

export default RestaurantInventoryControl;
