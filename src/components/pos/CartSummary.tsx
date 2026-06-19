import React, { useEffect, useRef } from 'react';
import { ShoppingCart, ClipboardList, X, Utensils, ShoppingBag, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CartItem } from '@/types/pos';
import CartItemComponent from './CartItemComponent';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { useBusinessType } from '@/hooks/useBusinessType';
import LoyaltyPanel from './LoyaltyPanel';

interface CartSummaryProps {
  cart: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdateComment: (id: string, comment: string) => void;
  onUpdateDiscount?: (id: string, value: number, type: 'percentage' | 'amount') => void;
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
}

const CartSummary: React.FC<CartSummaryProps> = ({
  cart,
  onUpdateQuantity,
  onUpdateComment,
  onUpdateDiscount,
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
      <CardHeader className="pb-1 flex-shrink-0 px-3 pt-2 space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <ShoppingCart className="h-4 w-4 shrink-0" />
            <span className="truncate">Carrito ({cart.length})</span>
          </CardTitle>

          {/* Order type toggle for restaurants, stores, or supermarkets */}
          {onOrderTypeChange && (isRestaurant || isStore || isSupermarket) && (
            <div className="flex bg-muted/50 p-1 rounded-md shrink-0 gap-1 border border-border/50">
              <button
                onClick={() => onOrderTypeChange('dine-in')}
                className={`flex items-center justify-center gap-2 py-1.5 px-4 rounded text-[13px] font-bold transition-all ${orderType === 'dine-in'
                  ? 'bg-background shadow-md text-primary'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                {(isStore || isSupermarket) ? <Tag className="h-4 w-4" /> : <Utensils className="h-4 w-4" />}
                {orderTypeLabels['dine-in']}
              </button>
              <button
                onClick={() => onOrderTypeChange('takeout')}
                className={`flex items-center justify-center gap-2 py-1.5 px-4 rounded text-[13px] font-bold transition-all ${orderType === 'takeout'
                  ? 'bg-background shadow-md text-primary'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <ShoppingBag className="h-4 w-4" />
                {orderTypeLabels['takeout']}
              </button>
            </div>
          )}
        </div>

        {/* Active order badge */}
        {currentOrderInfo && (
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
            <div className="text-center text-muted-foreground flex flex-col items-center justify-center h-full">
              {!companyLogo && <ShoppingCart className="h-20 w-20 mx-auto mb-3 opacity-15" />}
              <p className="text-sm text-muted-foreground/60">Agrega productos al carrito</p>
            </div>
          ) : (
            cart.map(item => (
              <CartItemComponent
                key={item.id}
                item={item}
                onUpdateQuantity={onUpdateQuantity}
                onUpdateComment={onUpdateComment}
                onUpdateDiscount={onUpdateDiscount}
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
