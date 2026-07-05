import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LockKeyhole, ArrowRight, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useUserStore } from "@/hooks/useUserStore";

export default function SubscriptionExpired() {
  const navigate = useNavigate();
  const { data: storeData } = useUserStore();
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile) {
          setIsOwner(profile.role === "owner");
        }
      }
    };
    checkRole();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("cobro_last_user_id");
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center selection:bg-emerald-500/30 font-sans">
      <div className="absolute inset-0 z-0 opacity-[0.15]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1.5px, transparent 0)',
        backgroundSize: '32px 32px'
      }} />
      
      <div className="relative z-10 max-w-md w-full bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-red-500/20">
          <LockKeyhole className="w-10 h-10 text-red-500" />
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Suscripción Vencida</h1>
        
        {isOwner ? (
          <>
            <p className="text-slate-400 mb-8 text-sm">
              El plan de {storeData?.store_name || "tu negocio"} ha expirado. Por favor, renueva tu suscripción para seguir utilizando el sistema y acceder a todos tus datos y herramientas.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <Button 
                onClick={() => navigate("/subscription")}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 h-12 rounded-xl transition-all font-medium text-base group"
              >
                Renovar Suscripción
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                onClick={handleLogout}
                variant="outline" 
                className="w-full border-white/10 hover:bg-white/5 text-slate-300 h-12 rounded-xl"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-slate-400 mb-8 text-sm">
              El plan de {storeData?.store_name || "este negocio"} ha expirado. Por favor, comunícate con el administrador o dueño del negocio para que renueve la suscripción.
            </p>
            <Button 
              onClick={handleLogout}
              variant="outline" 
              className="w-full border-white/10 hover:bg-white/5 text-slate-300 h-12 rounded-xl"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
