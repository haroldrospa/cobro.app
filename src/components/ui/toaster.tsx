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

        // Success keywords: éxito, exito, guardado, creado, restaurado, completado, sincronizando, actualizada, cargado
        const isSuccess =
          titleLower.includes("éxito") ||
          titleLower.includes("exito") ||
          titleLower.includes("guardado") ||
          titleLower.includes("restaurado") ||
          titleLower.includes("creado") ||
          titleLower.includes("agregado") ||
          titleLower.includes("completado") ||
          titleLower.includes("sincronizando") ||
          titleLower.includes("actualizada") ||
          titleLower.includes("cargado") ||
          descriptionLower.includes("éxito") ||
          descriptionLower.includes("exito") ||
          descriptionLower.includes("guardado") ||
          descriptionLower.includes("restaurado") ||
          descriptionLower.includes("cargaron")

        // Warning keywords: advertencia, alerta, límite, limite, aviso, requerida, sesión
        const isWarning =
          titleLower.includes("advertencia") ||
          titleLower.includes("alerta") ||
          titleLower.includes("límite") ||
          titleLower.includes("limite") ||
          titleLower.includes("aviso") ||
          titleLower.includes("requerida") ||
          titleLower.includes("sesión")

        let Icon = Info
        let iconColor = "text-emerald-400"

        if (isDestructive) {
          Icon = AlertCircle
          iconColor = "text-red-400"
        } else if (isWarning) {
          Icon = AlertTriangle
          iconColor = "text-amber-400"
        } else if (isSuccess) {
          Icon = CheckCircle2
          iconColor = "text-emerald-400"
        }

        return (
          <Toast key={id} variant={variant} {...props}>
            <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />

            <div className="flex-1 flex flex-col justify-center min-w-0">
              {title && (
                <ToastTitle className="truncate">{title}</ToastTitle>
              )}
              {description && (
                <ToastDescription className="line-clamp-2">{description}</ToastDescription>
              )}
            </div>

            {action}
            <ToastClose className="static opacity-100 shrink-0 text-zinc-600 hover:text-zinc-300 h-5 w-5 p-1 rounded-md hover:bg-white/5" />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
