import React, { useState } from 'react';
import { Minus, Plus, Trash2, Package, MessageSquare } from 'lucide-react';
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
    onUpdateComment
}) => {
    const [isEditingComment, setIsEditingComment] = useState(false);
    const [isQuantityDialogOpen, setIsQuantityDialogOpen] = useState(false);

    return (
        <div className="mb-3 animate-in fade-in duration-200">
            <div className="overflow-hidden border border-white/5 bg-zinc-900/40 rounded-2xl">
                <div className="flex flex-col">
                    <div className="flex items-stretch text-zinc-100">
                        {/* Product Image */}
                        <div className="w-24 h-24 bg-zinc-800 flex-shrink-0 flex items-center justify-center relative overflow-hidden rounded-l-2xl">
                            {item.image_url ? (
                                <img
                                    src={item.image_url}
                                    alt={item.name}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <Package className="h-8 w-8 text-white/10" />
                            )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                            <div className="flex justify-between items-start gap-2">
                                <h4 className="font-black text-xs uppercase tracking-tight line-clamp-2">{item.name}</h4>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 -mt-2 -mr-2 text-zinc-500 hover:text-destructive transition-colors"
                                    onClick={() => onRemoveFromCart(item.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex items-end justify-between mt-2">
                                {/* Quantity Controls */}
                                <div className="flex items-center bg-zinc-800/50 rounded-xl p-1 border border-white/5">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-zinc-400 hover:text-white"
                                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                                    >
                                        <Minus className="h-3.5 w-3.5" />
                                    </Button>
                                    <div
                                        className="w-10 text-center text-sm font-black text-green-500 cursor-pointer"
                                        onClick={() => setIsQuantityDialogOpen(true)}
                                    >
                                        {item.quantity}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-green-500 hover:text-green-400"
                                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </Button>

                                    <QuantityDialog
                                        isOpen={isQuantityDialogOpen}
                                        onClose={() => setIsQuantityDialogOpen(false)}
                                        onConfirm={(q) => onUpdateQuantity(item.id, q)}
                                        itemName={item.name}
                                        currentQuantity={item.quantity}
                                    />
                                </div>

                                {/* Price and Notes */}
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-1.5">
                                        {onUpdateComment && (
                                            <button
                                                onClick={() => setIsEditingComment(!isEditingComment)}
                                                className={cn(
                                                    "p-1.5 rounded-lg transition-colors",
                                                    item.comment ? "bg-green-500/20 text-green-500" : "text-zinc-500 hover:bg-zinc-800"
                                                )}
                                            >
                                                <MessageSquare className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                        <p className="font-black text-lg text-zinc-100">
                                            ${(calculateItemTotal(item) || 0).toFixed(2)}
                                        </p>
                                    </div>
                                    {item.offerApplied ? (
                                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] font-black uppercase tracking-widest h-5">
                                            PROMO: {item.offerApplied.name}
                                        </Badge>
                                    ) : item.quantity > 1 && (
                                        <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                                            ${(item.price || 0).toFixed(2)} c/u
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Comment Section */}
                    {(isEditingComment || item.comment) && (
                        <div className="p-3 pt-0 animate-in fade-in slide-in-from-top-1 duration-150">
                            {isEditingComment ? (
                                <div className="relative">
                                    <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-500" />
                                    <Input
                                        value={item.comment || ''}
                                        onChange={(e) => onUpdateComment?.(item.id, e.target.value)}
                                        placeholder="Nota para la orden..."
                                        className="h-10 pl-9 pr-4 text-xs bg-zinc-800/50 border-white/5 rounded-xl focus:ring-green-500/20 focus:border-green-500 text-zinc-100"
                                        autoFocus
                                        onBlur={() => !item.comment && setIsEditingComment(false)}
                                        onKeyDown={(e) => e.key === 'Enter' && setIsEditingComment(false)}
                                    />
                                </div>
                            ) : item.comment && (
                                <div
                                    className="text-[10px] font-bold uppercase tracking-wider text-green-600/70 bg-green-600/5 px-2.5 py-2 rounded-xl flex items-center gap-2 border border-green-600/10 cursor-pointer hover:bg-green-600/10 transition-colors"
                                    onClick={() => setIsEditingComment(true)}
                                >
                                    <MessageSquare className="h-3 w-3" />
                                    <span>Nota: {item.comment}</span>
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
        prev.item.offerApplied?.id === next.item.offerApplied?.id
    );
});
