import React from 'react';
import { Link, useLocation } from 'react-router-dom';
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
      { name: 'Clientes', href: '/customers', icon: Users },
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
      { name: 'Contabilidad', href: '/accounting', icon: FileText },
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
          'fixed bottom-16 left-0 right-0 z-50 md:hidden',
          'bg-card border border-border rounded-t-2xl shadow-2xl',
          'transition-transform duration-300 ease-out',
          moreOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        )}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <span className="font-semibold text-sm text-foreground">Menú</span>
          <button
            onClick={() => setMoreOpen(false)}
            className="p-1.5 rounded-full hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 grid grid-cols-3 gap-3 max-h-[60dvh] overflow-y-auto">
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border">
        <div className="flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {primaryItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href ||
              (item.href === '/pos' && location.pathname === '/');
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5 transition-transform', isActive && 'scale-110')} />
                <span className="text-[10px] font-medium">{item.name}</span>
                {isActive && (
                  <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}

          {/* Botón "Más" */}
          {moreItems.length > 0 && (
            <button
              onClick={() => setMoreOpen(v => !v)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] transition-colors',
                moreOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <MoreHorizontal className={cn('h-5 w-5', moreOpen && 'scale-110')} />
              <span className="text-[10px] font-medium">Más</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
};
