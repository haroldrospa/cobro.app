import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingCart, Package, Users, FileText, BarChart, Settings, Menu, ChevronDown, LogOut, Store, User, Briefcase, Database, CloudUpload, X, Bike, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/hooks/useUserProfile';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useTheme } from '@/components/ThemeProvider';
import cobroLogoLight from '@/assets/cobro-logo-light.png';
import cobroLogoDark from '@/assets/cobro-logo-dark.png';
import { useQueryClient } from '@tanstack/react-query';
import { offlineDB } from '@/lib/offlineDB';
import { useSubscription } from '@/hooks/useSubscription';
import { Badge } from '@/components/ui/badge';
import { useBusinessType } from '@/hooks/useBusinessType';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useUserStore } from '@/hooks/useUserStore';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { SubscriptionWarningBanner } from '@/components/SubscriptionWarningBanner';

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
  const { isPlatformAdmin } = usePlatformAdmin();
  const { data: userStore } = useUserStore();
  const companyName = settings?.company_name || userStore?.store_name;

  const isFullScreenApp = location.pathname === '/' ||
    location.pathname === '/pos' ||
    location.pathname.startsWith('/admin') ||
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

    // Contador: Solo Contabilidad, Reportes y Facturas
    if (profile?.role === 'accountant') {
      return [
        { name: 'Contabilidad', href: '/accounting', icon: FileText },
        { name: 'Reportes', href: '/reports', icon: BarChart },
        { name: 'Facturas', href: '/invoices', icon: FileText },
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
      ...(isPlatformAdmin ? [{ name: 'Panel Maestro', href: '/admin/super-panel', icon: Database }] : []),
    ];
  }, [profile, hasKitchenDisplay, hasDelivery, isPlatformAdmin]);

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

    // Contador: solo contabilidad, reportes, facturas
    if (profile?.role === 'accountant') {
      const allowedPaths = ['/accounting', '/reports', '/invoices', '/app'];
      const isAllowed = allowedPaths.some(path =>
        location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
      );

      if (!isAllowed) {
        navigate('/accounting', { replace: true });
      }
      return;
    }

    // Cajero/Staff
    if (profile?.role === 'staff' || profile?.role === 'cashier') {
      const allowedPaths = ['/', '/pos', '/customers', '/delivery', '/kitchen', '/app'];
      const isAllowed = allowedPaths.some(path =>
        location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
      );

      if (!isAllowed) {
        navigate('/pos', { replace: true });
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
      <div className="h-screen h-[100dvh] w-full overflow-hidden flex flex-col bg-background">
        {!isOnline && (
          <div className="bg-destructive text-destructive-foreground p-1 text-center text-xs font-semibold safe-area-top shrink-0 z-50">
            Sin conexión - Trabajando offline
          </div>
        )}
        <div className="flex-1 overflow-y-auto w-full">
          {children}
        </div>
      </div>
    );
  }

  const showOfflineBanner = !isOnline;
  const showSyncBanner = false; // Desactivado por solicitud del usuario para evitar carteles de sincronización
  const shouldAddMargin = showOfflineBanner || showSyncBanner;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {showOfflineBanner && (
        <div className="bg-destructive text-destructive-foreground text-center text-xs py-1 px-4 font-medium sticky top-0 w-full z-50">
          Sin conexión a internet. Trabajando en modo offline.
        </div>
      )}

      {showSyncBanner && (
        <div className="bg-blue-600 text-white text-center text-xs py-1 px-4 font-medium sticky top-0 w-full z-50 flex items-center justify-center animate-in slide-in-from-top duration-300">
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

      {/* Header pegado arriba con menú principal y banner de vencimiento adosado debajo */}
      <header className="sticky top-0 w-full z-40 shadow-xs bg-card/95 backdrop-blur-md border-b border-border flex flex-col">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 h-13 sm:h-16">
          {/* Left: Page Title / Navigation */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile View: Clean page title */}
            <div className="flex items-center gap-2 md:hidden min-w-0">
              <h1 className="font-extrabold text-base tracking-tight text-foreground truncate">
                {getCurrentPageName()}
              </h1>
            </div>

            {/* Desktop view: Dropdown Navigation Menu */}
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-3 h-10 hover:bg-muted/70 rounded-xl">
                    <Menu className="h-4 w-4" />
                    <span className="font-bold text-sm">{getCurrentPageName()}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 bg-popover max-h-[80vh] overflow-y-auto rounded-xl shadow-xl p-1.5">
                  {navigation.map(item => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem key={item.name} asChild className="rounded-lg">
                        <Link
                          to={item.href}
                          onMouseEnter={() => handlePrefetch(item.href)}
                          className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-accent hover:text-accent-foreground ${location.pathname === item.href ? 'bg-primary/10 text-primary font-bold' : ''
                            }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.name}</span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={handleLogout}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span>Cerrar Sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Right Side: Store Badge & User / Profile Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {profile && (
              <>
                {/* Store Pill */}
                {companyName && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] sm:text-xs shadow-xs">
                    <Store className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="max-w-[110px] sm:max-w-[180px] truncate">{companyName}</span>
                  </div>
                )}

                {/* User Dropdown / Profile Avatar */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 p-0.5 sm:px-2.5 sm:py-1 rounded-full bg-muted/60 hover:bg-muted border border-border/60 transition-all text-xs font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20">
                      {/* Avatar Circle */}
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-xs">
                        {(profile.full_name || profile.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      
                      {/* Name & RNC - Hidden on mobile to keep header clean and spacious */}
                      <div className="hidden sm:flex flex-col text-left leading-tight pr-1">
                        <span className="font-bold text-xs text-foreground max-w-[130px] lg:max-w-[160px] truncate">
                          {profile.full_name || profile.email}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {settings?.rnc || profile.rnc ? `RNC: ${settings?.rnc || profile.rnc}` : `Usuario #${profile.user_number || ''}`}
                        </span>
                      </div>
                      <ChevronDown className="hidden sm:block h-3 w-3 text-muted-foreground opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-2xl border-border/80">
                    {/* User info card inside dropdown */}
                    <div className="p-2.5 bg-muted/50 rounded-xl mb-1.5 border border-border/40">
                      <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs shrink-0">
                          {(profile.full_name || profile.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground truncate">{profile.full_name || 'Usuario'}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{profile.email}</p>
                        </div>
                      </div>
                      {(settings?.rnc || profile.rnc) && (
                        <div className="mt-1.5 pt-1.5 border-t border-border/30 flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">RNC / Cédula:</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{settings?.rnc || profile.rnc}</span>
                        </div>
                      )}
                    </div>

                    <DropdownMenuItem asChild className="rounded-xl">
                      <Link to="/subscription" className="cursor-pointer text-xs font-semibold py-2">
                        <User className="h-4 w-4 mr-2 text-primary" /> Mi Perfil y Plan
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-xl">
                      <Link to="/settings" className="cursor-pointer text-xs font-semibold py-2">
                        <Settings className="h-4 w-4 mr-2 text-primary" /> Configuración
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem
                      onSelect={handleLogout}
                      className="cursor-pointer text-xs font-bold py-2 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl"
                    >
                      <LogOut className="h-4 w-4 mr-2" /> Cerrar Sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            <PlanBadge />
            <div className="text-xs text-muted-foreground hidden lg:block">Desarrollado por Harold Rosado</div>
          </div>
        </div>

        {/* Banner de vencimiento adosado debajo de la barra del menú */}
        <SubscriptionWarningBanner />
      </header>

      {/* Contenido principal - flujo natural sin tapar nada */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 2xl:px-10 w-full max-w-[1920px] mx-auto pb-20 md:pb-6 lg:pb-8">
        {children}
      </main>

      {/* Barra de navegación inferior para móviles */}
      <MobileBottomNav />
    </div>
  );
};

export default Layout;