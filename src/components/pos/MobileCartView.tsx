import React, { useEffect, useRef } from 'react';
import { ShoppingCart, ClipboardList, X, Utensils, ShoppingBag, Tag, PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CartItem } from '@/types/pos';
import { cn } from '@/lib/utils';
import MobileCartItem from './MobileCartItem';
import { useBusinessType } from '@/hooks/useBusinessType';

interface MobileCartViewProps {
  cart: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdateComment?: (id: string, comment: string) => void;
  onUpdateDiscount?: (id: string, value: number, type: 'percentage' | 'amount') => void;
  onAddExtra?: (cartItemId: string, extra: any) => void;
  onRemoveExtra?: (cartItemId: string, extraId: string) => void;
  onRemoveFromCart: (id: string) => void;
  calculateItemTotal: (item: CartItem) => number;
  currentOrderInfo?: { orderNumber: string; customerName: string } | null;
  onClearOrder?: () => void;
  isInvoiceLimitReached?: boolean;
  orderType?: 'dine-in' | 'takeout';
  onOrderTypeChange?: (type: 'dine-in' | 'takeout') => void;
  onSaveOrder?: () => void;
}

const MobileCartView: React.FC<MobileCartViewProps> = ({
  cart,
  onUpdateQuantity,
  onUpdateComment,
  onUpdateDiscount,
  onAddExtra,
  onRemoveExtra,
  onRemoveFromCart,
  calculateItemTotal,
  currentOrderInfo,
  onClearOrder,
  isInvoiceLimitReached,
  orderType = 'dine-in',
  onOrderTypeChange,
  onSaveOrder,
}) => {
  const { isRestaurant, isStore, isSupermarket, orderTypeLabels } = useBusinessType();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [cart.length]);

  if (cart.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-700">
        <div className="relative mb-10 group">
          {/* Glowing backdrops */}
          <div className="absolute inset-0 bg-green-500/20 blur-[80px] rounded-full animate-pulse opacity-50" />
          <div className="absolute -inset-4 bg-green-500/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          
          {/* Main icon container */}
          <div className="relative bg-card rounded-[3rem] p-10 border border-border shadow-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
            <PackageSearch className="h-20 w-20 text-green-500/40 relative z-10" />
            <div className="absolute -top-2 -right-2 bg-green-500 h-8 w-8 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/40 border border-white/20">
              <ShoppingCart className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <h3 className="text-3xl font-black text-foreground uppercase tracking-tighter italic mb-3">
          Carrito Vacío
        </h3>
        <div className="space-y-1 max-w-[240px]">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
            Tu orden está esperando
          </p>
          <p className="text-[10px] font-medium text-emerald-500/70 uppercase tracking-widest leading-relaxed">
            Agrega productos desde el catálogo para iniciar una nueva venta
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-transparent min-h-0">
      {/* Header Info */}
      <div className="px-4 py-3 shrink-0">
        {isInvoiceLimitReached && (
          <div className="bg-destructive/10 border border-destructive/20 p-2 rounded-xl mb-3 flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
            <p className="text-[10px] font-black uppercase text-destructive tracking-widest">
              Límite de facturas alcanzado
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Items en orden</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-foreground">{cart.length}</span>
              <span className="text-muted-foreground font-bold">productos</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSaveOrder && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSaveOrder}
                className="h-8 rounded-full bg-secondary border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/10 font-black uppercase tracking-widest text-[10px] px-4 shadow-sm"
              >
                {currentOrderInfo ? 'Actualizar Pedido' : 'Guardar Pedido'}
              </Button>
            )}
            
            {currentOrderInfo && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <ClipboardList className="h-3 w-3" />
                  {currentOrderInfo.orderNumber}
                </Badge>
                {onClearOrder && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={onClearOrder}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Order Type Toggle */}
        {onOrderTypeChange && (isRestaurant || isStore || isSupermarket) && (
          <div className="flex bg-muted p-1.5 rounded-2xl mt-4 border border-border">
            <button
              onClick={() => onOrderTypeChange('dine-in')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                orderType === 'dine-in' 
                  ? "bg-background text-emerald-600 dark:text-emerald-400 border border-border shadow-md" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {(isStore || isSupermarket) ? <Tag className="h-3.5 w-3.5" /> : <Utensils className="h-3.5 w-3.5" />}
              {orderTypeLabels['dine-in']}
            </button>
            <button
              onClick={() => onOrderTypeChange('takeout')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                orderType === 'takeout' 
                  ? "bg-background text-emerald-600 dark:text-emerald-400 border border-border shadow-md" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              {orderTypeLabels['takeout']}
            </button>
          </div>
        )}
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto px-4 no-scrollbar scroll-smooth">
        <div className="pb-8">
          {cart.map((item) => (
            <MobileCartItem
              key={item.cartItemId || item.id}
              item={item}
              onUpdateQuantity={onUpdateQuantity}
              onRemoveFromCart={onRemoveFromCart}
              calculateItemTotal={calculateItemTotal}
              onUpdateComment={onUpdateComment}
              onUpdateDiscount={onUpdateDiscount}
              onAddExtra={onAddExtra}
              onRemoveExtra={onRemoveExtra}
            />
          ))}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>
    </div>
  );
};

export default MobileCartView;
