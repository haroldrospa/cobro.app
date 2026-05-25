import React from 'react';
import { Plus, Minus, Trash2, MessageSquare, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CartItem } from '@/types/pos';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import QuantityDialog from './QuantityDialog';

interface CartItemComponentProps {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdateComment?: (id: string, comment: string) => void;
  onRemove: (id: string) => void;
  calculateItemTotal: (item: CartItem) => number;
}

const CartItemComponent: React.FC<CartItemComponentProps> = ({
  item,
  onUpdateQuantity,
  onUpdateComment,
  onRemove,
  calculateItemTotal
}) => {
  const [isEditingComment, setIsEditingComment] = React.useState(false);
  const [isQuantityDialogOpen, setIsQuantityDialogOpen] = React.useState(false);
  return (
    <div className="group relative flex items-center gap-3 p-2.5 rounded-lg border border-border/40 hover:border-primary/40 bg-card hover:bg-accent/5 transition-all duration-300 shadow-sm animate-in fade-in slide-in-from-right-2">
      {/* 1. Info del Producto (Izquierda) */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 leading-none">
          <h4 className="font-black text-[15px] text-foreground truncate group-hover:text-primary transition-colors tracking-tight" title={item.name}>
            {item.name}
          </h4>
          {onUpdateComment && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditingComment(!isEditingComment)}
              className={cn(
                "h-5 w-5 flex-shrink-0 transition-all",
                item.comment ? 'text-primary' : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-primary'
              )}
            >
              <MessageSquare className="h-3 w-3" />
            </Button>
          )}
        </div>
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


      
      {/* 2. Selector de Cantidad (Derecha - Centro) */}
      <div className="flex items-center bg-muted/40 rounded-full border border-border/30 p-0.5 shadow-inner w-[100px] flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
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
          onConfirm={(q) => onUpdateQuantity(item.id, q)}
          itemName={item.name}
          currentQuantity={item.quantity}
        />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
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
        onClick={() => onRemove(item.id)}
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
                onChange={(e) => onUpdateComment(item.id, e.target.value)}
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
    </div>
  );
};

export default React.memo(CartItemComponent);
