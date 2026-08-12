import { useSubscription } from "@/hooks/useSubscription";
import { AlertTriangle, CreditCard, Clock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { getDaysRemaining } from "@/lib/utils";

export function SubscriptionWarningBanner() {
  const { data: subscription, isLoading } = useSubscription();
  const navigate = useNavigate();

  if (isLoading || !subscription) return null;

  // Si no hay end_date (ej. plan ilimitado/custom), no se muestra banner
  if (!subscription.end_date) return null;

  const daysRemaining = getDaysRemaining(subscription.end_date);
  const formattedEndDate = new Date(subscription.end_date).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const isExpired = daysRemaining <= 0 || subscription.status === 'expired';

  // Mostrar el banner si le quedan 15 días o menos, o si ya venció
  if (daysRemaining > 15 && !isExpired) return null;

  return (
    <div
      className={`w-full text-white px-4 py-2.5 shadow-lg flex items-center justify-between z-50 transition-all ${
        isExpired
          ? "bg-gradient-to-r from-red-600 via-rose-600 to-red-700 border-b border-red-500/40"
          : "bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 border-b border-amber-500/40"
      }`}
    >
      <div className="flex items-center gap-3 max-w-[1920px] mx-auto w-full">
        <div className={`p-1.5 rounded-lg shrink-0 ${isExpired ? "bg-red-800/60" : "bg-amber-800/60"}`}>
          {isExpired ? (
            <AlertTriangle className="w-5 h-5 text-red-200 animate-bounce" />
          ) : (
            <Clock className="w-5 h-5 text-amber-200" />
          )}
        </div>

        <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-3 text-sm">
          {isExpired ? (
            <span className="font-bold tracking-wide text-white">
              🚨 Suscripción Vencida: La fecha límite de pago fue el <span className="underline font-mono">{formattedEndDate}</span>.
            </span>
          ) : (
            <span className="font-bold tracking-wide text-white">
              ⏰ Próximo Vencimiento: Te quedan <span className="px-2 py-0.5 rounded bg-black/20 font-mono text-amber-200 font-extrabold">{daysRemaining} {daysRemaining === 1 ? 'día' : 'días'} restantes</span>. Fecha de pago: <span className="underline font-mono">{formattedEndDate}</span>.
            </span>
          )}
          <span className="text-white/80 hidden lg:inline text-xs">
            {isExpired ? "Realiza tu pago para evitar la interrupción del servicio." : "Mantén tus pagos al día para evitar cortes."}
          </span>
        </div>

        <Button
          size="sm"
          onClick={() => navigate('/subscription?pay=true')}
          className={`h-9 font-bold px-4 rounded-xl shadow-md transition-transform hover:scale-105 active:scale-95 shrink-0 ${
            isExpired
              ? "bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
              : "bg-white text-amber-800 hover:bg-amber-50 hover:text-amber-900"
          }`}
        >
          <CreditCard className="w-4 h-4 mr-1.5" />
          {isExpired ? "Pagar Suscripción Ahora" : "Pagar Suscripción"}
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
