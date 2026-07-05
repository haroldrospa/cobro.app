import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useMemo } from "react";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { LoadingLogo } from "@/components/ui/loading-logo";
import { supabase } from "@/integrations/supabase/client";
import { shopperSupabase } from "@/integrations/supabase/shopperClient";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRedirect from "./components/RoleRedirect";
import { ScrollUnlocker } from "./components/ScrollUnlocker";
import { MasterDataProvider } from "@/providers/MasterDataProvider";
import { initializePaddle } from "@paddle/paddle-js";

// Lazy load components for code splitting
const Layout = lazy(() => import("./components/Layout"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const POS = lazy(() => import("./components/POS"));
const Products = lazy(() => import("./components/Products"));
const Customers = lazy(() => import("./components/Customers"));
const Invoices = lazy(() => import("./components/Invoices"));
const Reports = lazy(() => import("./components/Reports"));
const Settings = lazy(() => import("./components/Settings"));
const Employees = lazy(() => import("./components/Employees"));
const Auth = lazy(() => import("./pages/Auth"));
const MiTienda = lazy(() => import("./pages/MiTienda"));
const Accounting = lazy(() => import("./components/Accounting"));
const Payroll = lazy(() => import("./components/Payroll"));
const Tienda = lazy(() => import("./pages/Tienda"));
const BuscarTienda = lazy(() => import("./pages/BuscarTienda"));
const NotFound = lazy(() => import("./pages/NotFound"));
const UserSubscription = lazy(() => import("./pages/UserSubscription"));
const SubscriptionExpired = lazy(() => import("./pages/SubscriptionExpired"));
const SuperAdmin = lazy(() => import("./pages/admin/SuperAdmin"));
const StoreSuspended = lazy(() => import("./pages/StoreSuspended"));
const Delivery = lazy(() => import("./components/Delivery"));
const Kitchen = lazy(() => import("./components/KitchenDisplay"));
const Landing = lazy(() => import("./pages/Landing"));
const Onboarding = lazy(() => import("./pages/Onboarding"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <LoadingLogo text="Cargando..." />
  </div>
);

const App = () => {
  // Memoize QueryClient to prevent recreation on re-renders
  const queryClient = useMemo(() => new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'offlineFirst',
        gcTime: 1000 * 60 * 60 * 4,   // 4 hours — free RAM on mobile
        staleTime: 1000 * 60 * 5,     // 5 min fresh
        refetchOnWindowFocus: false,
        refetchOnReconnect: 'always',
        refetchOnMount: false,         // CRITICAL: keep false — true causes query storms on Dashboard
        retry: 1,
        retryDelay: 1500,
        throwOnError: false,
      },
      mutations: {
        networkMode: 'offlineFirst',
        retry: 0,
      }
    },
  }), []);

  // Global listener for Merchant (App) session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        // Debounce or only clear if there's actual data
        console.log('🚪 Global: User signed out, clearing cache...');
        queryClient.clear();
        Object.keys(localStorage).forEach(key => {
          if (
            key === 'cobro_last_user_id' ||
            key.includes('cobro_user_store_cache') ||
            key.includes('cobro_user_profile_cache') ||
            key.startsWith('posSettings_')
          ) {
            localStorage.removeItem(key);
          }
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  // Global listener for Shopper (Store) session
  useEffect(() => {
    const { data: { subscription } } = shopperSupabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        // Clear shopper specific data
        queryClient.invalidateQueries({ queryKey: ['shopper-orders'] });
        localStorage.removeItem('shopper_profile');
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  // Initialize Paddle globally
  useEffect(() => {
    initializePaddle({
      environment: 'production',
      token: import.meta.env.VITE_PADDLE_CLIENT_TOKEN || 'test_token',
    }).then(
      (paddleInstance) => {
        if (paddleInstance) {
          console.log("✅ Paddle initialized successfully");
        }
      }
    ).catch(err => console.error("❌ Failed to initialize Paddle", err));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <MasterDataProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollUnlocker />
          <OfflineIndicator />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes - no auth required */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/store-suspended" element={<StoreSuspended />} />
              <Route path="/tienda/:slug" element={<Tienda />} />
              <Route path="/buscar-tienda" element={<BuscarTienda />} />

              {/* Full-screen protected routes - NO Layout header */}
              <Route
                path="/kitchen"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <Kitchen />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/delivery"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <Delivery />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <Onboarding />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Protected routes - auth required, with Layout */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Suspense fallback={<PageLoader />}>
                        <Routes>
                          <Route path="/app" element={<RoleRedirect />} />
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/pos" element={<POS />} />
                          <Route path="/products" element={<Products />} />
                          <Route path="/customers" element={<Customers />} />
                          <Route path="/invoices" element={<Invoices />} />
                          <Route path="/reports" element={<Reports />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/employees" element={<Employees />} />
                          <Route path="/mi-tienda" element={<MiTienda />} />
                          <Route path="/accounting" element={<Accounting />} />
                          <Route path="/payroll" element={<Payroll />} />
                          <Route path="/subscription" element={<UserSubscription />} />
                          <Route path="/subscription-expired" element={<SubscriptionExpired />} />
                          <Route path="/admin/super-panel" element={<SuperAdmin />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </BrowserRouter>
        </MasterDataProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
