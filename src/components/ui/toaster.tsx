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
    <ToastProvider>
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
        let bgIcon = "bg-emerald-500/10 border-emerald-500/20"
        let accentColor = "bg-emerald-500 shadow-[0_0_15px_#10b981]"
        let blobColor = "bg-emerald-500/10"

        if (isDestructive) {
          Icon = AlertCircle
          iconColor = "text-red-400 animate-pulse"
          bgIcon = "bg-red-500/10 border-red-500/20"
          accentColor = "bg-red-500 shadow-[0_0_15px_#ef4444]"
          blobColor = "bg-red-500/10"
        } else if (isWarning) {
          Icon = AlertTriangle
          iconColor = "text-amber-400"
          bgIcon = "bg-amber-500/10 border-amber-500/20"
          accentColor = "bg-amber-500 shadow-[0_0_15px_#f59e0b]"
          blobColor = "bg-amber-500/10"
        } else if (isSuccess) {
          Icon = CheckCircle2
          iconColor = "text-emerald-400"
          bgIcon = "bg-emerald-500/10 border-emerald-500/20"
          accentColor = "bg-emerald-500 shadow-[0_0_15px_#10b981]"
          blobColor = "bg-emerald-500/10"
        }

        return (
          <Toast key={id} variant={variant} {...props} className="pl-5 pr-8 py-3.5 relative overflow-hidden flex items-center gap-3">
            {/* Elegant Left Glowing Accent Line */}
            <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 rounded-l-full", accentColor)} />
            
            {/* Background glassmorphic ambient blob */}
            <div className={cn("absolute -right-16 -top-16 w-32 h-32 rounded-full blur-[40px] opacity-20 pointer-events-none", blobColor)} />

            {/* Glowing Icon Container */}
            <div className={cn("p-2 rounded-[1rem] shrink-0 border flex items-center justify-center shadow-inner", bgIcon)}>
              <Icon className={cn("h-5 w-5", iconColor)} />
            </div>

            {/* Content Slot */}
            <div className="flex-1 flex flex-col justify-center min-w-0 pr-2">
              {title && (
                <ToastTitle className="text-[13px] font-black uppercase tracking-tight text-white/95 leading-tight">
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed font-semibold break-words">
                  {description}
                </ToastDescription>
              )}
            </div>
            
            {action}
            <ToastClose className="opacity-100 group-hover:opacity-100 text-zinc-500 hover:text-white transition-colors duration-200 right-3 top-1/2 -translate-y-1/2 flex items-center justify-center hover:bg-white/5 rounded-full h-6 w-6 p-1 border-0" />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
