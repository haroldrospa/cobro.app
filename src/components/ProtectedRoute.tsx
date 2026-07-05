import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSessionSafe, invalidateSessionCache } from '@/lib/authSession';
import { Session } from '@supabase/supabase-js';
import { Loader2, AlertCircle, Settings2, RefreshCcw, ServerCrash, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getDaysRemaining } from '@/lib/utils';
import { LoadingLogo } from '@/components/ui/loading-logo';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  // If we have a cached user ID, we can assume auth optimistically while verifying
  const hasCachedUser = !!localStorage.getItem('cobro_last_user_id');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!hasCachedUser); // skip loading if cached
  const [profileMissing, setProfileMissing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        // Usar getSessionSafe para manejar AbortErrors y llamadas concurrentes
        const session = await getSessionSafe();

        if (!session) {
          if (mounted) {
            // Clear the cached user id so next load won't try to optimistically render
            localStorage.removeItem('cobro_last_user_id');
            setSession(null);
            setLoading(false);
          }
          return;
        }

        // OPTIMIZACIÓN: Consulta única usando limit(1) para evitar errores 406 de PostgREST
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select(`
              is_active, 
              store_id, 
              role,
              stores:store_id (
                  is_active
              )
          `)
          .eq('id', session.user.id)
          .limit(1);

        if (error) {
          console.error("Error checking profile:", error);
        }

        if (!mounted) return;

        const profile = profiles && profiles.length > 0 ? profiles[0] : null;

        if (profile && profile.store_id && profile.stores) {
          // 1. Check User Status
          if (profile.is_active === false) {
            await supabase.auth.signOut();
            localStorage.removeItem('cobro_last_user_id');
            toast({
              variant: "destructive",
              title: "Acceso denegado",
              description: "Tu usuario ha sido desactivado.",
            });
            setSession(null);
            setLoading(false);
            return;
          }

          // 2. Check Store Status (Optimizado)
          // @ts-ignore
          const store = profile.stores;
          if (store && store.is_active === false) {
            navigate('/store-suspended');
            return;
          }

          // 3. Check Onboarding Status
          const isOwner = profile.role === 'owner';
          const isOnboarded = session.user.user_metadata?.onboarding_completed;
          const currentPath = window.location.pathname;
          
          if (isOwner && !isOnboarded && currentPath !== '/onboarding' && currentPath !== '/store-suspended' && currentPath !== '/subscription-expired') {
            navigate('/onboarding', { replace: true });
            return;
          } else if ((isOnboarded || !isOwner) && currentPath === '/onboarding') {
            navigate('/app', { replace: true });
            return;
          }

          // 4. Check Subscription Status
          const { data: subscription } = await supabase
            .from('company_subscriptions')
            .select('end_date')
            .eq('company_id', profile.store_id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (subscription?.end_date) {
            const daysRemaining = getDaysRemaining(subscription.end_date);
            if (daysRemaining <= 0 && currentPath !== '/subscription' && currentPath !== '/subscription-expired' && currentPath !== '/store-suspended') {
              navigate('/subscription-expired', { replace: true });
              return;
            } else if (daysRemaining > 0 && currentPath === '/subscription-expired') {
              navigate('/app', { replace: true });
              return;
            }
          }
          
          setSession(session);
          setProfileMissing(false);
        } else {
          // User logged in but no profile found or store is missing — try to auto-repair first
          console.warn("User has no profile record or store is missing. Attempting auto-repair...");
          try {
            const { data: repaired, error: repairError } = await supabase.rpc('auto_repair_profile');
            if (repaired === true && !repairError) {
              console.log("Profile auto-repaired successfully. Retrying auth check...");
              // Retry the profile check after repair
              const { data: retriedProfiles } = await supabase
                .from('profiles')
                .select('is_active, store_id, role, stores:store_id (is_active)')
                .eq('id', session.user.id)
                .limit(1);
              const retriedProfile = retriedProfiles && retriedProfiles.length > 0 ? retriedProfiles[0] : null;
              if (retriedProfile && retriedProfile.store_id && retriedProfile.stores) {
                localStorage.setItem('cobro_last_user_id', session.user.id);
                
                // Check onboarding for repaired profiles too
                const isOwnerRetried = retriedProfile.role === 'owner';
                const isOnboarded = session.user.user_metadata?.onboarding_completed;
                const currentPath = window.location.pathname;
                
                if (isOwnerRetried && !isOnboarded && currentPath !== '/onboarding' && currentPath !== '/store-suspended' && currentPath !== '/subscription-expired') {
                  navigate('/onboarding', { replace: true });
                  return;
                } else if ((isOnboarded || !isOwnerRetried) && currentPath === '/onboarding') {
                  navigate('/app', { replace: true });
                  return;
                }

                // 4. Check Subscription Status for retried profile
                const { data: retriedSub } = await supabase
                  .from('company_subscriptions')
                  .select('end_date')
                  .eq('company_id', retriedProfile.store_id)
                  .eq('status', 'active')
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (retriedSub?.end_date) {
                  const daysRemaining = getDaysRemaining(retriedSub.end_date);
                  if (daysRemaining <= 0 && currentPath !== '/subscription' && currentPath !== '/subscription-expired' && currentPath !== '/store-suspended') {
                    navigate('/subscription-expired', { replace: true });
                    return;
                  } else if (daysRemaining > 0 && currentPath === '/subscription-expired') {
                    navigate('/app', { replace: true });
                    return;
                  }
                }

                setSession(session);
                setProfileMissing(false);
                setLoading(false);
                return;
              }
            }
          } catch (repairErr) {
            console.error("auto_repair_profile failed:", repairErr);
          }
          // Only show missing screen if repair failed too
          if (!hasCachedUser) setProfileMissing(true);
        }
      } catch (err) {
        console.error("Exception in checkAuth:", err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        if (mounted) {
          invalidateSessionCache(); // Limpiar cache de sesión al cerrar sesión
          localStorage.removeItem('cobro_last_user_id');
          setSession(null);
          setProfileMissing(false);
          setLoading(false);
        }
      } else if (session) {
        if (event === 'SIGNED_IN') {
          invalidateSessionCache(); // Forzar re-fetch al iniciar sesión
          checkAuth();
        } else {
          if (mounted) setSession(session);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]); 

  // Show full-screen loader ONLY for first-ever login (no cached user)
  // Returning users see their content immediately while auth validates in background
  if (loading && !hasCachedUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingLogo text="Verificando sesión..." />
      </div>
    );
  }

  if (profileMissing) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center bg-zinc-950">
        <div className="max-w-2xl w-full p-8 bg-zinc-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl animate-fade-in relative overflow-hidden">
          {/* Top accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-green-500" />
          
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="shrink-0 w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto md:mx-0 mt-2">
              <ServerCrash className="w-10 h-10 text-emerald-500" />
            </div>
            
            <div className="flex-1 text-left">
              <h2 className="text-3xl font-black mb-3 text-white tracking-tight text-center md:text-left">Casi Listo...</h2>
              <p className="text-zinc-400 text-base mb-6 leading-relaxed text-center md:text-left">
                Tu cuenta existe pero <strong className="text-emerald-400 font-bold">no se ha podido sincronizar con el servidor</strong>. Esto ocurre generalmente porque <strong className="text-emerald-400 font-bold">no hay internet</strong> o tu conexión es muy inestable en este momento.
              </p>
              
              <div className="bg-zinc-950/50 border border-white/5 rounded-2xl p-5 mb-8">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">?</span>
                  ¿Cómo solucionarlo?
                </h3>
                <ul className="text-sm text-zinc-400 space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="mt-1 min-w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    </div>
                    <span><strong>Solución: Actualizar la página.</strong> Haz clic en el botón "Refrescar" de abajo para reintentar la conexión y cargar tu panel de control.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 min-w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    </div>
                    <span><strong>Soporte Técnico:</strong> Si el problema persiste, contacta a nuestro equipo de soporte técnico directamente para habilitar tu cuenta.</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                    className="flex-1 h-14 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-black text-base rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    onClick={() => window.open('https://wa.me/18099175744', '_blank')}
                >
                  <Phone className="mr-2 h-5 w-5" />
                  Contactar a Soporte
                </Button>
                
                <Button 
                    variant="outline" 
                    className="flex-1 sm:flex-none h-14 px-8 border-white/10 bg-transparent hover:bg-white/5 text-zinc-300 font-bold rounded-xl transition-all" 
                    onClick={() => window.location.reload()}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Refrescar
                </Button>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <Button 
                    variant="ghost" 
                    className="text-zinc-500 hover:text-white" 
                    onClick={() => supabase.auth.signOut()}
                >
                  Salir y Usar Otra Cuenta
                </Button>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">
                  REF: {session?.user?.id?.substring(0, 8) || 'UNKNOWN'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Optimistic render: if cached user exists, show children while session validates
  if (hasCachedUser && !profileMissing) {
    return <>{children}</>;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
