import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Package, Hash, X, ChevronRight, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface QuantityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  itemName: string;
  currentQuantity: number;
}

const QuantityDialog: React.FC<QuantityDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  currentQuantity
}) => {
  const [quantity, setQuantity] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuantity(currentQuantity.toString());
      const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
      if (!isTouch) {
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus({ preventScroll: true });
            inputRef.current.select();
          }
        }, 150);
      }
    }
  }, [isOpen, currentQuantity]);

  const handleConfirm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = parseFloat(quantity);
    if (!isNaN(q) && q >= 0) {
      onConfirm(q);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideCloseButton className="w-[calc(100%-1rem)] max-w-[380px] mobile-landscape:max-w-[560px] mobile-landscape:top-1 bg-card border border-border p-0 overflow-y-auto max-h-[calc(var(--visual-viewport-height,100dvh)-1.5rem)] sm:max-h-[calc(var(--visual-viewport-height,100dvh)-2rem)] mobile-landscape:max-h-[calc(var(--visual-viewport-height,100dvh)-0.5rem)] lg:[@media(min-height:820px)_and_(pointer:fine)]:max-h-[85vh] rounded-2xl shadow-2xl overscroll-contain">
        <div className="relative">
          {/* Header Area */}
          <div className="p-4 sm:p-5 pb-3 mobile-landscape:p-2.5 mobile-landscape:pb-1.5 border-b border-border/60">
            <DialogHeader className="text-left space-y-1 mobile-landscape:space-y-0">
              <div className="flex items-center justify-between mb-1 mobile-landscape:mb-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="bg-muted/80 text-foreground p-2 mobile-landscape:p-1 rounded-xl shrink-0">
                    <Package className="h-4 w-4 mobile-landscape:h-3.5 mobile-landscape:w-3.5 text-primary" />
                  </div>
                  <DialogTitle className="text-base sm:text-lg mobile-landscape:text-xs font-bold text-foreground tracking-tight shrink-0">
                    Ajustar Cantidad
                  </DialogTitle>
                  <span className="hidden mobile-landscape:inline-block text-xs font-semibold text-muted-foreground truncate max-w-[280px]">
                    — {itemName}
                  </span>
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onClose}
                    className="h-8 w-8 mobile-landscape:h-6 mobile-landscape:w-6 rounded-full bg-black/40 hover:bg-black/60 dark:bg-black/50 dark:hover:bg-black/70 text-white backdrop-blur-md border border-white/10 shadow-sm flex items-center justify-center transition-all duration-150 active:scale-95 shrink-0"
                    title="Cerrar"
                >
                  <X className="h-4 w-4 mobile-landscape:h-3.5 mobile-landscape:w-3.5 shrink-0" strokeWidth={2.5} />
                </Button>
              </div>
              <div className="mt-2 p-2.5 bg-muted/40 rounded-xl border border-border/60 text-left mobile-landscape:hidden">
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">Producto</p>
                <p className="font-semibold text-xs text-foreground line-clamp-1">{itemName}</p>
              </div>
            </DialogHeader>
          </div>
          
          <form onSubmit={handleConfirm} className="p-4 sm:p-5 space-y-4 mobile-landscape:p-2.5 mobile-landscape:space-y-0 mobile-landscape:grid mobile-landscape:grid-cols-2 mobile-landscape:gap-3">
            <div className="flex flex-col justify-between space-y-2 mobile-landscape:space-y-1.5">
              <div className="bg-muted/30 border border-border/70 rounded-2xl mobile-landscape:rounded-xl p-3 sm:p-4 mobile-landscape:p-1.5 text-center shadow-inner flex flex-col justify-center">
                <Label htmlFor="quantity-input" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-1.5 mobile-landscape:hidden">
                  Ingresar Cantidad
                </Label>
                <div className="flex items-center justify-between gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const val = parseFloat(quantity) || 0;
                      setQuantity(Math.max(0, val - 1).toString());
                    }}
                    className="h-8 w-8 sm:h-9 sm:w-9 mobile-landscape:h-7 mobile-landscape:w-7 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    id="quantity-input"
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setQuantity(val);
                      }
                    }}
                    onFocus={(e) => {
                      e.target.select();
                    }}
                    className="text-3xl sm:text-4xl mobile-landscape:text-xl font-black h-12 sm:h-14 mobile-landscape:h-7 text-center bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder:text-muted-foreground/30 p-0"
                    placeholder="0.000"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const val = parseFloat(quantity) || 0;
                      setQuantity((val + 1).toString());
                    }}
                    className="h-8 w-8 sm:h-9 sm:w-9 mobile-landscape:h-7 mobile-landscape:w-7 rounded-lg text-primary hover:text-primary font-bold shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Action buttons embedded in left column on mobile landscape */}
              <div className="hidden mobile-landscape:flex gap-1.5 pt-0.5">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={onClose} 
                  className="flex-1 h-7 rounded-lg font-bold text-muted-foreground hover:text-foreground hover:bg-muted text-xs"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 h-7 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs shadow-sm transition-all gap-1"
                >
                  <span>Confirmar</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col justify-between space-y-2 mobile-landscape:space-y-1">
              <div className="grid grid-cols-3 gap-1.5 mobile-landscape:gap-1">
                {[1, 2, 3, 5, 10, 20].map((quickVal) => (
                  <Button 
                    key={quickVal}
                    type="button"
                    variant="outline"
                    onClick={() => {
                        setQuantity(quickVal.toString());
                        inputRef.current?.focus({ preventScroll: true });
                    }}
                    className="h-10 mobile-landscape:h-7 bg-background border-border hover:bg-muted font-bold text-xs rounded-xl mobile-landscape:rounded-lg transition-all"
                  >
                    {quickVal}
                  </Button>
                ))}
              </div>
              <Button 
                type="button"
                variant="ghost"
                onClick={() => setQuantity('0')}
                className="w-full h-8 mobile-landscape:h-5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-bold text-[10px] uppercase tracking-wider rounded-lg"
              >
                Limpiar Valor
              </Button>
            </div>

            <DialogFooter className="flex flex-row gap-2 pt-2 !mt-4 sm:justify-end mobile-landscape:hidden">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={onClose} 
                className="flex-1 h-10 rounded-xl font-bold text-muted-foreground hover:text-foreground hover:bg-muted text-xs"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs shadow-sm transition-all gap-1.5"
              >
                <span>Confirmar</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuantityDialog;
