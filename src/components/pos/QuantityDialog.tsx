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
      <DialogContent hideCloseButton className="sm:max-w-[400px] bg-zinc-950/95 backdrop-blur-2xl border-white/10 p-0 overflow-hidden rounded-[2rem]">
        <div className="relative">
          {/* Header Area with Subtle Gradient */}
          <div className="bg-gradient-to-b from-green-500/10 to-transparent p-6 pb-2">
            <DialogHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="bg-green-500/20 p-2 rounded-xl">
                  <Package className="h-5 w-5 text-green-500" />
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onClose}
                    className="h-8 w-8 rounded-full bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-400"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <DialogTitle className="text-2xl font-black text-white tracking-tight">
                Ajustar Cantidad
              </DialogTitle>
              <div className="mt-2 p-3 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] uppercase tracking-widest font-black text-green-500/70 mb-1">Producto</p>
                <p className="font-bold text-zinc-200 line-clamp-1">{itemName}</p>
              </div>
            </DialogHeader>
          </div>
          
          <form onSubmit={handleConfirm} className="p-6 pt-2 space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-green-500/5 blur-2xl group-focus-within:bg-green-500/10 transition-all rounded-full" />
                <div className="relative bg-zinc-900/50 border border-white/5 rounded-[2rem] p-6 text-center shadow-inner">
                  <Label htmlFor="quantity-input" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 block mb-2">
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
                    className="text-5xl md:text-5xl font-black h-20 text-center bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-white placeholder:text-zinc-800"
                    placeholder="0.000"
                    autoComplete="off"
                  />
                  <div className="h-0.5 w-12 bg-green-500/40 mx-auto rounded-full mt-2" />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 5, 10, 20].map((quickVal) => (
                  <Button 
                    key={quickVal}
                    type="button"
                    variant="outline"
                    onClick={() => {
                        setQuantity(quickVal.toString());
                        inputRef.current?.focus();
                    }}
                    className="h-12 bg-zinc-900/30 border-white/5 hover:bg-green-500/10 hover:border-green-500/20 hover:text-green-500 font-black rounded-xl transition-all active:scale-95"
                  >
                    {quickVal}
                  </Button>
                ))}
              </div>
              <Button 
                type="button"
                variant="ghost"
                onClick={() => setQuantity('0')}
                className="w-full h-10 text-destructive/70 hover:text-destructive hover:bg-destructive/5 font-black text-[10px] uppercase tracking-widest rounded-xl"
              >
                Limpiar Valor
              </Button>
            </div>

            <DialogFooter className="flex flex-row gap-3 !mt-8">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={onClose} 
                className="flex-1 h-14 rounded-2xl font-black text-zinc-500 hover:text-zinc-100 hover:bg-white/5"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 text-white font-black shadow-lg shadow-green-500/20 active:scale-95 transition-all text-lg"
              >
                Confirmar <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuantityDialog;
