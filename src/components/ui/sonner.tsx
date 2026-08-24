import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      duration={4000}
      // Mismo lenguaje visual chico/minimalista que el Toaster de
      // components/ui/toast.tsx — la app usa los dos sistemas en
      // distintas pantallas y antes se veían visiblemente distintos.
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-zinc-950 group-[.toaster]:text-zinc-100 group-[.toaster]:border-white/[0.06] group-[.toaster]:rounded-xl group-[.toaster]:shadow-lg group-[.toaster]:shadow-black/30 group-[.toaster]:px-3 group-[.toaster]:py-2.5",
          title: "group-[.toast]:text-[13px] group-[.toast]:font-semibold",
          description: "group-[.toast]:text-[11px] group-[.toast]:text-zinc-500",
          actionButton:
            "group-[.toast]:bg-emerald-600 group-[.toast]:text-white group-[.toast]:text-xs",
          cancelButton:
            "group-[.toast]:bg-zinc-800 group-[.toast]:text-zinc-400 group-[.toast]:text-xs",
          closeButton:
            "group-[.toast]:bg-transparent group-[.toast]:border-none group-[.toast]:text-zinc-600",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
