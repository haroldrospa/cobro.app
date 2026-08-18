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

import { triggerHaptic } from '@/lib/haptics';

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

  // No mostrar en rutas de pantalla completa o panel maestro
  const isMasterAuth = sessionStorage.getItem('cobroapp_master_auth') === 'true';
  const hiddenRoutes = ['/', '/pos', '/kitchen', '/delivery', '/auth', '/admin'];
  const isHiddenRoute = hiddenRoutes.some(r =>
    r === '/' ? location.pathname === '/' : location.pathname.startsWith(r)
  ) || isMasterAuth;

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
      ...(['haroldrospa@gmail.com', 'cobroapp@cobroapp.com'].includes(profile?.email?.toLowerCase() || '') || profile?.role === 'admin' || profile?.role === 'owner'
        ? [{ name: 'Panel Maestro', href: '/admin/super-panel', icon: Database }]
        : []),
    ];
  }, [profile, hasKitchenDisplay, hasDelivery]);

  return (
    <>
      {/* Overlay oscuro cuando el menú "Más" está abierto */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => {
            triggerHaptic('light');
            setMoreOpen(false);
          }}
        />
      )}

      {/* Sheet "Más" que sube desde abajo */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-40 md:hidden',
          'bg-background border-t border-border/80 rounded-t-[2.5rem] shadow-[0_-20px_40px_rgba(0,0,0,0.5)]',
          'transition-transform duration-300 ease-out',
          moreOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        )}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
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

        <div className="p-5 grid grid-cols-3 gap-4 max-h-[60dvh] overflow-y-auto" style={{ paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>
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
                  'flex flex-col items-center justify-center gap-2.5 p-4 rounded-[1.25rem] border transition-all duration-200 active:scale-[0.93] group h-22 select-none',
                  isActive
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                    : 'bg-muted/40 hover:bg-muted/60 border-border/40 text-muted-foreground hover:text-foreground shadow-md shadow-black/5'
                )}
              >
                <Icon className={cn("h-5.5 w-5.5 transition-colors duration-200", isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
                <span className={cn("text-[11px] font-bold text-center leading-tight transition-colors duration-200", isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground")}>
                  {item.name}
                </span>
              </Link>
            );
          })}

          {/* Botón cerrar sesión */}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-[1.25rem] border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all duration-200 active:scale-[0.93] group h-22 select-none"
          >
            <LogOut className="h-5.5 w-5.5 text-rose-400 group-hover:text-rose-300 transition-colors" />
            <span className="text-[11px] font-bold text-center leading-tight text-rose-400 group-hover:text-rose-300 transition-colors">
              Salir
            </span>
          </button>
        </div>

        {/* Safe area bottom padding */}
        <div className="h-2 safe-area-bottom" />
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
                onClick={() => triggerHaptic('light')}
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
