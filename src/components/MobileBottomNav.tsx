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
} from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useBusinessType } from '@/hooks/useBusinessType';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { invalidateSessionCache } from '@/lib/authSession';

import { triggerHaptic } from '@/lib/haptics';

/**
 * Barra de navegación inferior para mobile.
 * Solo se muestra en pantallas < md (768px).
 * Muestra POS, Dashboard, Productos, Clientes y "Más" (sheet lateral).
 */
export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const { profile } = useUserProfile();
  const { isPlatformAdmin } = usePlatformAdmin();
  const { hasKitchenDisplay, hasDelivery } = useBusinessType();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  // No mostrar en rutas de pantalla completa o panel maestro
  const hiddenRoutes = ['/', '/pos', '/kitchen', '/delivery', '/auth', '/admin'];
  const isHiddenRoute = hiddenRoutes.some(r =>
    r === '/' ? location.pathname === '/' : location.pathname.startsWith(r)
  );

  // Para kitchen/delivery, mostrar su única opción
  const isKitchen = profile?.role === 'kitchen';
  const isDelivery = profile?.role === 'delivery';

  if (isHiddenRoute && !isKitchen && !isDelivery) return null;

  const handleLogout = async () => {
    triggerHaptic('medium');
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
    const isAccountant = profile?.role === 'accountant';

    if (isAccountant) {
      return [
        { name: 'Contabilidad', href: '/accounting', icon: FileText },
        { name: 'Reportes', href: '/reports', icon: BarChart },
        { name: 'Facturas', href: '/invoices', icon: FileText },
      ];
    }

    if (isStaff) {
      return [
        { name: 'POS', href: '/pos', icon: ShoppingCart },
        ...(hasDelivery ? [{ name: 'Delivery', href: '/delivery', icon: Bike }] : []),
        { name: 'Clientes', href: '/customers', icon: Users },
      ];
    }

    // Admin/manager: 4 tabs principales
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
    const isAccountant = profile?.role === 'accountant';
    if (isStaff || isAccountant) return [];

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
      ...(isPlatformAdmin
        ? [{ name: 'Panel Maestro', href: '/admin/super-panel', icon: Database }]
        : []),
    ];
  }, [profile, hasKitchenDisplay, hasDelivery, isPlatformAdmin]);

  return (
    <>
      {/* Overlay oscuro cuando el menú "Más" está abierto — se detiene arriba de la
          barra de pestañas para que esta siga visible y se pueda tocar (ej. "POS")
          sin tener que cerrar el menú primero. */}
      {moreOpen && (
        <div
          className="fixed inset-x-0 top-0 z-50 bg-black/60 backdrop-blur-xs md:hidden"
          style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }}
          onClick={() => {
            triggerHaptic('light');
            setMoreOpen(false);
          }}
        />
      )}

      {/* Sheet "Más" — flota arriba de la barra de pestañas (no la tapa) */}
      <div
        className={cn(
          'fixed left-4 right-4 z-50 md:hidden',
          'bg-background border border-border/80 rounded-[2rem] shadow-[0_-20px_40px_rgba(0,0,0,0.5)]',
          'transition-transform duration-300 ease-out origin-bottom',
          moreOpen ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-95 opacity-0 pointer-events-none'
        )}
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-b border-border/40">
          <span className="font-bold text-base tracking-wide text-foreground">Menú</span>
          <button
            onClick={() => {
              triggerHaptic('light');
              setMoreOpen(false);
            }}
            className="p-2 rounded-full bg-muted/60 hover:bg-muted active:scale-95 transition-all"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Sin alto fijo por tarjeta — se compactan solas para que quepan
            hasta 10 opciones sin recortar nada en pantallas chicas. El
            max-h/overflow es solo un seguro para no salirse arriba en
            casos extremos (ej. landscape muy bajo), no el modo normal. */}
        <div className="p-4 max-h-[75dvh] overflow-y-auto no-scrollbar">
        <div className="grid grid-cols-3 gap-2.5">
          {moreItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => {
                  triggerHaptic('light');
                  setMoreOpen(false);
                }}
                className={cn(
                  'flex flex-col items-center justify-center gap-1.5 py-3 px-1.5 rounded-[1.25rem] border transition-all duration-200 active:scale-[0.93] group select-none',
                  isActive
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                    : 'bg-muted/40 hover:bg-muted/60 border-border/40 text-muted-foreground hover:text-foreground shadow-md shadow-black/5'
                )}
              >
                <Icon className={cn("h-5 w-5 transition-colors duration-200", isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
                <span className={cn("text-[10.5px] font-bold text-center leading-tight transition-colors duration-200", isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground")}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>

          {/* Botón cerrar sesión — separado del grid, ancho completo */}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2.5 w-full mt-3 py-3 rounded-[1.25rem] border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all duration-200 active:scale-[0.98] group select-none"
          >
            <LogOut className="h-5 w-5 text-rose-400 group-hover:text-rose-300 transition-colors" />
            <span className="text-sm font-bold text-rose-400 group-hover:text-rose-300 transition-colors">
              Salir
            </span>
          </button>
        </div>
        <div className="h-3" />
      </div>

      {/* Barra de tabs inferior */}
      <nav 
        className="fixed left-4 right-4 z-40 md:hidden select-none"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-stretch bg-card/95 border border-border/80 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.35)] rounded-[24px] overflow-hidden">
          {primaryItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href ||
              (item.href === '/pos' && location.pathname === '/');
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => {
                  triggerHaptic('light');
                  setMoreOpen(false);
                }}
                className={cn(
                  'relative flex-1 flex flex-col items-center justify-center py-3 min-h-[64px] gap-1 transition-all duration-200 active:scale-[0.92]',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('h-[22px] w-[22px] transition-transform duration-200', isActive && 'scale-110 drop-shadow-xs')} />
                <span className="text-[10px] font-bold tracking-tight">{item.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute bottom-0 h-1.5 w-10 rounded-t-full bg-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            );
          })}

          {/* Botón "Más" */}
          {moreItems.length > 0 && (
            <button
              onClick={() => {
                triggerHaptic('light');
                setMoreOpen(v => !v);
              }}
              className={cn(
                'relative flex-1 flex flex-col items-center justify-center py-3 min-h-[64px] gap-1 transition-all duration-200 active:scale-[0.92]',
                moreOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <MoreHorizontal className={cn('h-[22px] w-[22px] transition-transform duration-200', moreOpen && 'scale-110')} />
              <span className="text-[10px] font-bold tracking-tight">Más</span>
              {moreOpen && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute bottom-0 h-1.5 w-10 rounded-t-full bg-primary"
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
