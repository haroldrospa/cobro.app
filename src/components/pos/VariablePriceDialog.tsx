import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DollarSign, Tag, X, ChevronRight } from 'lucide-react';
import { Product } from '@/hooks/useProducts';
import { cn } from '@/lib/utils';

interface VariablePriceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (price: number) => void;
    product: Product | null;
}

const VariablePriceDialog: React.FC<VariablePriceDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    product
}) => {
    const [price, setPrice] = useState<string>('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPrice('');
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [isOpen, product]);

    const handleConfirm = () => {
        const numericPrice = parseFloat(price);
        if (!isNaN(numericPrice) && numericPrice >= 0) {
            onConfirm(numericPrice);
            onClose();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    };

    if (!product) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md bg-zinc-950/95 backdrop-blur-2xl border-white/10 p-0 overflow-hidden rounded-2xl">
                <div className="relative">
                    {/* Header Area */}
                    <div className="bg-gradient-to-b from-green-500/10 to-transparent p-5 pb-1">
                        <DialogHeader>
                            <div className="flex items-center justify-between mb-2">
                                <div className="bg-green-500/20 p-1.5 rounded-lg">
                                    <Tag className="h-4 w-4 text-green-500" />
                                </div>
                            </div>
                            <DialogTitle className="text-lg font-bold text-white tracking-tight uppercase">
                                Precio Variado
                            </DialogTitle>
                            <DialogDescription className="text-zinc-400 text-xs mt-0.5">
                                Ingresa el precio de venta para este producto
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-5 pt-1 space-y-4">
                        <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-green-500/70">Producto</span>
                            <span className="font-bold text-xs text-zinc-200 truncate max-w-[200px]" title={product.name}>
                                {product.name}
                            </span>
                        </div>

                        <div className="relative group">
                            <div className="absolute inset-0 bg-green-500/5 blur-xl group-focus-within:bg-green-500/10 transition-all rounded-full" />
                            <div className="relative bg-zinc-900/50 border border-white/5 rounded-xl p-4 text-center">
                                <Label htmlFor="variable-price" className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground/60 block mb-1">
                                    Monto a Cobrar
                                </Label>
                                <div className="flex items-center justify-center gap-1.5">
                                    <span className="text-2xl font-bold text-green-500/60">$</span>
                                    <Input
                                        ref={inputRef}
                                        id="variable-price"
                                        type="text"
                                        inputMode="decimal"
                                        pattern="[0-9]*\.?[0-9]*"
                                        value={price}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                setPrice(val);
                                            }
                                        }}
                                        onKeyDown={handleKeyDown}
                                        className="text-3xl font-bold h-12 w-full max-w-[160px] text-center bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-white placeholder:text-zinc-800"
                                        placeholder="0.00"
                                        autoComplete="off"
                                    />
                                </div>
                                <div className="h-0.5 w-10 bg-green-500/30 mx-auto rounded-full mt-1" />
                            </div>
                        </div>

                        <DialogFooter className="flex flex-row gap-2.5 !mt-6">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={onClose} 
                                className="flex-1 h-11 rounded-xl font-bold text-zinc-500 hover:text-zinc-100 hover:bg-white/5 text-sm"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={handleConfirm}
                                disabled={!price || parseFloat(price) < 0}
                                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold shadow-md active:scale-95 transition-all text-sm"
                            >
                                Confirmar <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                        </DialogFooter>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default VariablePriceDialog;
