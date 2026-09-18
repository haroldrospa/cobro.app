import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { 
    hideCloseButton?: boolean;
    centerOnMobile?: boolean;
  }
>((({ className, children, hideCloseButton, centerOnMobile = true, style, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      style={style}
      className={cn(
        // ── Base ──
        "fixed z-50 grid gap-4 border bg-background shadow-lg duration-150",
        // ── Animaciones ──
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
        // ── Layout (Centrado horizontal robusto con inset-x-0 mx-auto; anclado arriba en móviles/tablets para no tapar con teclado virtual) ──
        centerOnMobile ? (
          "inset-x-0 mx-auto top-2 sm:top-3 md:top-4 landscape:top-2 landscape:translate-y-0 lg:[@media(min-height:820px)_and_(pointer:fine)]:top-1/2 lg:[@media(min-height:820px)_and_(pointer:fine)]:-translate-y-1/2 landscape:lg:top-2 landscape:lg:translate-y-0 w-[calc(100%-1rem)] max-w-lg rounded-2xl p-4 sm:p-5 max-h-[calc(var(--visual-viewport-height,100dvh)-1rem)] sm:max-h-[calc(var(--visual-viewport-height,100dvh)-1.5rem)] lg:[@media(min-height:820px)_and_(pointer:fine)]:max-h-[85vh] landscape:lg:max-h-[calc(var(--visual-viewport-height,100dvh)-1rem)] overflow-y-auto overflow-x-hidden overscroll-contain"
        ) : (
          "inset-x-0 bottom-0 top-auto w-full rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto overflow-x-hidden overscroll-contain data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4 sm:inset-x-0 sm:mx-auto sm:bottom-auto sm:top-4 landscape:top-2 landscape:translate-y-0 lg:[@media(min-height:820px)_and_(pointer:fine)]:top-1/2 lg:[@media(min-height:820px)_and_(pointer:fine)]:-translate-y-1/2 landscape:lg:top-2 landscape:lg:translate-y-0 sm:w-full sm:max-w-lg sm:rounded-xl sm:p-6 sm:max-h-[calc(var(--visual-viewport-height,100dvh)-1.5rem)] lg:[@media(min-height:820px)_and_(pointer:fine)]:max-h-[85vh] landscape:lg:max-h-[calc(var(--visual-viewport-height,100dvh)-1rem)]"
        ),
        className
      )}
      {...props}
    >
      {children}
      {!hideCloseButton && (
        <DialogPrimitive.Close className="absolute right-4 top-4 z-50 rounded-full p-1 opacity-70 ring-offset-background transition-all hover:opacity-100 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
)))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2 sm:gap-0",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
