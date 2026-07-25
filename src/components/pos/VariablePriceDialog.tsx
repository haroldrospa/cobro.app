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
    onConfirm: (price: number, name?: string) => void;
    product: Product | null;
}

const VariablePriceDialog: React.FC<VariablePriceDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    product
}) => {
    const [price, setPrice] = useState<string>('');
    const [customName, setCustomName] = useState<string>('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPrice('');
            setCustomName(product?.name || '');
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 150);
        }
    }, [isOpen, product]);

    const handleConfirm = () => {
        const numericPrice = parseFloat(price);
        if (!isNaN(numericPrice) && numericPrice >= 0) {
            onConfirm(numericPrice, customName);
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
            <DialogContent className="w-[calc(100%-1rem)] max-w-md bg-zinc-950/95 backdrop-blur-2xl border-white/10 p-0 overflow-y-auto max-h-[90dvh] rounded-2xl">
                <div className="relative flex flex-col">
                    {/* Header Area */}
                    <div className="bg-gradient-to-b from-green-500/10 to-transparent p-4 sm:p-5 pb-1 shrink-0">
                        <DialogHeader>
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="bg-green-500/20 p-1.5 rounded-lg">
                                    <Tag className="h-4 w-4 text-green-500" />
                                </div>
                            </div>
                            <DialogTitle className="text-base sm:text-lg font-bold text-white tracking-tight uppercase text-left">
                                Precio Variado
                            </DialogTitle>
                            <DialogDescription className="text-zinc-400 text-xs mt-0.5 text-left">
                                Ingresa el precio de venta para este producto
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-4 sm:p-5 pt-1 space-y-4 flex-1 overflow-y-auto">
                        <div className="space-y-1.5 text-left">
                            <Label htmlFor="custom-name" className="text-[10px] uppercase tracking-wider font-bold text-green-500/70">
                                Nombre del Producto
                            </Label>
                            <Input
                                id="custom-name"
                                type="text"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                className="bg-white/5 border-white/5 text-xs text-white focus-visible:ring-green-500/50 rounded-xl h-10"
                                placeholder="Nombre del producto"
                                autoComplete="off"
                            />
                        </div>

                        <div className="relative group">
                            <div className="absolute inset-0 bg-green-500/5 blur-xl group-focus-within:bg-green-500/10 transition-all rounded-full" />
                            <div className="relative bg-zinc-900/50 border border-white/5 rounded-xl p-3 sm:p-4 text-center">
                                <Label htmlFor="variable-price" className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground/60 block mb-1">
                                    Monto a Cobrar
                                </Label>
                                <div className="flex items-center justify-center gap-1.5 w-full">
                                    <span className="text-xl sm:text-2xl font-bold text-green-500/60 shrink-0">$</span>
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
                                        onFocus={(e) => {
                                            setTimeout(() => {
                                                e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
                                            }, 100);
                                        }}
                                        onKeyDown={handleKeyDown}
                                        className="text-2xl sm:text-3xl font-black h-12 w-full max-w-[240px] text-center bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-white placeholder:text-zinc-800 tracking-tight"
                                        placeholder="0.00"
                                        autoComplete="off"
                                    />
                                </div>
                                <div className="h-0.5 w-10 bg-green-500/30 mx-auto rounded-full mt-1" />
                            </div>
                        </div>

                        <DialogFooter className="flex flex-row gap-2.5 !mt-4 pb-2 sm:pb-0">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={onClose} 
                                className="flex-1 h-11 rounded-xl font-bold text-zinc-400 hover:text-zinc-100 hover:bg-white/5 text-xs sm:text-sm"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={handleConfirm}
                                disabled={!price || parseFloat(price) < 0}
                                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold shadow-md active:scale-95 transition-all text-xs sm:text-sm"
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
