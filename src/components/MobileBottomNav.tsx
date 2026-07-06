import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home,
  ShoppingCart,
  Package,
  Users,
  MoreHorizontal,
  Bike,
  ChefHat,
  X,
  FileText,
  BarChart,
  Settings,
  Briefcase,
  User,
  Database,
  LogOut,
  CloudUpload,
} from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useBusinessType } from '@/hooks/useBusinessType';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { invalidateSessionCache } from '@/lib/authSession';

/**
 * Barra de navegación inferior para mobile.
 * Solo se muestra en pantallas < md (768px).
 * Muestra POS, Dashboard, Productos, Clientes y "Más" (sheet lateral).
 */
export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const { profile } = useUserProfile();
  const { hasKitchenDisplay, hasDelivery } = useBusinessType();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  // No mostrar en rutas de pantalla completa
  const hiddenRoutes = ['/', '/pos', '/kitchen', '/delivery', '/auth'];
  const isHiddenRoute = hiddenRoutes.some(r =>
    r === '/' ? location.pathname === '/' : location.pathname.startsWith(r)
  );

  // Para kitchen/delivery, mostrar su única opción
  const isKitchen = profile?.role === 'kitchen';
  const isDelivery = profile?.role === 'delivery';

  if (isHiddenRoute && !isKitchen && !isDelivery) return null;

  const handleLogout = async () => {
    setMoreOpen(false);
    invalidateSessionCache();
    await supabase.auth.signOut();
    queryClient.clear();
    navigate('/');
  };

  // Items principales del bottom nav (roles específicos)
  const primaryItems = React.useMemo(() => {
    if (isKitchen) return [{ name: 'Cocina', href: '/kitchen', icon: ChefHat }];
    if (isDelivery) return [{ name: 'Delivery', href: '/delivery', icon: Bike }];

    const isStaff = profile?.role === 'staff' || profile?.role === 'cashier';

    if (isStaff) {
      return [
        { name: 'POS', href: '/pos', icon: ShoppingCart },
        ...(hasDelivery ? [{ name: 'Delivery', href: '/delivery', icon: Bike }] : []),
        { name: 'Clientes', href: '/customers', icon: Users },
      ];
    }

    // Admin/manager: 5 tabs principales
    return [
      { name: 'POS', href: '/pos', icon: ShoppingCart },
      { name: 'Inicio', href: '/dashboard', icon: Home },
      { name: 'Productos', href: '/products', icon: Package },
      { name: 'Contabilidad', href: '/accounting', icon: FileText },
    ];
  }, [profile, hasKitchenDisplay, hasDelivery, isKitchen, isDelivery]);

  // Items del menú "Más"
  const moreItems = React.useMemo(() => {
    const isStaff = profile?.role === 'staff' || profile?.role === 'cashier';
    if (isStaff) return [];

    return [
      ...(hasDelivery ? [{ name: 'Delivery', href: '/delivery', icon: Bike }] : []),
      ...(hasKitchenDisplay ? [{ name: 'Cocina', href: '/kitchen', icon: ChefHat }] : []),
      { name: 'Facturas', href: '/invoices', icon: FileText },
      { name: 'Reportes', href: '/reports', icon: BarChart },
      { name: 'Clientes', href: '/customers', icon: Users },
      { name: 'Empleados', href: '/employees', icon: Users },
      { name: 'Nómina', href: '/payroll', icon: Briefcase },
      { name: 'Mi Cuenta', href: '/subscription', icon: User },
      { name: 'Configuración', href: '/settings', icon: Settings },
      ...(profile?.email?.toLowerCase() === 'haroldrospa@gmail.com'
        ? [{ name: 'Panel Maestro', href: '/admin/super-panel', icon: Database }]
        : []),
    ];
  }, [profile, hasKitchenDisplay, hasDelivery]);

  return (
    <>
      {/* Overlay oscuro cuando el menú "Más" está abierto */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* Sheet "Más" que sube desde abajo */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-40 md:hidden',
          'bg-card/95 backdrop-blur-xl border border-border/50 rounded-t-[32px] shadow-[0_-20px_40px_rgba(0,0,0,0.4)]',
          'transition-transform duration-300 ease-out',
          moreOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        )}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <span className="font-semibold text-base tracking-wide text-foreground">Menú</span>
          <button
            onClick={() => setMoreOpen(false)}
            className="p-2 rounded-full bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-3 gap-4 max-h-[60dvh] overflow-y-auto" style={{ paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>
          {moreItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground hover:bg-secondary/70'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium text-center leading-tight">{item.name}</span>
              </Link>
            );
          })}

          {/* Botón cerrar sesión */}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-xs font-medium">Salir</span>
          </button>
        </div>

        {/* Safe area bottom padding */}
        <div className="h-2 safe-area-bottom" />
      </div>

      {/* Barra de tabs inferior */}
      <nav 
        className="fixed left-4 right-4 z-50 md:hidden"
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-stretch bg-card/95 backdrop-blur-xl border border-border/60 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] rounded-[24px]">
          {primaryItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href ||
              (item.href === '/pos' && location.pathname === '/');
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'relative flex-1 flex flex-col items-center justify-center py-3 min-h-[64px] gap-1 transition-all duration-300',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('h-[22px] w-[22px] transition-transform duration-300', isActive && 'scale-110 drop-shadow-sm')} />
                <span className="text-[10px] font-medium tracking-wide">{item.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute bottom-0 h-1.5 w-12 rounded-t-full bg-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            );
          })}

          {/* Botón "Más" */}
          {moreItems.length > 0 && (
            <button
              onClick={() => setMoreOpen(v => !v)}
              className={cn(
                'relative flex-1 flex flex-col items-center justify-center py-3 min-h-[64px] gap-1 transition-all duration-300',
                moreOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <MoreHorizontal className={cn('h-[22px] w-[22px] transition-transform duration-300', moreOpen && 'scale-110')} />
              <span className="text-[10px] font-medium tracking-wide">Más</span>
              {moreOpen && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute bottom-0 h-1.5 w-12 rounded-t-full bg-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
              )}
            </button>
          )}
        </div>
      </nav>
    </>
  );
};
