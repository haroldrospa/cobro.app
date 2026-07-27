import React, { useState, useMemo } from 'react';
import { PlusCircle, Search, DollarSign, Check, X, Sparkles, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useProductsOffline } from '@/hooks/useProductsOffline';
import { useRestaurantIngredients, useAllProductRecipes } from '@/hooks/useRestaurantInventory';
import { CartItemExtra } from '@/types/pos';
import { useToast } from '@/hooks/use-toast';

interface SelectExtraDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExtra: (extra: CartItemExtra) => void;
  itemName: string;
}

export const SelectExtraDialog: React.FC<SelectExtraDialogProps> = ({
  isOpen,
  onClose,
  onAddExtra,
  itemName
}) => {
  const { toast } = useToast();
  const { data: products = [] } = useProductsOffline();
  const { data: ingredients = [] } = useRestaurantIngredients();
  const { data: recipes = [] } = useAllProductRecipes();

  const [searchTerm, setSearchTerm] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Available extras configured in product catalog or ingredients
  const availableExtras = useMemo(() => {
    // 1. Products in Adicionales category or with recipe
    const extraProds = products.filter(p => {
      const isExtraCat = p.category?.name?.toLowerCase().includes('adicional') || p.name.toLowerCase().startsWith('extra ');
      return isExtraCat || p.category === 'Adicionales';
    });

    // If no extra products exist, build from ingredients
    const list: Array<{ id: string; name: string; price: number; ingredient_id?: string }> = [];

    extraProds.forEach(p => {
      list.push({ id: p.id, name: p.name, price: p.price });
    });

    // Also include ingredients as quick extra options if not already in list
    ingredients.forEach(ing => {
      const recipe = recipes.find(r => r.ingredient_id === ing.id);
      const existing = list.find(l => l.name.toLowerCase().includes(ing.name.toLowerCase()));
      if (!existing) {
        // Estimate extra sale price (100% markup or cost * 2)
        const portion = ing.unit === 'lb' ? 0.25 : 1;
        const estCost = ing.cost_per_unit * portion;
        const estPrice = Math.round(estCost * 2) || 50;
        list.push({
          id: `ing-${ing.id}`,
          name: `Extra ${ing.name}`,
          price: estPrice,
          ingredient_id: ing.id
        });
      }
    });

    return list;
  }, [products, ingredients, recipes]);

  const filteredExtras = useMemo(() => {
    if (!searchTerm) return availableExtras;
    const term = searchTerm.toLowerCase();
    return availableExtras.filter(e => e.name.toLowerCase().includes(term));
  }, [availableExtras, searchTerm]);

  const handleSelectPredefined = (extra: { id: string; name: string; price: number; ingredient_id?: string }) => {
    onAddExtra({
      id: extra.id,
      name: extra.name,
      price: extra.price,
      quantity: 1,
      ingredient_id: extra.ingredient_id
    });
    toast({ title: 'Adicional agregado', description: `Se agregó "${extra.name}" (+$${extra.price}) a ${itemName}` });
    onClose();
  };

  const handleAddCustom = () => {
    if (!customName.trim()) {
      toast({ title: 'Campo requerido', description: 'Por favor ingresa un nombre para el ingrediente extra.', variant: 'destructive' });
      return;
    }
    const priceNum = Number(customPrice) || 0;
    onAddExtra({
      id: `custom-${Date.now()}`,
      name: customName.trim().startsWith('Extra ') ? customName.trim() : `Extra ${customName.trim()}`,
      price: priceNum,
      quantity: 1
    });
    toast({ title: 'Adicional personalizado', description: `Se agregó "${customName}" (+$${priceNum}) a ${itemName}` });
    setCustomName('');
    setCustomPrice('');
    setIsCustomMode(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border/80 text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-emerald-400">
            <PlusCircle className="h-5 w-5 text-emerald-400" />
            Adicionar Ingrediente Extra a "{itemName}"
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Selecciona un ingrediente adicional de la lista o escribe uno personalizado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {/* Mode Switcher */}
          <div className="flex gap-2 p-1 bg-muted/40 rounded-lg">
            <Button
              type="button"
              size="sm"
              variant={!isCustomMode ? 'default' : 'ghost'}
              className={`flex-1 h-7 text-xs ${!isCustomMode ? 'bg-emerald-600 font-bold' : ''}`}
              onClick={() => setIsCustomMode(false)}
            >
              Lista de Adicionales ({availableExtras.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isCustomMode ? 'default' : 'ghost'}
              className={`flex-1 h-7 text-xs ${isCustomMode ? 'bg-emerald-600 font-bold' : ''}`}
              onClick={() => setIsCustomMode(true)}
            >
              Adicional Personalizado
            </Button>
          </div>

          {!isCustomMode ? (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar extra (ej: Carne Salada, Queso, Bacon)..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              {/* Extras Quick List Grid */}
              {filteredExtras.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground space-y-2">
                  <p>No se encontraron adicionales creados.</p>
                  <Button size="sm" variant="outline" onClick={() => setIsCustomMode(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Escribir adicional manualmente
                  </Button>
                </div>
              ) : (
                <div className="max-h-[260px] overflow-y-auto space-y-1.5 pr-1">
                  {filteredExtras.map(extra => (
                    <div
                      key={extra.id}
                      onClick={() => handleSelectPredefined(extra)}
                      className="p-2.5 bg-muted/20 hover:bg-emerald-500/10 border border-border/50 hover:border-emerald-500/40 rounded-xl flex items-center justify-between cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <PlusCircle className="h-4 w-4 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
                        <span className="font-bold text-foreground group-hover:text-emerald-400 transition-colors">
                          {extra.name}
                        </span>
                      </div>
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-bold text-xs">
                        +${extra.price.toLocaleString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Custom Extra Mode */
            <div className="space-y-3 p-3 bg-muted/20 border border-border/50 rounded-xl">
              <div className="space-y-1">
                <label className="font-bold text-foreground">Nombre del Ingrediente Extra</label>
                <Input
                  placeholder="Ej. Extra Aguacate, Extra Tocineta, Extra Salsa..."
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">Precio Adicional ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                  <Input
                    type="number"
                    min="0"
                    placeholder="50"
                    value={customPrice}
                    onChange={e => setCustomPrice(e.target.value)}
                    className="pl-9 font-bold text-emerald-400"
                  />
                </div>
              </div>

              <Button type="button" onClick={handleAddCustom} className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold gap-2">
                <Check className="h-4 w-4" />
                Agregar Adicional a "{itemName}"
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SelectExtraDialog;
