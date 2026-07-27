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
  const [customQuantity, setCustomQuantity] = useState(1);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const handleUpdateQty = (extraId: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[extraId] || 1;
      const nextVal = Math.max(1, current + delta);
      return { ...prev, [extraId]: nextVal };
    });
  };

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

  const handleSetQty = (extraId: string, val: number) => {
    setQuantities(prev => ({ ...prev, [extraId]: Math.max(1, val) }));
  };

  const handleSelectPredefinedWithPrice = (
    extra: { id: string; name: string; price: number; ingredient_id?: string },
    customOverridePrice: number
  ) => {
    const qty = quantities[extra.id] || 1;
    const finalUnitPrice = customOverridePrice;
    const totalPrice = finalUnitPrice * qty;

    onAddExtra({
      id: `${extra.id}-${finalUnitPrice}-${Date.now()}`,
      name: extra.name,
      price: finalUnitPrice,
      quantity: qty,
      ingredient_id: extra.ingredient_id
    });

    toast({
      title: 'Adicional agregado',
      description: `Se agregó ${qty > 1 ? `${qty}x ` : ''}"${extra.name}" (+$${totalPrice.toFixed(2)}) a ${itemName}`
    });
    onClose();
  };

  const handleAddCustom = () => {
    if (!customName.trim()) {
      toast({ title: 'Campo requerido', description: 'Por favor ingresa un nombre para el ingrediente extra.', variant: 'destructive' });
      return;
    }
    const priceNum = Number(customPrice) || 0;
    const qty = Math.max(1, customQuantity);
    const subtotalText = (priceNum * qty).toFixed(2);
    onAddExtra({
      id: `custom-${Date.now()}`,
      name: customName.trim().startsWith('Extra ') ? customName.trim() : `Extra ${customName.trim()}`,
      price: priceNum,
      quantity: qty
    });
    toast({ title: 'Adicional personalizado', description: `Se agregó ${qty > 1 ? `${qty}x ` : ''}"${customName}" (+$${subtotalText}) a ${itemName}` });
    setCustomName('');
    setCustomPrice('');
    setCustomQuantity(1);
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
          {/* Quick Preset Price Chips */}
          <div className="space-y-1.5 p-2 bg-muted/20 border border-border/40 rounded-xl">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Precios Rápidos Predeterminados:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[25, 50, 100, 150, 200, 250].map((preset) => (
                <Badge
                  key={preset}
                  variant="outline"
                  onClick={() => {
                    setCustomPrice(String(preset));
                    if (!customName) {
                      setCustomName(`Adicional $${preset}`);
                    }
                    setIsCustomMode(true);
                  }}
                  className={`cursor-pointer px-2.5 py-1 text-xs font-black transition-all ${
                    Number(customPrice) === preset && isCustomMode
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md scale-105'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                >
                  +${preset}
                </Badge>
              ))}
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex gap-2 p-1 bg-muted/40 rounded-lg">
            <Button
              type="button"
              size="sm"
              variant={!isCustomMode ? 'default' : 'ghost'}
              className={`flex-1 h-7 text-xs ${!isCustomMode ? 'bg-emerald-600 font-bold text-white' : ''}`}
              onClick={() => setIsCustomMode(false)}
            >
              Lista de Adicionales ({availableExtras.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isCustomMode ? 'default' : 'ghost'}
              className={`flex-1 h-7 text-xs ${isCustomMode ? 'bg-emerald-600 font-bold text-white' : ''}`}
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
                <div className="max-h-[300px] overflow-y-auto space-y-2.5 pr-1">
                  {filteredExtras.map(extra => {
                    const q = quantities[extra.id] || 1;
                    const totalPrice = extra.price * q;
                    return (
                      <div
                        key={extra.id}
                        className="p-2.5 bg-muted/20 hover:bg-emerald-500/10 border border-border/50 hover:border-emerald-500/40 rounded-xl flex flex-col gap-2 transition-all group"
                      >
                        {/* Top row: Name, unit price, [- qty +] and Add base price button */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" onClick={() => handleSelectPredefinedWithPrice(extra, extra.price)}>
                            <PlusCircle className="h-4 w-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                            <div className="flex flex-col min-w-0">
                              <span className="font-black text-foreground truncate text-xs group-hover:text-emerald-400 transition-colors" title={extra.name}>
                                {extra.name}
                              </span>
                              <span className="text-[10px] text-emerald-400/80 font-semibold">
                                Base: ${extra.price.toFixed(2)} c/u
                              </span>
                            </div>
                          </div>

                          {/* Quantity Controls + Add Base Button */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center bg-zinc-900 rounded-lg border border-white/10 p-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-zinc-400 hover:text-white"
                                onClick={() => handleUpdateQty(extra.id, -1)}
                              >
                                <PlusCircle className="h-3 w-3 rotate-45 text-muted-foreground" />
                              </Button>
                              <input
                                type="number"
                                min="1"
                                value={q}
                                onChange={(e) => handleSetQty(extra.id, parseInt(e.target.value) || 1)}
                                className="w-7 text-center font-black text-emerald-400 text-xs bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-emerald-400 hover:text-emerald-300"
                                onClick={() => handleUpdateQty(extra.id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>

                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleSelectPredefinedWithPrice(extra, extra.price)}
                              className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs gap-1 shadow-sm shrink-0"
                            >
                              <span>+ Agregar (${totalPrice.toFixed(2)})</span>
                            </Button>
                          </div>
                        </div>

                        {/* Bottom row: Per-ingredient preset prices ($50, $100, $150, $200, $250) */}
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/30">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">
                            Precios rápidos:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {[50, 100, 150, 200, 250].map((presetPrice) => (
                              <Badge
                                key={presetPrice}
                                variant="outline"
                                onClick={() => handleSelectPredefinedWithPrice(extra, presetPrice)}
                                className="cursor-pointer px-2 py-0.5 text-[10px] font-black bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 transition-all shadow-xs"
                              >
                                +${presetPrice}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-foreground">Precio Unitario ($)</label>
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

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Cantidad / Porción</label>
                  <Input
                    type="number"
                    min="1"
                    value={customQuantity}
                    onChange={e => setCustomQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="font-bold text-foreground"
                  />
                </div>
              </div>

              {/* Quick price chips in custom mode */}
              <div className="flex flex-wrap gap-1">
                {[25, 50, 100, 150, 200, 250].map((preset) => (
                  <Badge
                    key={`custom-${preset}`}
                    variant="outline"
                    onClick={() => setCustomPrice(String(preset))}
                    className={`cursor-pointer px-2 py-0.5 text-[11px] font-bold ${
                      Number(customPrice) === preset
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-muted/40 border-border/60 text-muted-foreground hover:text-emerald-400'
                    }`}
                  >
                    ${preset}
                  </Badge>
                ))}
              </div>

              <Button type="button" onClick={handleAddCustom} className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold gap-2 mt-2">
                <Check className="h-4 w-4" />
                Agregar Adicional (+${((Number(customPrice) || 0) * customQuantity).toFixed(2)})
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
