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
            <DialogContent className="sm:max-w-md bg-zinc-950/95 backdrop-blur-2xl border-white/10 p-0 overflow-hidden rounded-[2rem]">
                <div className="relative">
                    {/* Header Area */}
                    <div className="bg-gradient-to-b from-green-500/10 to-transparent p-6 pb-2">
                        <DialogHeader>
                            <div className="flex items-center justify-between mb-2">
                                <div className="bg-green-500/20 p-2 rounded-xl">
                                    <Tag className="h-5 w-5 text-green-500" />
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
                                Precio Variado
                            </DialogTitle>
                            <DialogDescription className="text-zinc-400 text-sm mt-1">
                                Ingresa el precio de venta para este producto
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-6 pt-2 space-y-6">
                        <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[10px] uppercase tracking-widest font-black text-green-500/70 mb-1">Producto</p>
                            <p className="font-bold text-zinc-200 line-clamp-1">{product.name}</p>
                        </div>

                        <div className="relative group">
                            <div className="absolute inset-0 bg-green-500/5 blur-2xl group-focus-within:bg-green-500/10 transition-all rounded-full" />
                            <div className="relative bg-zinc-900/50 border border-white/5 rounded-[2rem] p-6 text-center shadow-inner">
                                <Label htmlFor="variable-price" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/60 block mb-2">
                                    Monto a Cobrar
                                </Label>
                                <div className="flex items-center justify-center gap-2">
                                    <span className="text-3xl font-black text-green-500/50">$</span>
                                    <Input
                                        ref={inputRef}
                                        id="variable-price"
                                        type="number"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        className="text-5xl font-black h-20 w-40 text-center bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-white placeholder:text-zinc-800"
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                        autoComplete="off"
                                    />
                                </div>
                                <div className="h-0.5 w-12 bg-green-500/40 mx-auto rounded-full mt-2" />
                            </div>
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
                                type="button"
                                onClick={handleConfirm}
                                disabled={!price || parseFloat(price) < 0}
                                className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 text-white font-black shadow-lg shadow-green-500/20 active:scale-95 transition-all text-lg"
                            >
                                Confirmar <ChevronRight className="ml-2 h-5 w-5" />
                            </Button>
                        </DialogFooter>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default VariablePriceDialog;
