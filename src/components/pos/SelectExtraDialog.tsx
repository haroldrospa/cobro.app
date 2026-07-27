import React, { useState, useMemo } from 'react';
import { PlusCircle, Search, DollarSign, Check, X, Sparkles, Plus, Minus, Utensils, ArrowLeft } from 'lucide-react';
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

type ExtraItem = { id: string; name: string; price: number; unit?: string; ingredient_id?: string };

const isFractionalUnit = (unit?: string) => {
  if (!unit) return false;
  const u = unit.toLowerCase().trim();
  return ['lb', 'kg', 'g', 'oz', 'l', 'ml', 'libra', 'kilo', 'gramo', 'litro'].includes(u);
};

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
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [selectedExtra, setSelectedExtra] = useState<ExtraItem | null>(null);

  // Configuration state for selected extra or custom extra
  const [configuredPrice, setConfiguredPrice] = useState<number>(0);
  const [configuredQuantity, setConfiguredQuantity] = useState<number>(1);
  const [customNameInput, setCustomNameInput] = useState<string>('');

  // Available extras configured in product catalog or ingredients
  const availableExtras = useMemo(() => {
    const extraProds = products.filter(p => {
      const isExtraCat = p.category?.name?.toLowerCase().includes('adicional') || p.name.toLowerCase().startsWith('extra ');
      return isExtraCat || p.category === 'Adicionales';
    });

    const list: Array<ExtraItem> = [];

    extraProds.forEach(p => {
      const matchingRecipe = recipes.find(r => r.product_id === p.id);
      const matchedIng = ingredients.find(i => i.id === matchingRecipe?.ingredient_id || p.name.toLowerCase().includes(i.name.toLowerCase()));
      list.push({
        id: p.id,
        name: p.name,
        price: p.price,
        unit: matchedIng?.unit || (p as any).unit || 'ud',
        ingredient_id: matchedIng?.id
      });
    });

    ingredients.forEach(ing => {
      const existing = list.find(l => l.name.toLowerCase().includes(ing.name.toLowerCase()));
      if (!existing) {
        // Price per 1 FULL unit of measure (1 lb, 1 ud, 1 kg)
        const estPricePerUnit = Math.round(ing.cost_per_unit * 2) || 100;
        list.push({
          id: `ing-${ing.id}`,
          name: `Extra ${ing.name}`,
          price: estPricePerUnit,
          unit: ing.unit || 'ud',
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

  // Open configuration view for a selected predefined extra
  const handleOpenConfigForExtra = (extra: ExtraItem) => {
    setSelectedExtra(extra);
    setConfiguredPrice(extra.price);
    setConfiguredQuantity(1);
  };

  // Open configuration for custom extra
  const handleOpenCustomConfig = () => {
    setSelectedExtra({ id: `custom-${Date.now()}`, name: '', price: 50 });
    setCustomNameInput('');
    setConfiguredPrice(50);
    setConfiguredQuantity(1);
    setIsCustomMode(true);
  };

  const handleConfirmAddExtra = () => {
    const finalName = isCustomMode
      ? (customNameInput.trim().startsWith('Extra ') ? customNameInput.trim() : `Extra ${customNameInput.trim() || 'Ingrediente'}`)
      : (selectedExtra?.name || 'Extra');

    if (isCustomMode && !customNameInput.trim()) {
      toast({ title: 'Campo requerido', description: 'Por favor ingresa un nombre para el ingrediente extra.', variant: 'destructive' });
      return;
    }

    const priceNum = Math.max(0, Number(configuredPrice) || 0);
    const qtyNum = Math.max(1, configuredQuantity || 1);
    const totalPrice = priceNum * qtyNum;

    onAddExtra({
      id: `${selectedExtra?.id || 'custom'}-${priceNum}-${Date.now()}`,
      name: finalName,
      price: priceNum,
      quantity: qtyNum,
      ingredient_id: selectedExtra?.ingredient_id
    });

    toast({
      title: 'Adicional agregado',
      description: `Se agregó ${qtyNum > 1 ? `${qtyNum}x ` : ''}"${finalName}" (+$${totalPrice.toFixed(2)}) a ${itemName}`
    });

    // Reset and close
    setSelectedExtra(null);
    setIsCustomMode(false);
    onClose();
  };

  const handleBackToList = () => {
    setSelectedExtra(null);
    setIsCustomMode(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-emerald-500/20 text-foreground shadow-2xl rounded-2xl p-5">
        {/* Header */}
        <DialogHeader className="pb-2 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 text-base font-black text-emerald-400">
            {selectedExtra ? (
              <Button variant="ghost" size="icon" onClick={handleBackToList} className="h-7 w-7 rounded-lg text-emerald-400 hover:bg-emerald-500/10">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <PlusCircle className="h-4 w-4 text-emerald-400" />
              </div>
            )}
            <span className="truncate">
              {selectedExtra
                ? `Configurar "${isCustomMode ? (customNameInput || 'Adicional') : selectedExtra.name}"`
                : `Adicionar Extra a "${itemName}"`}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {selectedExtra
              ? `Ajusta la cantidad y el precio para ${itemName}`
              : 'Selecciona cualquier ingrediente adicional de tu menú'}
          </DialogDescription>
        </DialogHeader>

        {/* CONTENT AREA */}
        {selectedExtra ? (
          /* STEP 2: CONFIGURATION VIEW FOR SELECTED EXTRA */
          <div className="space-y-4 pt-3 text-xs animate-in fade-in duration-200">
            {/* Custom Name Input if in Custom Mode */}
            {isCustomMode && (
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">Nombre del Ingrediente Extra</label>
                <Input
                  placeholder="Ej. Extra Aguacate, Extra Tocineta, Extra Salsa..."
                  value={customNameInput}
                  onChange={e => setCustomNameInput(e.target.value)}
                  className="bg-card"
                  autoFocus
                />
              </div>
            )}

            {/* PRESET PRICES SELECTOR */}
            {(() => {
              const isFractional = isFractionalUnit(selectedExtra.unit);
              const basePrice = configuredPrice || selectedExtra.price || 0;

              // Generate preset options based on unit type and current base price
              let presetOptions: Array<{ targetPrice: number; qty: number; label: string }> = [];

              if (basePrice > 0 && !isCustomMode) {
                if (isFractional) {
                  // Weighted / fractional item (e.g., lb, kg)
                  const fractions = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];
                  presetOptions = fractions.map(f => ({
                    targetPrice: basePrice * f,
                    qty: f,
                    label: `$${(basePrice * f).toFixed(0)} (${f} ${selectedExtra.unit || 'lb'})`
                  }));
                } else {
                  // Unit item (e.g. ud, un, pieza) -> Integers only!
                  const multipliers = [1, 2, 3, 4, 5, 6, 8, 10];
                  presetOptions = multipliers.map(m => ({
                    targetPrice: basePrice * m,
                    qty: m,
                    label: `$${(basePrice * m).toFixed(0)} (${m}x)`
                  }));
                }
              } else {
                // Custom extra or no base price
                const standardAmounts = [25, 50, 60, 80, 100, 150, 200, 250];
                presetOptions = standardAmounts.map(amt => ({
                  targetPrice: amt,
                  qty: 1,
                  label: `$${amt}`
                }));
              }

              return (
                <div className="space-y-2.5 p-3 bg-muted/20 border border-border/40 rounded-xl">
                  {/* Base Unit Price Header */}
                  <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/30">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                      Precio Unitario (${selectedExtra.unit ? `/ ${selectedExtra.unit}` : ''}):
                    </span>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                      <Input
                        type="number"
                        min="0"
                        value={configuredPrice || ''}
                        onChange={(e) => setConfiguredPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-24 h-7 text-xs font-black text-emerald-400 bg-card rounded-md text-right px-2"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Precios / Raciones Rápidas:
                    </span>
                    <span className="text-xs font-black text-white">
                      ${(configuredPrice * configuredQuantity).toFixed(2)} total ({isFractional ? configuredQuantity : Math.round(configuredQuantity)} {selectedExtra.unit || 'x'})
                    </span>
                  </div>

                  {/* Fast Preset Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {presetOptions.map((opt) => {
                      const currentTotal = configuredPrice * configuredQuantity;
                      const isActive = Math.abs(currentTotal - opt.targetPrice) < 0.01 || Math.abs(configuredQuantity - opt.qty) < 0.001;

                      return (
                        <Badge
                          key={opt.label}
                          variant="outline"
                          onClick={() => {
                            if (basePrice > 0 && !isCustomMode) {
                              setConfiguredQuantity(opt.qty);
                            } else {
                              setConfiguredPrice(opt.targetPrice);
                              setConfiguredQuantity(1);
                            }
                          }}
                          className={`cursor-pointer px-2.5 py-1 text-xs font-black transition-all rounded-lg ${
                            isActive
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-md scale-105'
                              : 'bg-muted/40 border-border/60 text-muted-foreground hover:text-emerald-400 hover:border-emerald-500/40'
                          }`}
                        >
                          {opt.label}
                        </Badge>
                      );
                    })}
                  </div>

                  {basePrice > 0 && !isFractional && (
                    <span className="text-[9px] text-amber-400/90 font-medium block pt-1">
                      * Este ingrediente es por unidad (mínimo 1 ud = ${basePrice.toFixed(2)}). No se vende en fracciones.
                    </span>
                  )}
                </div>
              );
            })()}

            {/* QUANTITY SELECTOR */}
            {(() => {
              const isFractional = isFractionalUnit(selectedExtra.unit);
              const step = isFractional ? 0.25 : 1;

              return (
                <div className="space-y-2 p-3 bg-muted/20 border border-border/40 rounded-xl">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">
                    Cantidad / Porciones ({isFractional ? selectedExtra.unit || 'peso' : 'Unidades en entero'}):
                  </span>

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center bg-zinc-900 rounded-xl border border-white/10 p-1 shadow-inner flex-1 max-w-[170px]">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-400 hover:text-white rounded-lg"
                        onClick={() => setConfiguredQuantity(prev => {
                          const nextVal = prev - step;
                          return isFractional ? Math.max(0.1, parseFloat(nextVal.toFixed(2))) : Math.max(1, Math.round(nextVal));
                        })}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <input
                        type="number"
                        min={isFractional ? "0.1" : "1"}
                        step={isFractional ? "0.25" : "1"}
                        value={isFractional ? configuredQuantity : Math.round(configuredQuantity)}
                        onChange={(e) => {
                          const parsed = parseFloat(e.target.value) || (isFractional ? 0.25 : 1);
                          if (isFractional) {
                            setConfiguredQuantity(Math.max(0.05, parsed));
                          } else {
                            setConfiguredQuantity(Math.max(1, Math.round(parsed)));
                          }
                        }}
                        className="w-full text-center font-black text-emerald-400 text-sm bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-emerald-400 hover:text-emerald-300 rounded-lg"
                        onClick={() => setConfiguredQuantity(prev => {
                          const nextVal = prev + step;
                          return isFractional ? parseFloat(nextVal.toFixed(2)) : Math.round(nextVal + 1);
                        })}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Subtotal calculation */}
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block font-bold">Subtotal Adicional</span>
                      <span className="text-base font-black text-emerald-400">
                        +${(configuredPrice * configuredQuantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleBackToList} className="flex-1 rounded-xl h-10 border-border/60">
                ← Volver a Lista
              </Button>
              <Button
                type="button"
                onClick={handleConfirmAddExtra}
                className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl h-10 shadow-lg gap-2"
              >
                <Check className="h-4 w-4" />
                Agregar (+${(configuredPrice * configuredQuantity).toFixed(2)})
              </Button>
            </div>
          </div>
        ) : (
          /* STEP 1: CLEAN LIST OF INGREDIENTS */
          <div className="space-y-3 pt-2 text-xs">
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

            {/* Extras Clean List Grid */}
            {filteredExtras.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground space-y-3">
                <p>No se encontraron adicionales en la lista.</p>
                <Button size="sm" variant="outline" onClick={handleOpenCustomConfig} className="rounded-xl border-emerald-500/30 text-emerald-400">
                  <Plus className="h-4 w-4 mr-1" /> Escribir adicional manualmente
                </Button>
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-emerald-500/20">
                {filteredExtras.map(extra => (
                  <div
                    key={extra.id}
                    onClick={() => handleOpenConfigForExtra(extra)}
                    className="p-3 bg-muted/20 hover:bg-emerald-500/10 border border-border/40 hover:border-emerald-500/40 rounded-xl flex items-center justify-between cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Utensils className="h-4 w-4 text-emerald-400" />
                      </div>
                      <span className="font-bold text-foreground text-xs truncate group-hover:text-emerald-400 transition-colors" title={extra.name}>
                        {extra.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Plus className="h-4 w-4 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Custom Extra Button at bottom of list */}
            <div className="pt-2 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                onClick={handleOpenCustomConfig}
                className="w-full h-9 rounded-xl border-dashed border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-bold gap-2"
              >
                <Plus className="h-4 w-4" />
                Escribir Adicional Personalizado / Libre
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SelectExtraDialog;
