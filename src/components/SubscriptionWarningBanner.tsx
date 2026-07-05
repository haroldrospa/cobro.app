import { useSubscription } from "@/hooks/useSubscription";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { getDaysRemaining } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function SubscriptionWarningBanner() {
  const { data: subscription, isLoading } = useSubscription();
  const navigate = useNavigate();
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

  if (isLoading || !subscription) return null;

  // Si no hay end_date, asumimos que no vence (plan lifetime, o plan básico sin límite, etc.)
  if (!subscription.end_date) return null;

  const daysRemaining = getDaysRemaining(subscription.end_date);

  // Solo mostramos el banner si quedan 5 días o menos, pero más de 0 días.
  // Si quedan 0 días, ProtectedRoute debería interceptarlo, pero por si acaso.
  if (daysRemaining > 5 || daysRemaining <= 0) return null;

  return (
    <div className="w-full bg-orange-500 text-white px-4 py-2.5 shadow-md flex items-center justify-between z-50 animate-in slide-in-from-top-4 fade-in duration-500">
      <div className="flex items-center gap-2 max-w-[1920px] mx-auto w-full">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-2 text-sm">
          <span className="font-semibold">¡Atención! Tu suscripción vence en {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}.</span>
          <span className="text-orange-100 hidden sm:inline">Para evitar interrupciones, renueva tu plan pronto.</span>
        </div>
        
        {isOwner && (
          <Button 
            size="sm" 
            variant="secondary"
            onClick={() => navigate('/subscription')}
            className="h-8 bg-white text-orange-600 hover:bg-orange-50 hover:text-orange-700 font-medium whitespace-nowrap ml-2 shadow-sm border-0"
          >
            Renovar ahora
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
