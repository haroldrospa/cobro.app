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

  // Automatically close payment view and cart drawer when cart becomes empty (e.g. sale completed, printed or cleared)
  React.useEffect(() => {
    if (cart.length === 0) {
      setIsPaymentOpen(false);
      setIsCartOpen(false);
    }
  }, [cart.length]);

  const openPaymentSummary = () => {
    setIsCartOpen(false);
    setIsPaymentOpen(true);
  };

  const hasItems = cart.length > 0;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden relative pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <SubscriptionWarningBanner />
      {/* ── MAIN PRODUCT FEED ── */}
      <main className="flex-1 min-h-0 relative">
        {productSearchComponent}
      </main>

      {/* ── FLOATING PAYMENT BAR — CSS animated, no Framer Motion ── */}
      <div
        className={cn(
          "absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 z-40",
          "mobile-landscape:bottom-[calc(0.5rem+env(safe-area-inset-bottom))] mobile-landscape:left-3 mobile-landscape:right-3",
          "transition-all duration-300 ease-out will-change-transform",
          hasItems && !isPaymentOpen
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-36 opacity-0 pointer-events-none"
        )}
      >
        <div className="w-full flex items-center justify-between bg-zinc-900/95 dark:bg-zinc-100/10 backdrop-blur-xl border border-white/10 rounded-2xl mobile-landscape:rounded-xl p-4 mobile-landscape:py-2 mobile-landscape:px-3 shadow-2xl shadow-black/40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex-1 flex items-center gap-3 mobile-landscape:gap-2 text-left group active:scale-[0.98] transition-transform duration-150"
          >
            <div className="relative">
              <div className="bg-emerald-500 rounded-xl mobile-landscape:rounded-lg p-2 mobile-landscape:p-1.5">
                <ShoppingCart className="h-5 w-5 mobile-landscape:h-4 mobile-landscape:w-4 text-white" />
              </div>
              <Badge
                variant="destructive"
                className="absolute -top-2 -right-2 h-5 min-w-5 mobile-landscape:h-4 mobile-landscape:min-w-4 p-0 flex items-center justify-center text-[10px] mobile-landscape:text-[8px] font-bold border-2 border-zinc-900"
              >
                {cart.length}
              </Badge>
            </div>
            <div>
              <p className="text-[10px] mobile-landscape:text-[8px] uppercase tracking-widest font-black text-white/60 leading-none mb-1 mobile-landscape:mb-0.5">Total a Pagar</p>
              <p className="text-xl mobile-landscape:text-base font-black text-white leading-none">${cartTotal}</p>
            </div>
          </button>

          <button
            onClick={openPaymentSummary}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 py-2.5 px-5 mobile-landscape:py-1.5 mobile-landscape:px-3.5 rounded-xl mobile-landscape:rounded-lg active:scale-[0.98] transition-transform duration-150"
          >
            <CreditCard className="h-5 w-5 mobile-landscape:h-4 mobile-landscape:w-4 text-white" />
            <span className="text-sm mobile-landscape:text-xs uppercase font-black text-white tracking-widest">Pagar</span>
          </button>
        </div>
      </div>

      {/* ── PAYMENT VIEW OVERLAY — CSS slide-in ── */}
      <div
        className={cn(
          "absolute inset-0 z-50 bg-background pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)]",
          "transition-transform duration-300 ease-out will-change-transform",
          isPaymentOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!isPaymentOpen}
      >
        <div className="h-full flex flex-col">
          <header className="relative flex items-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] mobile-landscape:p-2 border-b border-border/10 flex-shrink-0">
            <Button
              variant="ghost"
              onClick={() => setIsPaymentOpen(false)}
              className="font-bold text-muted-foreground hover:text-foreground h-9 mobile-landscape:h-7 px-3 mobile-landscape:px-2 shrink-0 relative z-10"
            >
              ← Volver
            </Button>
            <h2 className="absolute inset-x-0 text-center font-black text-sm sm:text-base whitespace-nowrap pointer-events-none">Finalizar Venta</h2>
          </header>
          <div className="flex-1 overflow-y-auto">
            {/* Solo se monta cuando está realmente abierta — antes se
                renderizaba SIEMPRE (solo oculta con CSS transform para el
                slide-in), así que cada cambio de carrito la re-renderizaba
                entera aunque el usuario ni la estuviera viendo. */}
            {isPaymentOpen && paymentComponent}
          </div>
        </div>
      </div>

      {/* ── CART DRAWER ── */}
      <Drawer open={isCartOpen} onOpenChange={setIsCartOpen}>
        {!hasItems && !isPaymentOpen && (
          <DrawerTrigger asChild>
            <button className="flex-shrink-0 bg-background/95 backdrop-blur-md border-t border-border/40 py-3 mobile-landscape:py-1.5 safe-area-bottom px-4 w-full text-left active:bg-muted/50 transition-colors z-40 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-muted rounded-full p-2 mobile-landscape:p-1.5">
                    <ShoppingCart className="h-5 w-5 mobile-landscape:h-3.5 mobile-landscape:w-3.5 text-muted-foreground" />
                  </div>
                  <div className="mobile-landscape:flex mobile-landscape:items-center mobile-landscape:gap-2">
                    <span className="text-sm mobile-landscape:text-xs font-bold block">Carrito Vacío</span>
                    <span className="text-[10px] mobile-landscape:text-[9px] text-muted-foreground font-medium uppercase tracking-widest">
                      <span className="hidden mobile-landscape:inline">· </span>Toca para opciones (clientes, etc)
                    </span>
                  </div>
                </div>
                <ChevronUp className="h-5 w-5 mobile-landscape:h-4 mobile-landscape:w-4 text-muted-foreground animate-pulse" />
              </div>
            </button>
          </DrawerTrigger>
        )}
        <DrawerContent className="bg-background/95 backdrop-blur-2xl border-border max-h-[85vh] mobile-landscape:max-h-[92vh] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          <DrawerHeader className="border-b border-border/40 pb-4 mobile-landscape:pb-2 mobile-landscape:py-2">
            <DrawerTitle className="text-lg mobile-landscape:text-sm font-black">
              Resumen del Pedido
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-hidden p-0 flex flex-col">
            {cartComponent}
          </div>
          <div className="p-4 mobile-landscape:p-2.5 border-t border-border/40 safe-area-bottom">
            {hasItems && (
              <div className="flex items-center justify-between mb-3 mobile-landscape:mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total</span>
                <span className="text-2xl mobile-landscape:text-lg font-black text-foreground">${cartTotal}</span>
              </div>
            )}
            <Button
              onClick={hasItems ? openPaymentSummary : undefined}
              disabled={!hasItems}
              className={cn(
                "w-full h-14 mobile-landscape:h-10 rounded-xl text-lg mobile-landscape:text-sm font-black",
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
