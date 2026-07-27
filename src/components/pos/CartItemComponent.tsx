import React from 'react';
import { Plus, Minus, Trash2, MessageSquare, Tag, Percent, PlusCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CartItem, CartItemExtra } from '@/types/pos';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import QuantityDialog from './QuantityDialog';
import SelectExtraDialog from './SelectExtraDialog';

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
    <div className="group relative flex items-center gap-3 p-2.5 rounded-lg border border-border/40 hover:border-primary/40 bg-card hover:bg-accent/5 transition-all duration-300 shadow-sm animate-in fade-in slide-in-from-right-2">
      {/* 1. Info del Producto (Izquierda) */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 leading-none flex-wrap">
          <h4 className="font-black text-[15px] text-foreground break-words group-hover:text-primary transition-colors tracking-tight" title={item.name}>
            {item.name}
          </h4>
          {onUpdateComment && (
            <Button
              variant="ghost"
              size="icon"
              title="Agregar nota"
              onClick={() => setIsEditingComment(!isEditingComment)}
              className={cn(
                "h-5 w-5 flex-shrink-0 transition-all",
                item.comment ? 'text-primary' : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-primary'
              )}
            >
              <MessageSquare className="h-3 w-3" />
            </Button>
          )}
          {onUpdateDiscount && (
            <Button
              variant="ghost"
              size="icon"
              title="Aplicar descuento"
              onClick={() => setIsEditingDiscount(!isEditingDiscount)}
              className={cn(
                "h-5 w-5 flex-shrink-0 transition-all ml-1",
                item.discount && item.discount.value > 0 ? 'text-emerald-500' : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-emerald-500'
              )}
            >
              <Percent className="h-3 w-3" />
            </Button>
          )}

          {/* Botón Adicionales / Extra [➕] - Siempre visible */}
          <Button
            variant="outline"
            size="sm"
            title="Adicionar ingrediente extra a este plato"
            onClick={(e) => {
              e.stopPropagation();
              setIsSelectExtraOpen(true);
            }}
            className="h-6 px-1.5 text-[10px] font-bold border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 bg-emerald-500/10 rounded-md gap-1 shrink-0 ml-1"
          >
            <PlusCircle className="h-3.5 w-3.5 text-emerald-400" />
            <span>Adicional</span>
          </Button>
        </div>

        {/* Selected Extras List */}
        {item.selectedExtras && item.selectedExtras.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.selectedExtras.map((extra, idx) => (
              <Badge
                key={`${extra.id}-${idx}`}
                variant="outline"
                className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 text-[10px] py-0 px-1.5 gap-1 font-bold"
              >
                <span>+ {extra.quantity > 1 ? `${extra.quantity}x ` : ''}{extra.name} (+${(extra.price * (extra.quantity || 1)).toFixed(2)})</span>
                {onRemoveExtra && (
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive text-emerald-400/70"
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

        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-medium text-muted-foreground/70">
            ${(item.price || 0).toFixed(2)} / ud
          </span>
          {item.offerApplied && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] py-0 px-1 h-3.5 font-bold uppercase tracking-tighter">
              PROMO
            </Badge>
          )}
        </div>
        {item.comment && !isEditingComment && (
          <div className="mt-1 text-[10px] text-muted-foreground italic truncate max-w-[150px]">
             "{item.comment}"
          </div>
        )}
      </div>

      {/* Select Extra Dialog */}
      {isSelectExtraOpen && (
        <SelectExtraDialog
          isOpen={isSelectExtraOpen}
          onClose={() => setIsSelectExtraOpen(false)}
          onAddExtra={(extra) => onAddExtra?.(item.cartItemId || item.id, extra)}
          itemName={item.name}
        />
      )}


      
      {/* 2. Selector de Cantidad (Derecha - Centro) */}
      <div className="flex items-center bg-muted/40 rounded-full border border-border/30 p-0.5 shadow-inner w-[100px] flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onUpdateQuantity(item.cartItemId || item.id, item.quantity - 1)}
          className="h-6 w-6 rounded-full hover:bg-background hover:shadow-sm text-muted-foreground hover:text-foreground transition-all active:scale-90"
        >
          <Minus className="h-3 w-3" />
        </Button>
        
        <div 
          className="flex-1 text-center text-[13px] font-black select-none cursor-pointer hover:text-primary transition-colors pr-0.5"
          onClick={() => setIsQuantityDialogOpen(true)}
        >
          {item.quantity}
        </div>

        <QuantityDialog
          isOpen={isQuantityDialogOpen}
          onClose={() => setIsQuantityDialogOpen(false)}
          onConfirm={(q) => onUpdateQuantity(item.cartItemId || item.id, q)}
          itemName={item.name}
          currentQuantity={item.quantity}
        />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onUpdateQuantity(item.cartItemId || item.id, item.quantity + 1)}
          className="h-6 w-6 rounded-full hover:bg-background hover:shadow-sm text-muted-foreground hover:text-foreground transition-all active:scale-90"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* 3. Precio Total (Derecha) */}
      <div className="text-right flex-shrink-0 min-w-[90px]">
        <div className="text-[18px] font-black text-primary tracking-tighter tabular-nums">
          ${calculateItemTotal(item).toFixed(2)}
        </div>
        {item.offerApplied && (
          <div className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-100 inline-block">
            {item.offerApplied.quantity}x
          </div>
        )}
      </div>

      {/* 4. Botón Eliminar (Extremo Derecho) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(item.cartItemId || item.id)}
        className="h-9 w-9 text-red-500/60 hover:text-red-600 hover:bg-red-500/10 rounded-full transition-all flex-shrink-0"
        title="Eliminar"
      >
        <Trash2 className="h-4.5 w-4.5" />
      </Button>


      {onUpdateComment && (
        <div className={`mt-1 animate-in slide-in-from-top-1 duration-200 ${!isEditingComment && !item.comment ? 'hidden' : ''}`}>
          {isEditingComment ? (
            <div className="flex gap-1 items-center">
              <Input
                value={item.comment || ''}
                onChange={(e) => onUpdateComment(item.cartItemId || item.id, e.target.value)}
                placeholder="Nota para factura..."
                className="h-7 text-xs bg-background/50 border-muted-foreground/20 focus:border-primary shadow-sm"
                autoFocus
                onBlur={() => !item.comment && setIsEditingComment(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingComment(false)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary hover:bg-primary/10"
                onClick={() => setIsEditingComment(false)}
              >
                <MessageSquare className="h-3 w-3" />
              </Button>
            </div>
          ) : item.comment && (
            <div
              className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-1 rounded inline-flex items-center gap-1 cursor-pointer hover:bg-muted/60 transition-colors w-full"
              onClick={() => setIsEditingComment(true)}
              title="Click para editar"
            >
              <MessageSquare className="h-2.5 w-2.5 opacity-50" />
              <span className="truncate">{item.comment}</span>
            </div>
          )}
        </div>
      )}

      {/* Discount Section below comment */}
      {(isEditingDiscount || (item.discount && item.discount.value > 0)) && (
        <div className={`mt-1.5 animate-in slide-in-from-top-1 duration-200 ${!isEditingDiscount && (!item.discount || item.discount.value === 0) ? 'hidden' : ''}`}>
          {isEditingDiscount ? (
            <div className="flex gap-1.5 items-center bg-muted/30 p-1.5 rounded-lg border border-border/20">
              <Percent className="h-3 w-3 text-emerald-500" />
              <Input
                type="number"
                value={tempDiscountValue}
                onChange={(e) => setTempDiscountValue(e.target.value)}
                placeholder="0"
                className="h-7 w-16 text-center text-xs bg-background border-border/20 rounded-md"
                autoFocus
              />
              <select
                value={tempDiscountType}
                onChange={(e) => setTempDiscountType(e.target.value as 'percentage' | 'amount')}
                className="h-7 bg-background border border-border/20 rounded-md text-[11px] px-1 focus:ring-0 focus:border-border/30"
              >
                <option value="percentage">%</option>
                <option value="amount">$</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[10px] font-bold"
                onClick={handleApplyDiscount}
              >
                Ok
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 text-zinc-500 hover:text-zinc-300 text-[10px]"
                onClick={() => setIsEditingDiscount(false)}
              >
                X
              </Button>
            </div>
          ) : item.discount && item.discount.value > 0 && (
            <div
              className="text-[10px] text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 py-1 rounded-md inline-flex items-center justify-between gap-2 border border-emerald-100 dark:border-emerald-900/30 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors w-full"
              onClick={() => {
                setTempDiscountValue(String(item.discount?.value || ''));
                setTempDiscountType(item.discount?.type || 'percentage');
                setIsEditingDiscount(true);
              }}
              title="Click para editar"
            >
              <span className="flex items-center gap-1">
                <Percent className="h-3 w-3 opacity-70" />
                <span>Descuento: {item.discount.type === 'percentage' ? `${item.discount.value}%` : `$${item.discount.value}`}</span>
              </span>
              <span 
                className="text-[9px] text-muted-foreground hover:text-red-500 font-semibold"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateDiscount?.(item.cartItemId || item.id, 0, 'percentage');
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
    JSON.stringify(prev.item.selectedExtras || []) === JSON.stringify(next.item.selectedExtras || [])
  );
});
