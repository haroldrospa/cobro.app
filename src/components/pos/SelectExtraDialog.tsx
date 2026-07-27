import React, { useState, useMemo } from 'react';
import { PlusCircle, Search, DollarSign, Check, X, Sparkles, Plus, Minus, Utensils } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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

  const handleSetQty = (extraId: string, val: number) => {
    setQuantities(prev => ({ ...prev, [extraId]: Math.max(1, val) }));
  };

  // Available extras configured in product catalog or ingredients
  const availableExtras = useMemo(() => {
    const extraProds = products.filter(p => {
      const isExtraCat = p.category?.name?.toLowerCase().includes('adicional') || p.name.toLowerCase().startsWith('extra ');
      return isExtraCat || p.category === 'Adicionales';
    });

    const list: Array<{ id: string; name: string; price: number; ingredient_id?: string }> = [];

    extraProds.forEach(p => {
      list.push({ id: p.id, name: p.name, price: p.price });
    });

    ingredients.forEach(ing => {
      const existing = list.find(l => l.name.toLowerCase().includes(ing.name.toLowerCase()));
      if (!existing) {
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
      <DialogContent className="max-w-xl bg-card border-emerald-500/20 text-foreground shadow-2xl rounded-2xl p-5">
        {/* Header */}
        <DialogHeader className="pb-2 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-emerald-400">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <PlusCircle className="h-5 w-5 text-emerald-400" />
            </div>
            <span>Adicionar Ingrediente Extra a "{itemName}"</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Selecciona un ingrediente de la lista con sus precios rápidos o ingresa uno personalizado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-3 text-xs">
          {/* Mode Switcher */}
          <div className="flex bg-muted/40 p-1 rounded-xl border border-border/40">
            <Button
              type="button"
              size="sm"
              variant={!isCustomMode ? 'default' : 'ghost'}
              className={`flex-1 h-8 text-xs font-bold rounded-lg transition-all ${
                !isCustomMode ? 'bg-emerald-600 text-white shadow-md' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setIsCustomMode(false)}
            >
              📋 Lista de Adicionales ({availableExtras.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isCustomMode ? 'default' : 'ghost'}
              className={`flex-1 h-8 text-xs font-bold rounded-lg transition-all ${
                isCustomMode ? 'bg-emerald-600 text-white shadow-md' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setIsCustomMode(true)}
            >
              ✏️ Adicional Personalizado
            </Button>
          </div>

          {!isCustomMode ? (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar ingrediente (ej: Bacon, Queso, Carne Salada)..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl bg-muted/20 border-border/60"
                />
              </div>

              {/* Extras List */}
              {filteredExtras.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground space-y-3">
                  <p>No se encontraron adicionales en tu lista.</p>
                  <Button size="sm" variant="outline" onClick={() => setIsCustomMode(true)} className="rounded-xl border-emerald-500/30 text-emerald-400">
                    <Plus className="h-4 w-4 mr-1" /> Escribir ingrediente manualmente
                  </Button>
                </div>
              ) : (
                <div className="max-h-[320px] overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-emerald-500/20">
                  {filteredExtras.map(extra => {
                    const q = quantities[extra.id] || 1;
                    const totalPrice = extra.price * q;
                    return (
                      <div
                        key={extra.id}
                        className="p-3 bg-muted/20 hover:bg-emerald-500/5 border border-border/40 hover:border-emerald-500/30 rounded-xl flex flex-col gap-2 transition-all shadow-sm group"
                      >
                        {/* Top row: Name, Base price, Quantity Controls & Primary Add Button */}
                        <div className="flex items-center justify-between gap-3">
                          <div
                            className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                            onClick={() => handleSelectPredefinedWithPrice(extra, extra.price)}
                          >
                            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                              <Utensils className="h-4 w-4 text-emerald-400" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-black text-foreground text-xs truncate group-hover:text-emerald-400 transition-colors" title={extra.name}>
                                {extra.name}
                              </span>
                              <span className="text-[10px] text-emerald-400/90 font-bold">
                                Precio Base: ${extra.price.toFixed(2)} c/u
                              </span>
                            </div>
                          </div>

                          {/* Quantity Selector + Primary Add */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Quantity Controls [- 1 +] */}
                            <div className="flex items-center bg-zinc-900/90 rounded-lg border border-white/10 p-0.5 shadow-inner">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-zinc-400 hover:text-white rounded-md"
                                onClick={() => handleUpdateQty(extra.id, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <input
                                type="number"
                                min="1"
                                value={q}
                                onChange={(e) => handleSetQty(extra.id, parseInt(e.target.value) || 1)}
                                className="w-8 text-center font-black text-emerald-400 text-xs bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-emerald-400 hover:text-emerald-300 rounded-md"
                                onClick={() => handleUpdateQty(extra.id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>

                            {/* Add Base Button */}
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleSelectPredefinedWithPrice(extra, extra.price)}
                              className="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs gap-1 shadow-sm shrink-0 rounded-lg"
                            >
                              <span>+ Agregar (${totalPrice.toFixed(2)})</span>
                            </Button>
                          </div>
                        </div>

                        {/* Bottom Row: Precios Rápidos Predeterminados */}
                        <div className="flex items-center gap-2 pt-1.5 border-t border-border/30">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">
                            Precios Rápidos:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {[50, 100, 150, 200, 250].map((presetPrice) => (
                              <Badge
                                key={presetPrice}
                                variant="outline"
                                onClick={() => handleSelectPredefinedWithPrice(extra, presetPrice)}
                                className="cursor-pointer px-2.5 py-0.5 text-[11px] font-black bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 transition-all rounded-md shadow-xs"
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
            <div className="space-y-4 p-4 bg-muted/20 border border-border/40 rounded-2xl">
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">Nombre del Ingrediente Extra</label>
                <Input
                  placeholder="Ej. Extra Aguacate, Extra Tocineta, Extra Salsa..."
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="bg-card"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">Precio Unitario ($)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                    <Input
                      type="number"
                      min="0"
                      placeholder="50"
                      value={customPrice}
                      onChange={e => setCustomPrice(e.target.value)}
                      className="pl-9 font-bold text-emerald-400 bg-card"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">Cantidad / Porción</label>
                  <Input
                    type="number"
                    min="1"
                    value={customQuantity}
                    onChange={e => setCustomQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="font-bold text-foreground bg-card"
                  />
                </div>
              </div>

              {/* Quick price chips in custom mode */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Elegir precio predeterminado:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[25, 50, 100, 150, 200, 250].map((preset) => (
                    <Badge
                      key={`custom-${preset}`}
                      variant="outline"
                      onClick={() => setCustomPrice(String(preset))}
                      className={`cursor-pointer px-3 py-1 text-xs font-black transition-all rounded-md ${
                        Number(customPrice) === preset
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                          : 'bg-muted/40 border-border/60 text-muted-foreground hover:text-emerald-400 hover:border-emerald-500/40'
                      }`}
                    >
                      ${preset}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button type="button" onClick={handleAddCustom} className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold gap-2 text-white shadow-md rounded-xl h-10">
                <Check className="h-4 w-4" />
                Agregar Adicional (+${((Number(customPrice) || 0) * customQuantity).toFixed(2)})
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SelectExtraDialog;
