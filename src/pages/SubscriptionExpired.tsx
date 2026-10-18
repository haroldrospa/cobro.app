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
  Landmark,
  Copy,
  Check,
  CreditCard
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useUserStore } from "@/hooks/useUserStore";
import cobroLogo from "@/assets/cobro-logo-dark.png";

export default function SubscriptionExpired() {
  const navigate = useNavigate();
  const { data: storeData } = useUserStore();
  const [isOwner, setIsOwner] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          if (profile) {
            setIsOwner(profile.role === "owner" || profile.role === "admin");
          }
        }
      } catch (e) {
        console.error("Error checking role:", e);
      }
    };
    checkRole();
  }, []);

  const handleCopy = (text: string, fieldId: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2500);
    } catch (e) {
      console.error("Error al copiar:", e);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("cobro_last_user_id");
    navigate("/auth");
  };

  const storeName = storeData?.store_name || "Mi Negocio";
  const storeCode = storeData?.store_code ? `(#${storeData.store_code})` : "";
  const whatsappUrl = `https://wa.me/18099175744?text=${encodeURIComponent(
    `¡Hola! Necesito reactivar la suscripción de mi negocio ${storeName} ${storeCode}. Adjunto mi comprobante de pago.`
  )}`;

  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-slate-950 flex flex-col items-center justify-center p-3 sm:p-5 text-center select-none overflow-y-auto overflow-x-hidden font-sans">
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
      <div className="relative z-10 w-full max-w-xl my-auto flex flex-col items-center">
        {/* Brand Logo Header */}
        <div className="mb-4 sm:mb-5 flex items-center justify-center">
          <img 
            src={cobroLogo} 
            alt="Cobro App" 
            className="h-8 sm:h-9 object-contain drop-shadow-md opacity-90 hover:opacity-100 transition-opacity" 
          />
        </div>

        {/* Card */}
        <div className="w-full bg-slate-900/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-black/80 flex flex-col items-center text-center ring-1 ring-white/5 relative overflow-hidden">
          {/* Top highlight border */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />

          {/* Central Icon with Glowing Shield */}
          <div className="relative mb-3">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-tr from-red-500/20 via-red-500/10 to-transparent border border-red-500/30 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/15">
              <LockKeyhole className="w-7 h-7 sm:w-8 sm:h-8 text-red-500" strokeWidth={2.2} />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
            Suscripción Vencida
          </h1>

          {/* Business Info Banner */}
          <div className="w-full bg-slate-950/70 border border-white/5 rounded-2xl p-3 sm:p-3.5 mb-4 text-left flex items-start gap-3">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 shrink-0 border border-red-500/20 mt-0.5">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-sm text-white truncate">
                  {storeName}
                </span>
                {storeData?.store_code && (
                  <span className="font-mono text-[11px] bg-white/10 text-slate-300 px-2 py-0.5 rounded-md shrink-0">
                    #{storeData.store_code}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                El período activo ha finalizado. Realiza tu transferencia a las cuentas oficiales a continuación para reactivar tu acceso inmediatamente. Tus datos permanecen 100% seguros y respaldados.
              </p>
            </div>
          </div>

          {/* SECCIÓN DE MÉTODOS DE PAGO BANCARIOS */}
          <div className="w-full bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-4 text-left mb-4 shadow-lg shadow-emerald-950/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Landmark className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-white leading-tight">
                    Transferencia Bancaria (RD)
                  </h3>
                  <span className="text-[10.5px] text-emerald-400 font-medium">
                    Banreservas • Activación Inmediata
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                DOP (RD$)
              </span>
            </div>

            {/* No. de Cuenta Principal */}
            <div className="bg-slate-900/90 border border-white/10 rounded-xl p-2.5 sm:p-3 mb-2 flex items-center justify-between gap-2 hover:border-emerald-500/40 transition-colors">
              <div className="min-w-0">
                <span className="text-[9.5px] uppercase font-bold text-slate-400 block tracking-wider">
                  Número de Cuenta (Banreservas)
                </span>
                <span className="font-mono text-base sm:text-lg font-black text-white tracking-wider">
                  9601938364
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleCopy("9601938364", "account")}
                className="h-8 px-3 border-emerald-500/30 hover:bg-emerald-500/15 text-emerald-400 font-bold text-xs rounded-lg shrink-0 gap-1.5 transition-all"
              >
                {copiedField === "account" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </Button>
            </div>

            {/* Titular y Cédula */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-2">
              <div className="bg-slate-900/60 border border-white/5 rounded-xl p-2 flex items-center justify-between gap-1.5">
                <div className="min-w-0">
                  <span className="text-[9.5px] text-slate-400 block font-medium">Titular</span>
                  <span className="font-bold text-slate-200 text-xs truncate block">
                    HAROLD M. ROSADO PACHECO
                  </span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => handleCopy("HAROLD MANUEL ROSADO PACHECO", "holder")}
                  className="h-6 w-6 text-slate-400 hover:text-emerald-400 rounded-md shrink-0"
                  title="Copiar Titular"
                >
                  {copiedField === "holder" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>

              <div className="bg-slate-900/60 border border-white/5 rounded-xl p-2 flex items-center justify-between gap-1.5">
                <div className="min-w-0">
                  <span className="text-[9.5px] text-slate-400 block font-medium">Cédula</span>
                  <span className="font-mono font-bold text-slate-200 text-xs truncate block">
                    402-1824665-6
                  </span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => handleCopy("40218246656", "id")}
                  className="h-6 w-6 text-slate-400 hover:text-emerald-400 rounded-md shrink-0"
                  title="Copiar Cédula"
                >
                  {copiedField === "id" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>

            {/* Cuenta ACH Interbancaria */}
            <div className="bg-slate-900/60 border border-white/5 rounded-xl p-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[9.5px] text-slate-400 block font-medium">
                  Cuenta Estándar (ACH / Otros Bancos)
                </span>
                <span className="font-mono font-bold text-slate-300 text-[11px] truncate block">
                  DO36BRRD00000000009601938364
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleCopy("DO36BRRD00000000009601938364", "ach")}
                className="h-6 px-2 text-slate-400 hover:text-emerald-400 font-medium text-[11px] shrink-0 gap-1"
              >
                {copiedField === "ach" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedField === "ach" ? "Copiado" : "Copiar"}</span>
              </Button>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-col gap-2.5 w-full">
            {/* WhatsApp para Enviar Comprobante */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>Enviar Comprobante por WhatsApp (809-917-5744)</span>
            </a>

            {/* Botón Pago con Tarjeta en Línea */}
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/subscription")}
              className="w-full h-10 px-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-slate-300 hover:text-white transition-all text-xs font-semibold gap-2"
            >
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Pagar con Tarjeta o Ver Planes en Línea</span>
              <ArrowRight className="w-3.5 h-3.5 ml-auto text-slate-500" />
            </Button>

            {/* Cerrar Sesión */}
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full border border-transparent hover:border-white/10 hover:bg-white/5 text-slate-400 hover:text-slate-200 h-9 rounded-xl text-xs font-semibold cursor-pointer transition-all"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Cerrar Sesión
            </Button>
          </div>

          {/* Security & Guarantee Note */}
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium w-full">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/80" />
            <span>Datos 100% protegidos y respaldados • Cobro POS Dominicana</span>
          </div>
        </div>
      </div>
    </div>
  );
}
