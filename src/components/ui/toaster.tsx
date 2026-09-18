import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider duration={4000}>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        // Detect variant or infer it from title/description text
        const isDestructive = variant === "destructive"
        const titleLower = title?.toString().toLowerCase() || ""
        const descriptionLower = description?.toString().toLowerCase() || ""

        // Success keywords: éxito, exito, guardado, creado, restaurado, completado, sincronizando, actualizada, cargado, eliminado, eliminada, borrado, etc.
        const isSuccess =
          !isDestructive &&
          (titleLower.includes("éxito") ||
            titleLower.includes("exito") ||
            titleLower.includes("guardado") ||
            titleLower.includes("guardada") ||
            titleLower.includes("restaurado") ||
            titleLower.includes("creado") ||
            titleLower.includes("creada") ||
            titleLower.includes("agregado") ||
            titleLower.includes("agregada") ||
            titleLower.includes("completado") ||
            titleLower.includes("completada") ||
            titleLower.includes("sincronizando") ||
            titleLower.includes("actualizada") ||
            titleLower.includes("actualizado") ||
            titleLower.includes("eliminado") ||
            titleLower.includes("eliminada") ||
            titleLower.includes("borrado") ||
            titleLower.includes("borrada") ||
            titleLower.includes("cargado") ||
            titleLower.includes("cargada") ||
            titleLower.includes("enviado") ||
            titleLower.includes("enviada") ||
            titleLower.includes("procesado") ||
            titleLower.includes("procesada") ||
            titleLower.includes("registrado") ||
            titleLower.includes("registrada") ||
            descriptionLower.includes("éxito") ||
            descriptionLower.includes("exito") ||
            descriptionLower.includes("guardado") ||
            descriptionLower.includes("restaurado") ||
            descriptionLower.includes("correctamente") ||
            descriptionLower.includes("cargaron"))

        // Warning keywords: advertencia, alerta, límite, limite, aviso, requerida, sesión, atención, atencion
        const isWarning =
          !isDestructive &&
          !isSuccess &&
          (titleLower.includes("advertencia") ||
            titleLower.includes("alerta") ||
            titleLower.includes("límite") ||
            titleLower.includes("limite") ||
            titleLower.includes("aviso") ||
            titleLower.includes("requerida") ||
            titleLower.includes("requerido") ||
            titleLower.includes("sesión") ||
            titleLower.includes("atención") ||
            titleLower.includes("atencion") ||
            titleLower.includes("pendiente") ||
            descriptionLower.includes("advertencia") ||
            descriptionLower.includes("alerta") ||
            descriptionLower.includes("atención"))

        let Icon = Info
        let badgeStyle = "bg-sky-500/15 border-sky-500/30 text-sky-400 shadow-[0_0_12px_rgba(14,165,233,0.3)]"
        let borderGlow = "border-sky-500/25"
        let progressGradient = "bg-gradient-to-r from-sky-500 to-blue-400"

        if (isDestructive) {
          Icon = AlertCircle
          badgeStyle = "bg-rose-500/15 border-rose-500/30 text-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.3)]"
          borderGlow = "border-rose-500/30"
          progressGradient = "bg-gradient-to-r from-rose-500 to-red-400"
        } else if (isWarning) {
          Icon = AlertTriangle
          badgeStyle = "bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.3)]"
          borderGlow = "border-amber-500/30"
          progressGradient = "bg-gradient-to-r from-amber-500 to-yellow-400"
        } else if (isSuccess) {
          Icon = CheckCircle2
          badgeStyle = "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.3)]"
          borderGlow = "border-emerald-500/25"
          progressGradient = "bg-gradient-to-r from-emerald-500 to-teal-400"
        }

        return (
          <Toast
            key={id}
            variant={variant}
            className={cn("relative overflow-hidden", borderGlow)}
            {...props}
          >
            {/* Shimmer sweep animado al entrar */}
            <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent animate-toast-shimmer" />

            {/* Micro badge contenedor con pop elástico y resplandor sutil */}
            <div className={cn("shrink-0 w-8 h-8 rounded-xl border flex items-center justify-center animate-toast-icon", badgeStyle)}>
              <Icon className="h-4 w-4" />
            </div>

            {/* Contenido tipográfico nítido y minimalista */}
            <div className="flex-1 flex flex-col justify-center min-w-0 pr-1">
              {title && (
                <ToastTitle className="text-[13.5px] font-semibold tracking-tight text-white/95 truncate">
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription className="text-xs text-zinc-400/90 leading-snug mt-0.5 line-clamp-2">
                  {description}
                </ToastDescription>
              )}
            </div>

            {action}
            <ToastClose className="static opacity-60 hover:opacity-100 shrink-0 text-zinc-400 hover:text-white h-6 w-6 p-1 rounded-lg hover:bg-white/10 transition-all flex items-center justify-center" />

            {/* Barra de progreso minimalista (countdown) en la base */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.05] overflow-hidden">
              <div className={cn("h-full animate-toast-progress", progressGradient)} />
            </div>
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
