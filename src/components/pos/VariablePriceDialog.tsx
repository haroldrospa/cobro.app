import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ChevronRight } from 'lucide-react';

import { Product } from '@/hooks/useProducts';

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
            <DialogContent className="w-[calc(100%-1rem)] max-w-md p-0 overflow-y-auto max-h-[90dvh] rounded-2xl">
                <div className="flex flex-col">
                    <div className="p-4 sm:p-5 pb-1 shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-left">
                                Precio Variado
                            </DialogTitle>
                        </DialogHeader>
                    </div>

                    <div className="p-4 sm:p-5 pt-1 space-y-4">
                        <div className="space-y-1.5 text-left">
                            <Label htmlFor="custom-name" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                                Nombre del Producto
                            </Label>
                            <Input
                                id="custom-name"
                                type="text"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                className="bg-muted/50 border-transparent text-xs rounded-xl h-10 focus-visible:bg-background focus-visible:border-emerald-500/40 focus-visible:ring-2 focus-visible:ring-emerald-500/10"
                                placeholder="Nombre del producto"
                                autoComplete="off"
                            />
                        </div>

                        <div className="text-center">
                            <Label htmlFor="variable-price" className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-1">
                                Monto a Cobrar
                            </Label>
                            <div className="flex items-center justify-center gap-1.5 w-full">
                                <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 shrink-0">$</span>
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
                                    className="text-2xl sm:text-3xl font-black h-12 w-full max-w-[240px] text-center bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder:text-muted-foreground/40 tracking-tight"
                                    placeholder="0.00"
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        <DialogFooter className="flex flex-row gap-2.5 !mt-4 pb-2 sm:pb-0">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                className="flex-1 h-11 rounded-xl font-bold text-muted-foreground hover:text-foreground text-xs sm:text-sm"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={handleConfirm}
                                disabled={!price || parseFloat(price) < 0}
                                className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm active:scale-95 transition-all text-xs sm:text-sm"
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
