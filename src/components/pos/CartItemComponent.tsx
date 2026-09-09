import React from 'react';
import { Plus, Minus, Trash2, MessageSquare, Tag, Percent, PlusCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CartItem, CartItemExtra } from '@/types/pos';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import QuantityDialog from './QuantityDialog';
import SelectExtraDialog from './SelectExtraDialog';
import { useBusinessType } from '@/hooks/useBusinessType';

interface CartItemComponentProps {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdateComment?: (id: string, comment: string) => void;
  onUpdateDiscount?: (id: string, value: number, type: 'percentage' | 'amount') => void;
  onAddExtra?: (cartItemId: string, extra: CartItemExtra) => void;
  onRemoveExtra?: (cartItemId: string, extraId: string) => void;
  onRemove: (id: string) => void;
  calculateItemTotal: (item: CartItem) => number;
}

const CartItemComponent: React.FC<CartItemComponentProps> = ({
  item,
  onUpdateQuantity,
  onUpdateComment,
  onUpdateDiscount,
  onAddExtra,
  onRemoveExtra,
  onRemove,
  calculateItemTotal
}) => {
  const { isRestaurant } = useBusinessType();
  const [isEditingComment, setIsEditingComment] = React.useState(false);
  const [isQuantityDialogOpen, setIsQuantityDialogOpen] = React.useState(false);
  const [isEditingDiscount, setIsEditingDiscount] = React.useState(false);
  const [isSelectExtraOpen, setIsSelectExtraOpen] = React.useState(false);
  const [tempDiscountValue, setTempDiscountValue] = React.useState(item.discount?.value ? String(item.discount.value) : '');
  const [tempDiscountType, setTempDiscountType] = React.useState<'percentage' | 'amount'>(item.discount?.type || 'percentage');

  const handleApplyDiscount = () => {
    const val = parseFloat(tempDiscountValue);
    const identifier = item.cartItemId || item.id;
    if (!isNaN(val) && val >= 0) {
      onUpdateDiscount?.(identifier, val, tempDiscountType);
      setIsEditingDiscount(false);
    } else {
      onUpdateDiscount?.(identifier, 0, 'percentage');
      setIsEditingDiscount(false);
    }
  };
  return (
    <div className="group relative flex flex-col gap-1 p-2 rounded-lg border border-border/50 hover:border-primary/50 bg-card hover:bg-accent/5 transition-all duration-200 shadow-xs">
      {/* Fila 1: Nombre del producto + Precio total + Botón eliminar */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <h4
          className="font-bold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition-colors tracking-tight flex-1 min-w-0"
          title={item.name}
        >
          {item.name}
        </h4>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs sm:text-sm font-extrabold text-foreground tabular-nums">
            ${calculateItemTotal(item).toFixed(2)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(item.cartItemId || item.id)}
            className="h-5 w-5 text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all shrink-0 -mr-0.5"
            title="Eliminar del carrito"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Fila 2: Detalles (precio ud, extras, notas, desc) + Selector de cantidad compacto */}
      <div className="flex items-center justify-between gap-2 text-[11px] min-w-0">
        {/* Izquierda: Precio unitario y accesos rápidos */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="text-muted-foreground font-medium tabular-nums text-[11px]">
            ${(item.price || 0).toFixed(2)}/ud
          </span>

          {item.offerApplied && (
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[9px] py-0 px-1 h-4 font-bold uppercase tracking-tight"
            >
              PROMO
            </Badge>
          )}

          {/* Botón Adicionales / Extra [➕] - Solo restaurantes */}
          {isRestaurant && (
            <button
              type="button"
              title="Adicionar ingrediente extra"
              onClick={(e) => {
                e.stopPropagation();
                setIsSelectExtraOpen(true);
              }}
              className="h-4.5 px-1.5 text-[9px] font-bold border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 bg-emerald-500/10 rounded flex items-center gap-0.5 shrink-0 transition-colors"
            >
              <PlusCircle className="h-2.5 w-2.5 text-emerald-500" />
              <span>Extra</span>
            </button>
          )}

          {/* Botón Nota */}
          {onUpdateComment && (
            <button
              type="button"
              title={item.comment ? `Nota: "${item.comment}"` : "Agregar nota"}
              onClick={() => setIsEditingComment(!isEditingComment)}
              className={cn(
                "h-4.5 px-1 text-[9px] rounded flex items-center gap-0.5 transition-colors shrink-0",
                item.comment
                  ? "text-primary bg-primary/10 font-medium"
                  : "text-muted-foreground/50 hover:text-foreground hover:bg-muted"
              )}
            >
              <MessageSquare className="h-2.5 w-2.5" />
              {item.comment && <span className="max-w-[80px] truncate">{item.comment}</span>}
            </button>
          )}

          {/* Botón Descuento */}
          {onUpdateDiscount && (
            <button
              type="button"
              title="Aplicar descuento individual"
              onClick={() => setIsEditingDiscount(!isEditingDiscount)}
              className={cn(
                "h-4.5 px-1 text-[9px] rounded flex items-center gap-0.5 transition-colors shrink-0",
                item.discount && item.discount.value > 0
                  ? "text-emerald-500 bg-emerald-500/10 font-bold"
                  : "text-muted-foreground/50 hover:text-foreground hover:bg-muted"
              )}
            >
              <Percent className="h-2.5 w-2.5" />
              {item.discount && item.discount.value > 0 && (
                <span>{item.discount.type === 'percentage' ? `${item.discount.value}%` : `$${item.discount.value}`}</span>
              )}
            </button>
          )}
        </div>

        {/* Derecha: Selector de Cantidad compacto */}
        <div className="flex items-center bg-muted/60 rounded-md border border-border/40 p-0.5 shadow-xs shrink-0">
          <button
            type="button"
            onClick={() => onUpdateQuantity(item.cartItemId || item.id, item.quantity - 1)}
            className="h-5 w-5 rounded hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors active:scale-95"
            title="Disminuir"
          >
            <Minus className="h-2.5 w-2.5" />
          </button>
          <span
            onClick={() => setIsQuantityDialogOpen(true)}
            className="text-xs font-black px-1.5 min-w-[20px] text-center cursor-pointer select-none hover:text-primary transition-colors"
            title="Clic para ingresar cantidad exacta"
          >
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => onUpdateQuantity(item.cartItemId || item.id, item.quantity + 1)}
            className="h-5 w-5 rounded hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors active:scale-95"
            title="Aumentar"
          >
            <Plus className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      {/* Extras seleccionados (si existen) */}
      {item.selectedExtras && item.selectedExtras.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {item.selectedExtras.map((extra, idx) => (
            <Badge
              key={`${extra.id}-${idx}`}
              variant="outline"
              className="bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[9px] py-0 px-1.5 gap-1 font-semibold"
            >
              <span>+ {extra.quantity > 1 ? `${extra.quantity}x ` : ''}{extra.name} (${(extra.price * (extra.quantity || 1)).toFixed(2)})</span>
              {onRemoveExtra && (
                <X
                  className="h-2.5 w-2.5 cursor-pointer hover:text-destructive text-emerald-500/70"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveExtra(item.cartItemId || item.id, extra.id);
                  }}
                />
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Editor de comentario inline */}
      {isEditingComment && onUpdateComment && (
        <div className="mt-1 animate-in slide-in-from-top-1 duration-200">
          <div className="flex gap-1 items-center">
            <Input
              value={item.comment || ''}
              onChange={(e) => onUpdateComment(item.cartItemId || item.id, e.target.value)}
              placeholder="Nota para cocina o comanda..."
              className="h-6 text-xs bg-background border-muted-foreground/20 focus:border-primary shadow-xs"
              autoFocus
              onBlur={() => !item.comment && setIsEditingComment(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingComment(false)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-primary hover:bg-primary/10"
              onClick={() => setIsEditingComment(false)}
            >
              <Check className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Editor de descuento inline */}
      {isEditingDiscount && onUpdateDiscount && (
        <div className="mt-1 animate-in slide-in-from-top-1 duration-200">
          <div className="flex gap-1 items-center bg-muted/40 p-1 rounded-md border border-border/30">
            <Percent className="h-3 w-3 text-emerald-500 shrink-0" />
            <Input
              type="number"
              value={tempDiscountValue}
              onChange={(e) => setTempDiscountValue(e.target.value)}
              placeholder="0"
              className="h-6 w-14 text-center text-xs bg-background border-border/30 rounded"
              autoFocus
            />
            <select
              value={tempDiscountType}
              onChange={(e) => setTempDiscountType(e.target.value as 'percentage' | 'amount')}
              className="h-6 bg-background border border-border/30 rounded text-[11px] px-1 focus:ring-0"
            >
              <option value="percentage">%</option>
              <option value="amount">$</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold"
              onClick={handleApplyDiscount}
            >
              Ok
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-muted-foreground hover:text-foreground text-[10px]"
              onClick={() => setIsEditingDiscount(false)}
            >
              ✕
            </Button>
          </div>
        </div>
      )}

      {/* Modales de soporte */}
      {isQuantityDialogOpen && (
        <QuantityDialog
          isOpen={isQuantityDialogOpen}
          onClose={() => setIsQuantityDialogOpen(false)}
          onConfirm={(q) => onUpdateQuantity(item.cartItemId || item.id, q)}
          itemName={item.name}
          currentQuantity={item.quantity}
        />
      )}

      {isSelectExtraOpen && (
        <SelectExtraDialog
          isOpen={isSelectExtraOpen}
          onClose={() => setIsSelectExtraOpen(false)}
          onAddExtra={(extra) => onAddExtra?.(item.cartItemId || item.id, extra)}
          itemName={item.name}
        />
      )}
    </div>
  );
};

export default React.memo(CartItemComponent, (prev, next) => {
  return (
    prev.item.id === next.item.id &&
    prev.item.cartItemId === next.item.cartItemId &&
    prev.item.quantity === next.item.quantity &&
    prev.item.price === next.item.price &&
    prev.item.comment === next.item.comment &&
    prev.item.discount?.value === next.item.discount?.value &&
    prev.item.discount?.type === next.item.discount?.type &&
    prev.item.offerApplied?.id === next.item.offerApplied?.id &&
    (prev.item.selectedExtras?.length || 0) === (next.item.selectedExtras?.length || 0) &&
    prev.item.selectedExtras === next.item.selectedExtras
  );
});
