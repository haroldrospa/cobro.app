import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  LockKeyhole, 
  ArrowRight, 
  LogOut, 
  MessageCircle, 
  Building2, 
  ShieldCheck, 
  Sparkles,
  Phone
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useUserStore } from "@/hooks/useUserStore";
import cobroLogo from "@/assets/cobro-logo-dark.png";

export default function SubscriptionExpired() {
  const navigate = useNavigate();
  const { data: storeData } = useUserStore();
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      try {
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
      } catch (e) {
        console.error("Error checking role:", e);
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
    <div className="fixed inset-0 h-[100dvh] w-full bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none overflow-y-auto overflow-x-hidden font-sans">
      {/* Background Texture & Glow Effects */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
          backgroundSize: '28px 28px'
        }} 
      />
      
      {/* Ambient Radial Lights */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[360px] bg-red-600/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[320px] h-[260px] bg-emerald-500/5 rounded-full blur-[110px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-lg my-auto flex flex-col items-center">
        {/* Brand Logo Header */}
        <div className="mb-6 flex items-center justify-center">
          <img 
            src={cobroLogo} 
            alt="Cobro App" 
            className="h-9 sm:h-10 object-contain drop-shadow-md opacity-90 hover:opacity-100 transition-opacity" 
          />
        </div>

        {/* Card */}
        <div className="w-full bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 flex flex-col items-center text-center ring-1 ring-white/5 relative overflow-hidden">
          {/* Top highlight border */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold mb-4 tracking-wide">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>Período de Facturación Vencido</span>
          </div>

          {/* Central Icon with Glowing Shield */}
          <div className="relative mb-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr from-red-500/20 via-red-500/10 to-transparent border border-red-500/30 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/15">
              <LockKeyhole className="w-8 h-8 sm:w-10 sm:h-10 text-red-500" strokeWidth={2.2} />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            Suscripción Vencida
          </h1>

          {/* Business Info Banner */}
          <div className="w-full bg-slate-950/70 border border-white/5 rounded-2xl p-4 my-4 text-left flex items-start gap-3">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 shrink-0 border border-red-500/20 mt-0.5">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-sm sm:text-base text-white truncate">
                  {storeData?.store_name || "Tu Negocio"}
                </span>
                {storeData?.store_code && (
                  <span className="font-mono text-[11px] bg-white/10 text-slate-300 px-2 py-0.5 rounded-md shrink-0">
                    #{storeData.store_code}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isOwner
                  ? `El plan para "${storeData?.store_name || "tu negocio"}" ha finalizado su período activo. Todo tu historial de ventas, inventario y clientes permanecen 100% seguros y respaldados.`
                  : `El plan para "${storeData?.store_name || "este negocio"}" ha expirado. Por favor, comunícate con el dueño o administrador del negocio para que reactive la suscripción.`}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 w-full mt-1">
            {isOwner ? (
              <>
                <Button
                  onClick={() => navigate("/subscription")}
                  className="w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold h-12 rounded-xl shadow-lg shadow-emerald-500/25 transition-all text-sm sm:text-base flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  Renovar Suscripción Ahora
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Button>

                <a
                  href="https://wa.me/18099175744?text=Hola,%20necesito%20ayuda%20para%20renovar%20la%20suscripci%C3%B3n%20de%20mi%20negocio%20en%20Cobro%20App"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-slate-300 hover:text-white transition-all text-xs sm:text-sm font-semibold"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  Soporte y Pagos por WhatsApp (809-917-5744)
                </a>
              </>
            ) : (
              <a
                href="https://wa.me/18099175744?text=Hola,%20el%20plan%20de%20mi%20negocio%20ha%20expirado%20y%20necesito%20informaci%C3%B3n"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-slate-300 hover:text-white transition-all text-xs sm:text-sm font-semibold"
              >
                <Phone className="w-4 h-4 text-emerald-400" />
                Contactar a Soporte (809-917-5744)
              </a>
            )}

            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full border border-transparent hover:border-white/10 hover:bg-white/5 text-slate-400 hover:text-slate-200 h-10 rounded-xl text-xs font-semibold cursor-pointer transition-all"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Cerrar Sesión
            </Button>
          </div>

          {/* Security & Guarantee Note */}
          <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium w-full">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/80" />
            <span>Datos 100% protegidos y respaldados • Cobro POS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
