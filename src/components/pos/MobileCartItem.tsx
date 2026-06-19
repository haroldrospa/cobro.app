import React, { useState } from 'react';
import { Minus, Plus, Trash2, Package, MessageSquare, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CartItem } from '@/types/pos';
import QuantityDialog from './QuantityDialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MobileCartItemProps {
    item: CartItem;
    onUpdateQuantity: (id: string, q: number) => void;
    onRemoveFromCart: (id: string) => void;
    calculateItemTotal: (item: CartItem) => number;
    onUpdateComment?: (id: string, c: string) => void;
    onUpdateDiscount?: (id: string, value: number, type: 'percentage' | 'amount') => void;
}

/**
 * RENDIMIENTO: framer-motion eliminado por completo.
 * - `motion.div layout` forzaba un costosísimo recálculo de layout en TODOS
 *   los ítems del carrito cada vez que se agregaba uno nuevo.
 * - Reemplazado por `animate-in fade-in` de Tailwind (CSS puro, GPU-friendly).
 * - El componente queda envuelto en React.memo para evitar re-renders innecesarios.
 */
const MobileCartItem: React.FC<MobileCartItemProps> = ({
    item,
    onUpdateQuantity,
    onRemoveFromCart,
    calculateItemTotal,
    onUpdateComment,
    onUpdateDiscount
}) => {
    const [isEditingComment, setIsEditingComment] = useState(false);
    const [isQuantityDialogOpen, setIsQuantityDialogOpen] = useState(false);
    const [isEditingDiscount, setIsEditingDiscount] = useState(false);
    const [tempDiscountValue, setTempDiscountValue] = useState(item.discount?.value ? String(item.discount.value) : '');
    const [tempDiscountType, setTempDiscountType] = useState<'percentage' | 'amount'>(item.discount?.type || 'percentage');

    const handleApplyDiscount = () => {
        const val = parseFloat(tempDiscountValue);
        if (!isNaN(val) && val >= 0) {
            onUpdateDiscount?.(item.id, val, tempDiscountType);
            setIsEditingDiscount(false);
        } else {
            onUpdateDiscount?.(item.id, 0, 'percentage');
            setIsEditingDiscount(false);
        }
    };

    return (
        <div className="mb-2 animate-in fade-in duration-200">
            <div className="overflow-hidden border border-white/5 bg-zinc-900/40 rounded-xl">
                <div className="flex flex-col">
                    {/* Main Row */}
                    <div className="flex items-center justify-between gap-2 p-2 text-zinc-100">
                        {/* Left: Image & Name */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-12 h-12 bg-zinc-800 flex-shrink-0 flex items-center justify-center relative overflow-hidden rounded-lg">
                                {item.image_url ? (
                                    <img
                                        src={item.image_url}
                                        alt={item.name}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Package className="h-5 w-5 text-white/10" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-[11px] uppercase tracking-tight leading-tight break-words" title={item.name}>
                                    {item.name}
                                </h4>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[9px] text-zinc-500 font-medium">
                                        ${(item.price || 0).toFixed(2)} c/u
                                    </span>
                                    {item.offerApplied && (
                                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[8px] font-black uppercase tracking-widest px-1 py-0 h-3.5">
                                            PROMO
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right: Quantity controls, Price, Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            {/* Quantity Controls */}
                            <div className="flex items-center bg-zinc-800/50 rounded-lg p-0.5 border border-white/5">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-zinc-400 hover:text-white"
                                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                                >
                                    <Minus className="h-3 w-3" />
                                </Button>
                                <div
                                    className="w-7 text-center text-xs font-black text-green-500 cursor-pointer"
                                    onClick={() => setIsQuantityDialogOpen(true)}
                                >
                                    {item.quantity}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-green-500 hover:text-green-400"
                                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                >
                                    <Plus className="h-3 w-3" />
                                </Button>

                                <QuantityDialog
                                    isOpen={isQuantityDialogOpen}
                                    onClose={() => setIsQuantityDialogOpen(false)}
                                    onConfirm={(q) => onUpdateQuantity(item.id, q)}
                                    itemName={item.name}
                                    currentQuantity={item.quantity}
                                />
                            </div>

                            {/* Total Price */}
                            <div className="min-w-[60px] text-right">
                                <p className="font-black text-xs text-zinc-100">
                                    ${(calculateItemTotal(item) || 0).toFixed(2)}
                                </p>
                            </div>

                            {/* Comment Trigger */}
                            {onUpdateComment && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "h-7 w-7 rounded-lg transition-colors shrink-0",
                                        item.comment ? "bg-green-500/20 text-green-500" : "text-zinc-500 hover:bg-zinc-800"
                                    )}
                                    onClick={() => setIsEditingComment(!isEditingComment)}
                                >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                </Button>
                            )}

                            {/* Discount Trigger */}
                            {onUpdateDiscount && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "h-7 w-7 rounded-lg transition-colors shrink-0",
                                        item.discount && item.discount.value > 0 ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-500 hover:bg-zinc-800"
                                    )}
                                    onClick={() => setIsEditingDiscount(!isEditingDiscount)}
                                >
                                    <Percent className="h-3.5 w-3.5" />
                                </Button>
                            )}

                            {/* Delete Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-zinc-500 hover:text-destructive transition-colors shrink-0"
                                onClick={() => onRemoveFromCart(item.id)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>

                    {/* Comment Section */}
                    {(isEditingComment || item.comment) && (
                        <div className="p-2 pt-0 animate-in fade-in slide-in-from-top-1 duration-150">
                            {isEditingComment ? (
                                <div className="relative">
                                    <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-green-500" />
                                    <Input
                                        value={item.comment || ''}
                                        onChange={(e) => onUpdateComment?.(item.id, e.target.value)}
                                        placeholder="Nota para la orden..."
                                        className="h-8 pl-8 pr-4 text-[10px] bg-zinc-800/50 border-white/5 rounded-lg focus:ring-green-500/20 focus:border-green-500 text-zinc-100"
                                        autoFocus
                                        onBlur={() => !item.comment && setIsEditingComment(false)}
                                        onKeyDown={(e) => e.key === 'Enter' && setIsEditingComment(false)}
                                    />
                                </div>
                            ) : item.comment && (
                                <div
                                    className="text-[9px] font-bold uppercase tracking-wider text-green-600/70 bg-green-600/5 px-2 py-1 rounded-lg flex items-center gap-1.5 border border-green-600/10 cursor-pointer hover:bg-green-600/10 transition-colors"
                                    onClick={() => setIsEditingComment(true)}
                                >
                                    <MessageSquare className="h-2.5 w-2.5" />
                                    <span>Nota: {item.comment}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Discount Section */}
                    {(isEditingDiscount || (item.discount && item.discount.value > 0)) && (
                        <div className="p-2 pt-0 animate-in fade-in slide-in-from-top-1 duration-150">
                            {isEditingDiscount ? (
                                <div className="flex items-center gap-1.5 bg-zinc-800/30 p-1.5 rounded-lg border border-white/5">
                                    <Percent className="h-3 w-3 text-emerald-500" />
                                    <Input
                                        type="number"
                                        value={tempDiscountValue}
                                        onChange={(e) => setTempDiscountValue(e.target.value)}
                                        placeholder="0"
                                        className="h-8 w-16 text-center text-xs bg-zinc-900 border-white/5 rounded-lg text-white"
                                        autoFocus
                                    />
                                    <select
                                        value={tempDiscountType}
                                        onChange={(e) => setTempDiscountType(e.target.value as 'percentage' | 'amount')}
                                        className="h-8 bg-zinc-900 border border-white/5 rounded-lg text-[11px] text-white px-1 focus:ring-0"
                                    >
                                        <option value="percentage">%</option>
                                        <option value="amount">$</option>
                                    </select>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold"
                                        onClick={handleApplyDiscount}
                                    >
                                        Ok
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-1.5 text-zinc-500 hover:text-zinc-300 text-[10px]"
                                        onClick={() => setIsEditingDiscount(false)}
                                    >
                                        X
                                    </Button>
                                </div>
                            ) : item.discount && item.discount.value > 0 && (
                                <div
                                    className="text-[9px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg flex items-center justify-between border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20 transition-colors"
                                    onClick={() => {
                                        setTempDiscountValue(String(item.discount?.value || ''));
                                        setTempDiscountType(item.discount?.type || 'percentage');
                                        setIsEditingDiscount(true);
                                    }}
                                >
                                    <span className="flex items-center gap-1">
                                        <Percent className="h-2.5 w-2.5" />
                                        <span>Descuento: {item.discount.type === 'percentage' ? `${item.discount.value}%` : `$${item.discount.value}`}</span>
                                    </span>
                                    <span 
                                        className="text-[8px] text-zinc-500 font-bold hover:text-red-400" 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdateDiscount?.(item.id, 0, 'percentage');
                                            setTempDiscountValue('');
                                        }}
                                    >
                                        Quitar
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// React.memo: no re-renderizar si el item no cambió
export default React.memo(MobileCartItem, (prev, next) => {
    return (
        prev.item.id === next.item.id &&
        prev.item.quantity === next.item.quantity &&
        prev.item.price === next.item.price &&
        prev.item.comment === next.item.comment &&
        prev.item.discount?.value === next.item.discount?.value &&
        prev.item.discount?.type === next.item.discount?.type &&
        prev.item.offerApplied?.id === next.item.offerApplied?.id
    );
});
