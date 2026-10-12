import React, { useEffect, useRef } from 'react';
import { ShoppingCart, ClipboardList, X, Utensils, ShoppingBag, Tag, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CartItem } from '@/types/pos';
import CartItemComponent from './CartItemComponent';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { useBusinessType } from '@/hooks/useBusinessType';
import LoyaltyPanel from './LoyaltyPanel';
import { cn } from '@/lib/utils';

interface CartSummaryProps {
  cart: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdateComment: (id: string, comment: string) => void;
  onUpdateDiscount?: (id: string, value: number, type: 'percentage' | 'amount') => void;
  onAddExtra?: (cartItemId: string, extra: any) => void;
  onRemoveExtra?: (cartItemId: string, extraId: string) => void;
  onRemoveFromCart: (id: string) => void;
  calculateItemTotal: (item: CartItem) => number;
  currentOrderInfo?: { orderNumber: string; customerName: string } | null;
  onClearOrder?: () => void;
  orderType?: 'dine-in' | 'takeout';
  onOrderTypeChange?: (type: 'dine-in' | 'takeout') => void;
  cartTotal?: number;
  onLoyaltyCustomerFound?: (customerId: string) => void;
  onLoyaltyPointsBalance?: (currentPoints: number) => void;
  onLoyaltyPointsRedeemed?: (discountAmount: number, pointsUsed: number) => void;
  onLoyaltyClearRedemption?: () => void;
  loyaltyRedeemedPoints?: number;
  selectedTable?: string | null;
  onOpenTableSelector?: () => void;
  onClearTable?: () => void;
  onSaveOrder?: () => void;
}

const CartSummary: React.FC<CartSummaryProps> = ({
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
  orderType = 'dine-in',
  onOrderTypeChange,
  cartTotal = 0,
  onLoyaltyCustomerFound,
  onLoyaltyPointsBalance,
  onLoyaltyPointsRedeemed,
  onLoyaltyClearRedemption,
  loyaltyRedeemedPoints = 0,
  selectedTable,
  onOpenTableSelector,
  onClearTable,
  onSaveOrder,
}) => {
  const { companyInfo } = usePrintSettings();
  const { isRestaurant, isStore, isSupermarket, orderTypeLabels } = useBusinessType();
  const companyLogo = companyInfo.logo || null;
  const logoCartSize = companyInfo.logoCartSize;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [cart.length]);

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <CardHeader className="p-2 sm:px-3 sm:py-2 flex-shrink-0 space-y-1">
        <div className="flex items-center justify-between gap-1.5">
          <CardTitle className="flex items-center gap-1.5 text-xs sm:text-sm font-bold shrink-0">
            <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
            <span>Carrito ({cart.length})</span>
          </CardTitle>

          {/* Order type toggle for restaurants, stores, or supermarkets */}
          {onOrderTypeChange && (isRestaurant || isStore || isSupermarket) && (
            <div className="flex bg-muted/60 p-0.5 rounded-md shrink-0 gap-0.5 border border-border/40">
              <button
                type="button"
                onClick={() => onOrderTypeChange('dine-in')}
                className={cn(
                  "flex items-center justify-center gap-1 py-1 px-2 rounded text-[11px] font-bold transition-all",
                  orderType === 'dine-in'
                    ? "bg-background shadow-xs text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {(isStore || isSupermarket) ? <Tag className="h-3 w-3" /> : <Utensils className="h-3 w-3" />}
                <span>{orderTypeLabels['dine-in']}</span>
              </button>
              <button
                type="button"
                onClick={() => onOrderTypeChange('takeout')}
                className={cn(
                  "flex items-center justify-center gap-1 py-1 px-2 rounded text-[11px] font-bold transition-all",
                  orderType === 'takeout'
                    ? "bg-background shadow-xs text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ShoppingBag className="h-3 w-3" />
                <span>{orderTypeLabels['takeout']}</span>
              </button>
            </div>
          )}
        </div>

        {/* Active order or table badge */}
        {selectedTable ? (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <Utensils className="h-3.5 w-3.5" />
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mesa:</span>
                <span className="text-xs font-black text-foreground truncate">{selectedTable}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {cart.length > 0 && onSaveOrder && (
                <Button
                  type="button"
                  size="sm"
                  onClick={onSaveOrder}
                  className="h-6 px-2 text-[11px] font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-xs"
                  title="Guardar comanda en esta mesa (F9)"
                >
                  <Save className="h-3 w-3 mr-1" />
                  Guardar
                </Button>
              )}
              {onOpenTableSelector && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onOpenTableSelector}
                  className="h-6 px-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                  title="Cambiar mesa"
                >
                  Cambiar
                </Button>
              )}
              {onClearTable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClearTable}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Quitar mesa asignada"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            {currentOrderInfo ? (
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="flex items-center gap-1 text-xs py-0 h-5">
                  <ClipboardList className="h-2.5 w-2.5" />
                  {currentOrderInfo.orderNumber} · {currentOrderInfo.customerName}
                </Badge>
                {onClearOrder && (
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClearOrder} title="Descartar pedido">
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ) : (
              <div />
            )}

            {/* Botón de Asignación de Mesa */}
            {onOpenTableSelector && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenTableSelector}
                className="h-6 px-2 text-[11px] font-bold rounded-md gap-1 transition-all ml-auto border-dashed hover:border-amber-500 hover:text-amber-500"
              >
                <Utensils className="h-3 w-3" />
                <span>Asignar Mesa</span>
              </Button>
            )}
          </div>
        )}

      </CardHeader>

      {/* ── Products scroll area ── */}
      <CardContent className="flex-1 min-h-0 pt-0 px-3 pb-0 overflow-hidden relative">
        {/* Background logo */}
        {companyLogo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <img
              src={companyLogo}
              alt="Logo"
              className="w-auto object-contain opacity-10"
              style={{ height: `${logoCartSize}px`, maxWidth: '80%', filter: 'grayscale(100%) brightness(0.3)' }}
            />
          </div>
        )}

        <div
          ref={scrollRef}
          className="h-full overflow-y-auto space-y-1.5 relative z-10 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent pr-1 py-2"
        >
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground flex flex-col items-center justify-center h-full p-4">
              {selectedTable ? (
                <div className="space-y-2.5 animate-in fade-in duration-300">
                  <div className="relative inline-flex mx-auto">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-500">
                      <Utensils className="h-7 w-7" />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-foreground">
                      {selectedTable}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-[220px] mx-auto">
                      Mesa seleccionada. Agrega productos del catálogo para esta comanda.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {!companyLogo && <ShoppingCart className="h-20 w-20 mx-auto mb-3 opacity-15" />}
                  <p className="text-sm text-muted-foreground/60">Agrega productos al carrito</p>
                </>
              )}
            </div>
          ) : (
            cart.map(item => (
              <CartItemComponent
                key={item.cartItemId || item.id}
                item={item}
                onUpdateQuantity={onUpdateQuantity}
                onUpdateComment={onUpdateComment}
                onUpdateDiscount={onUpdateDiscount}
                onAddExtra={onAddExtra}
                onRemoveExtra={onRemoveExtra}
                onRemove={onRemoveFromCart}
                calculateItemTotal={calculateItemTotal}
              />
            ))
          )}
        </div>
      </CardContent>

    </Card>
  );
};

export default React.memo(CartSummary);
