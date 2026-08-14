import React, { useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { AlertTriangle, Clock, X, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { getDaysRemaining } from "@/lib/utils";

export function SubscriptionWarningBanner() {
  const { data: subscription, isLoading } = useSubscription();
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(() => {
    return sessionStorage.getItem('dismissed_sub_warning') === 'true';
  });

  if (isLoading || !subscription || isDismissed) return null;
  if (!subscription.end_date) return null;

  const daysRemaining = getDaysRemaining(subscription.end_date);
  const isExpired = daysRemaining <= 0 || subscription.status === 'expired';

  // Mostrar el banner únicamente cuando falten 5 días o menos, o si ya venció
  if (daysRemaining > 5 && !isExpired) return null;

  const formattedEndDate = new Date(subscription.end_date).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('dismissed_sub_warning', 'true');
  };

  return (
    <div
      className={`w-full text-white px-4 py-2 shadow-md flex items-center justify-between z-50 transition-all ${
        isExpired
          ? "bg-rose-600 border-b border-rose-700"
          : "bg-amber-600 border-b border-amber-700"
      }`}
    >
      <div className="flex items-center justify-between gap-3 max-w-[1920px] mx-auto w-full">
        {/* Sección izquierda: Icono + Mensaje claro */}
        <div className="flex items-center gap-2.5 min-w-0">
          {isExpired ? (
            <AlertTriangle className="w-4 h-4 text-white shrink-0 animate-pulse" />
          ) : (
            <Clock className="w-4 h-4 text-white shrink-0" />
          )}

          <p className="text-xs sm:text-sm font-medium text-white truncate">
            {isExpired ? (
              <span>
                <strong>Suscripción vencida</strong> ({formattedEndDate}). Renueva para evitar interrupciones.
              </span>
            ) : (
              <span>
                <strong>Tu pago vence en {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}</strong> (Fecha: {formattedEndDate}).
              </span>
            )}
          </p>
        </div>

        {/* Sección derecha: Botón Pagar + X para Quitar */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => navigate('/subscription?pay=true')}
            className="h-7 text-xs font-bold px-3 rounded-lg bg-white text-slate-900 hover:bg-slate-100 shadow-sm"
          >
            <CreditCard className="w-3.5 h-3.5 mr-1" />
            Pagar ahora
          </Button>

          <button
            onClick={handleDismiss}
            className="p-1 rounded-md text-white/80 hover:text-white hover:bg-black/20 transition-colors"
            title="Quitar aviso"
            aria-label="Cerrar aviso de vencimiento"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
