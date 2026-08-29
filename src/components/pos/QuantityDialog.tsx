import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Package, Hash, X, ChevronRight } from 'lucide-react';
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
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 150);
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
      <DialogContent hideCloseButton className="w-[calc(100%-1rem)] max-w-[380px] bg-card border border-border p-0 overflow-hidden rounded-2xl shadow-2xl">
        <div className="relative">
          {/* Header Area */}
          <div className="p-4 sm:p-5 pb-3 border-b border-border/60">
            <DialogHeader className="text-left space-y-1">
              <div className="flex items-center justify-between mb-1">
                <div className="bg-muted/80 text-foreground p-2 rounded-xl">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onClose}
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                Ajustar Cantidad
              </DialogTitle>
              <div className="mt-2 p-2.5 bg-muted/40 rounded-xl border border-border/60 text-left">
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">Producto</p>
                <p className="font-semibold text-xs text-foreground line-clamp-1">{itemName}</p>
              </div>
            </DialogHeader>
          </div>
          
          <form onSubmit={handleConfirm} className="p-4 sm:p-5 space-y-4">
            <div className="space-y-3">
              <div className="bg-muted/30 border border-border/70 rounded-2xl p-4 text-center shadow-inner">
                <Label htmlFor="quantity-input" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-1.5">
                  Ingresar Cantidad
                </Label>
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
                    setTimeout(() => {
                      e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    }, 100);
                  }}
                  className="text-3xl sm:text-4xl font-black h-14 text-center bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder:text-muted-foreground/30"
                  placeholder="0.000"
                  autoComplete="off"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-1.5">
                {[1, 2, 3, 5, 10, 20].map((quickVal) => (
                  <Button 
                    key={quickVal}
                    type="button"
                    variant="outline"
                    onClick={() => {
                        setQuantity(quickVal.toString());
                        inputRef.current?.focus();
                    }}
                    className="h-10 bg-background border-border hover:bg-muted font-bold text-xs rounded-xl transition-all"
                  >
                    {quickVal}
                  </Button>
                ))}
              </div>
              <Button 
                type="button"
                variant="ghost"
                onClick={() => setQuantity('0')}
                className="w-full h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-bold text-[10px] uppercase tracking-wider rounded-lg"
              >
                Limpiar Valor
              </Button>
            </div>

            <DialogFooter className="flex flex-row gap-2 pt-2 !mt-4 sm:justify-end">
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
