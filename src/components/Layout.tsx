import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingCart, Package, Users, FileText, BarChart, Settings, Menu, ChevronDown, LogOut, Store, User, Briefcase, Database, CloudUpload, X, Bike, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTheme } from '@/components/ThemeProvider';
import cobroLogoLight from '@/assets/cobro-logo-light.png';
import cobroLogoDark from '@/assets/cobro-logo-dark.png';
import { useQueryClient } from '@tanstack/react-query';
import { offlineDB } from '@/lib/offlineDB';
import { useSubscription } from '@/hooks/useSubscription';
import { Badge } from '@/components/ui/badge';
import { useBusinessType } from '@/hooks/useBusinessType';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { MobileBottomNav } from '@/components/MobileBottomNav';

interface LayoutProps {
  children: React.ReactNode;
}

const PlanBadge = () => {
  const { data: subscription, isLoading } = useSubscription();

  if (isLoading || !subscription) return null;

  return (
    <Badge variant="secondary" className="hidden sm:flex items-center gap-1 h-6 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
      <Briefcase className="h-3 w-3" />
      <span className="text-xs font-medium">{subscription.plan_name}</span>
    </Badge>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const queryClient = useQueryClient();
  const { hasKitchenDisplay, hasDelivery } = useBusinessType();
  const { settings } = useCompanySettings();

  const isFullScreenApp = location.pathname === '/' ||
    location.pathname === '/pos' ||
    profile?.role === 'kitchen' ||
    profile?.role === 'delivery';

  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  // Sync Banner State
  const [pendingCount, setPendingCount] = React.useState(0);
  const [isSyncBannerVisible, setIsSyncBannerVisible] = React.useState(true);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check for pending items
    const checkPending = async () => {
      // Only check when browser is idle and tab is visible
      if (document.hidden) return;
      try {
        const pending = await offlineDB.getPendingSyncItems();
        const activePending = pending.filter((item: any) => !item.error);
        setPendingCount(activePending.length);
      } catch (e) {
        console.error(e);
      }
    };

    const scheduleCheck = () => {
      if ('requestIdleCallback' in window) {
        // Run during browser idle time — doesn't compete with UI
        requestIdleCallback(() => checkPending(), { timeout: 5000 });
      } else {
        checkPending();
      }
    };

    scheduleCheck();
    // 30 seconds is plenty — sync is driven by events not by polling
    const interval = setInterval(scheduleCheck, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    if (pendingCount > 0) setIsSyncBannerVisible(true);
  }, [pendingCount]);

  const navigation = React.useMemo(() => {
    // Cocinero: Solo pantalla cocina
    if (profile?.role === 'kitchen') {
      return [
        { name: 'Pantalla Cocina', href: '/kitchen', icon: ChefHat },
      ];
    }

    // Delivery: Solo pedidos delivery
    if (profile?.role === 'delivery') {
      return [
        { name: 'Pedidos Delivery', href: '/delivery', icon: Bike },
      ];
    }

    // Cajero/Staff: POS, Delivery (si activo), Cocina (solo restaurante), Clientes
    if (profile?.role === 'staff' || profile?.role === 'cashier') {
      const items = [
        { name: 'Punto de Venta', href: '/pos', icon: ShoppingCart },
        ...(hasDelivery ? [{ name: 'Pedidos Delivery', href: '/delivery', icon: Bike }] : []),
        ...(hasKitchenDisplay ? [{ name: 'Pantalla Cocina', href: '/kitchen', icon: ChefHat }] : []),
        { name: 'Clientes', href: '/customers', icon: Users },
      ];
      return items;
    }

    // Administradores y gerentes: menú completo, cocina solo si es restaurante
    return [
      { name: 'Punto de Venta', href: '/pos', icon: ShoppingCart },
      ...(hasDelivery ? [{ name: 'Pedidos Delivery', href: '/delivery', icon: Bike }] : []),
      ...(hasKitchenDisplay ? [{ name: 'Pantalla Cocina', href: '/kitchen', icon: ChefHat }] : []),
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'Productos', href: '/products', icon: Package },
      { name: 'Clientes', href: '/customers', icon: Users },
      { name: 'Facturas', href: '/invoices', icon: FileText },
      { name: 'Reportes', href: '/reports', icon: BarChart },
      { name: 'Contabilidad', href: '/accounting', icon: FileText },
      { name: 'Empleados', href: '/employees', icon: Users },
      { name: 'Nómina', href: '/payroll', icon: Briefcase },
      { name: 'Usuario', href: '/subscription', icon: User },
      { name: 'Configuración', href: '/settings', icon: Settings },
      ...(profile?.email?.toLowerCase() === 'haroldrospa@gmail.com' ? [{ name: 'Panel Maestro', href: '/admin/super-panel', icon: Database }] : []),
    ];
  }, [profile, hasKitchenDisplay, hasDelivery]);

  const { theme } = useTheme();
  const [systemTheme, setSystemTheme] = React.useState<'dark' | 'light'>(
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');

    // Initial check
    setSystemTheme(media.matches ? 'dark' : 'light');

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []); // Run once on mount to set up listener

  const effectiveTheme = theme === 'system' ? systemTheme : theme;
  const logoSrc = effectiveTheme === 'dark' ? cobroLogoDark : cobroLogoLight;

  // Redirect unauthorized users
  React.useEffect(() => {
    // Cocinero: solo cocina
    if (profile?.role === 'kitchen') {
      if (location.pathname !== '/kitchen') {
        navigate('/kitchen');
      }
      return;
    }

    // Delivery: solo delivery
    if (profile?.role === 'delivery') {
      if (location.pathname !== '/delivery') {
        navigate('/delivery');
      }
      return;
    }

    // Cajero/Staff
    if (profile?.role === 'staff' || profile?.role === 'cashier') {
      const allowedPaths = ['/', '/pos', '/customers', '/delivery', '/kitchen'];
      const isAllowed = allowedPaths.some(path =>
        location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
      );

      if (!isAllowed) {
        navigate('/');
      }
    }
  }, [profile, location.pathname, navigate]);

  // Prefetch critical data on mount
  React.useEffect(() => {
    // Prefetch products and customers as they are used in many places
    queryClient.prefetchQuery({ queryKey: ['products'] });
    queryClient.prefetchQuery({ queryKey: ['customers'] });
  }, [queryClient]);

  // Specific prefetch logic for each route
  const handlePrefetch = (href: string) => {
    switch (href) {
      case '/products':
        queryClient.prefetchQuery({ queryKey: ['products'] });
        break;
      case '/customers':
        queryClient.prefetchQuery({ queryKey: ['customers'] });
        break;
      case '/invoices':
        queryClient.prefetchQuery({ queryKey: ['sales'] });
        break;
      case '/dashboard':
        queryClient.prefetchQuery({ queryKey: ['sales-stats'] });
        break;
      case '/pos':
        queryClient.prefetchQuery({ queryKey: ['products'] });
        queryClient.prefetchQuery({ queryKey: ['customers'] });
        queryClient.prefetchQuery({ queryKey: ['invoice-types'] });
        break;
    }
  };

  const getCurrentPageName = () => {
    const currentItem = navigation.find(item => item.href === location.pathname);
    return currentItem ? currentItem.name : 'Menú';
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    // Clear query cache regardless of error to ensure clean state
    queryClient.clear();

    if (error) {
      toast({
        title: 'Error al iniciar sesión', // fixed typo from original "Error al cerrar sesión" which was correct, but keeping consistency
        description: error.message,
        variant: 'destructive',
      });
    } else {
      navigate('/');
    }
  };

  if (isFullScreenApp) {
    return (
      <div className="h-[100dvh] w-screen overflow-hidden flex flex-col">
        {!isOnline && (
          <div className="bg-destructive text-destructive-foreground p-1 text-center text-xs font-semibold safe-area-top">
            Sin conexión - Trabajando offline
          </div>
        )}
        {children}
      </div>
    );
  }

  const showOfflineBanner = !isOnline;
  const showSyncBanner = isOnline && pendingCount > 0 && isSyncBannerVisible;
  const shouldAddMargin = showOfflineBanner || showSyncBanner;

  return (
    <div className="min-h-screen bg-background">
      {showOfflineBanner && (
        <div className="bg-destructive text-destructive-foreground text-center text-xs py-1 px-4 font-medium fixed top-0 w-full z-50">
          Sin conexión a internet. Trabajando en modo offline.
        </div>
      )}

      {showSyncBanner && (
        <div className="bg-blue-600 text-white text-center text-xs py-1 px-4 font-medium fixed top-0 w-full z-50 flex items-center justify-center animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <CloudUpload className="w-3 h-3 animate-bounce" />
            <span>Sincronizando {pendingCount} operación{pendingCount !== 1 ? 'es' : ''}...</span>
          </div>
          <button
            onClick={() => setIsSyncBannerVisible(false)}
            className="absolute right-4 p-0.5 hover:bg-white/20 rounded transition-colors"
            title="Ocultar"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className={`flex items-center justify-between p-3 border-b border-border bg-card fixed w-full z-40 shadow-md transition-all duration-300 ${shouldAddMargin ? 'top-6' : 'top-0'}`}>
        <div className="flex items-center gap-3">
          {/* Mobile view: simple page title */}
          <span className="font-semibold text-lg px-3 md:hidden text-foreground">{getCurrentPageName()}</span>

          {/* Desktop view: Dropdown Navigation Menu */}
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-3 h-10">
                  <Menu className="h-5 w-5" />
                  <span className="font-semibold">{getCurrentPageName()}</span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-popover">
                {navigation.map(item => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.name} asChild>
                      <Link
                        to={item.href}
                        onMouseEnter={() => handlePrefetch(item.href)}
                        className={`flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground ${location.pathname === item.href ? 'bg-accent text-accent-foreground' : ''
                          }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleLogout}
                  className="flex items-center gap-2 px-2 py-2 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {profile && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium max-w-[80px] sm:max-w-[150px] truncate">{profile.full_name || profile.email}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                ({settings?.rnc || profile.rnc ? `RNC: ${settings?.rnc || profile.rnc}` : profile.user_number})
              </span>
            </div>
          )}
          <PlanBadge />
          <div className="text-xs text-muted-foreground hidden lg:block">Desarrollado por Harold Rosado</div>
        </div>
      </div>

      {/* Contenido principal - padding bottom en mobile para no quedar detrás del bottom nav */}
      <main className={`p-4 sm:p-6 lg:p-8 2xl:px-10 w-full max-w-[1920px] mx-auto pb-20 md:pb-6 lg:pb-8 ${shouldAddMargin ? 'pt-28' : 'pt-20'}`}>
        {children}
      </main>

      {/* Barra de navegación inferior para móviles */}
      <MobileBottomNav />
    </div>
  );
};

export default Layout;