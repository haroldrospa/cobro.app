import React, { useState } from 'react';
import { ShoppingCart, CreditCard, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartItem } from '@/types/pos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTrigger, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { SubscriptionWarningBanner } from '@/components/SubscriptionWarningBanner';

interface MobilePOSLayoutProps {
  // Products tab
  productSearchComponent: React.ReactNode;
  // Cart tab
  cart: CartItem[];
  cartComponent: React.ReactNode;
  // Payment tab
  paymentComponent: React.ReactNode;
  // Cart total for quick view
  cartTotal: string;
  onCheckout: () => void;
}

const MobilePOSLayout: React.FC<MobilePOSLayoutProps> = ({
  productSearchComponent,
  cart,
  cartComponent,
  paymentComponent,
  cartTotal,
  onCheckout,
}) => {
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const openPaymentSummary = () => {
    setIsCartOpen(false);
    setIsPaymentOpen(true);
  };

  const hasItems = cart.length > 0;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden relative">
      <SubscriptionWarningBanner />
      {/* ── MAIN PRODUCT FEED ── */}
      <main className="flex-1 min-h-0 relative">
        {productSearchComponent}
      </main>

      {/* ── FLOATING PAYMENT BAR — CSS animated, no Framer Motion ── */}
      <div
        className={cn(
          "absolute bottom-6 left-4 right-4 z-40 hide-on-keyboard",
          "transition-all duration-300 ease-out will-change-transform",
          hasItems && !isPaymentOpen
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-24 opacity-0 pointer-events-none"
        )}
      >
        <div className="w-full flex items-center justify-between bg-zinc-900/95 dark:bg-zinc-100/10 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex-1 flex items-center gap-3 text-left group active:scale-[0.98] transition-transform duration-150"
          >
            <div className="relative">
              <div className="bg-emerald-500 rounded-xl p-2 shadow-lg shadow-emerald-500/20">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              <Badge
                variant="destructive"
                className="absolute -top-2 -right-2 h-5 min-w-5 p-0 flex items-center justify-center text-[10px] font-bold border-2 border-zinc-900"
              >
                {cart.length}
              </Badge>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-white/60 leading-none mb-1">Total a Pagar</p>
              <p className="text-xl font-black text-white leading-none">${cartTotal}</p>
            </div>
          </button>

          <button
            onClick={openPaymentSummary}
            className="flex items-center gap-2 bg-gradient-to-br from-green-600 to-emerald-500 py-2.5 px-5 rounded-xl shadow-lg shadow-green-500/20 active:scale-[0.98] transition-transform duration-150"
          >
            <CreditCard className="h-5 w-5 text-white" />
            <span className="text-sm uppercase font-black text-white tracking-widest">Pagar</span>
          </button>
        </div>
      </div>

      {/* ── PAYMENT VIEW OVERLAY — CSS slide-in ── */}
      <div
        className={cn(
          "absolute inset-0 z-50 bg-background",
          "transition-transform duration-300 ease-out will-change-transform",
          isPaymentOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!isPaymentOpen}
      >
        <div className="h-full flex flex-col">
          <header className="flex items-center justify-between p-3 border-b border-border/10 flex-shrink-0">
            <Button
              variant="ghost"
              onClick={() => setIsPaymentOpen(false)}
              className="font-bold text-muted-foreground hover:text-foreground h-9 px-3"
            >
              ← Volver
            </Button>
            <h2 className="font-black text-base sm:text-lg">Finalizar Venta</h2>
            <div className="w-16" /> {/* spacer */}
          </header>
          <div className="flex-1 overflow-y-auto">
            {paymentComponent}
          </div>
        </div>
      </div>

      {/* ── CART DRAWER ── */}
      <Drawer open={isCartOpen} onOpenChange={setIsCartOpen}>
        {!hasItems && !isPaymentOpen && (
          <DrawerTrigger asChild>
            <button className="flex-shrink-0 bg-background/95 backdrop-blur-md border-t border-border/40 py-3 safe-area-bottom px-4 w-full text-left active:bg-muted/50 transition-colors z-40 relative hide-on-keyboard">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-muted rounded-full p-2">
                    <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <span className="text-sm font-bold block">Carrito Vacío</span>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Toca para opciones (clientes, etc)</span>
                  </div>
                </div>
                <ChevronUp className="h-5 w-5 text-muted-foreground animate-pulse" />
              </div>
            </button>
          </DrawerTrigger>
        )}
        <DrawerContent className="bg-zinc-950/95 backdrop-blur-2xl border-white/10 max-h-[85vh]">
          <DrawerHeader className="border-b border-white/5 pb-4">
            <DrawerTitle className="text-xl font-black flex items-center gap-2">
              <div className="bg-muted h-2 w-2 rounded-full" />
              Resumen del Pedido
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-hidden p-0 flex flex-col">
            {cartComponent}
          </div>
          <div className="p-4 bg-zinc-900/50 border-t border-white/5 safe-area-bottom">
            <Button
              onClick={hasItems ? openPaymentSummary : undefined}
              disabled={!hasItems}
              className={cn(
                "w-full h-14 rounded-xl text-lg font-black",
                hasItems ? "bg-green-600 hover:bg-green-700 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              {hasItems ? 'Ir a Pagar' : 'Agrega productos para pagar'}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default MobilePOSLayout;
