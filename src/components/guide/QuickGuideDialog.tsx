import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart,
  Package,
  FileText,
  Settings,
  Sparkles,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  X
} from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useCompanySettings } from '@/hooks/useCompanySettings';

export const triggerQuickGuide = () => {
  window.dispatchEvent(new CustomEvent('cobro:open-quick-guide'));
};

interface QuickGuideStep {
  id: number;
  title: string;
  badge: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  features: { title: string; desc: string }[];
  actionLabel: string;
  actionRoute: string;
  tip?: string;
}

const STEPS: QuickGuideStep[] = [
  {
    id: 1,
    title: 'Punto de Venta Rápido',
    badge: 'Cobro Ágil',
    subtitle: 'Registra ventas y emite comprobantes en cuestión de segundos.',
    icon: ShoppingCart,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15 border-emerald-500/30',
    features: [
      {
        title: 'Búsqueda instantánea',
        desc: 'Encuentra productos por nombre o código de barra con tu teclado o lector.'
      },
      {
        title: 'Múltiples métodos de pago',
        desc: 'Cobra en Efectivo, Tarjeta, Transferencia bancaria o Crédito a plazo.'
      },
      {
        title: 'Facturación directa',
        desc: 'Asigna clientes, aplica descuentos o propinas y emite tickets o facturas con un clic.'
      }
    ],
    actionLabel: 'Ir al Punto de Venta',
    actionRoute: '/pos',
    tip: '💡 Puedes presionar "Punto de Venta" en cualquier momento desde el menú superior.'
  },
  {
    id: 2,
    title: 'Catálogo e Inventario',
    badge: 'Tus Productos',
    subtitle: 'Administra tus existencias o servicios profesionales.',
    icon: Package,
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/15 border-cyan-500/30',
    features: [
      {
        title: 'Productos y Servicios',
        desc: 'Define precios, costos, impuestos y categorías organizadas para tu negocio.'
      },
      {
        title: 'Control de Stock',
        desc: 'Recibe alertas automáticas cuando un producto esté por agotarse.'
      },
      {
        title: 'Importación masiva',
        desc: 'Carga tu catálogo completo fácilmente desde un archivo de Excel.'
      }
    ],
    actionLabel: 'Ver Productos',
    actionRoute: '/products',
    tip: '💡 Si tu negocio es de servicios, puedes registrar tus tarifas por hora o proyecto.'
  },
  {
    id: 3,
    title: 'Comprobantes y Facturación',
    badge: 'Fiscal y Formal',
    subtitle: 'Emite facturas formales con NCF o comprobantes en formato Carta.',
    icon: FileText,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/15 border-blue-500/30',
    features: [
      {
        title: 'Comprobantes Fiscales (NCF)',
        desc: 'Facturas de Crédito Fiscal (B01/E31), Consumidor Final (B02/E32) y más.'
      },
      {
        title: 'Formatos Carta y Térmico',
        desc: 'Diseñado para impresoras térmicas de 80mm/58mm o papel estándar Carta (8.5x11).'
      },
      {
        title: 'Reimpresión y Envío',
        desc: 'Descarga facturas en PDF al instante o compártelas por WhatsApp.'
      }
    ],
    actionLabel: 'Historial de Facturas',
    actionRoute: '/invoices',
    tip: '💡 Puedes personalizar tus secuencias fiscales en Ajustes > Comprobantes.'
  },
  {
    id: 4,
    title: 'Configuración y Tienda',
    badge: 'Personalización',
    subtitle: 'Ajusta tu logo, datos de empresa e impresora predeterminada.',
    icon: Settings,
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/15 border-purple-500/30',
    features: [
      {
        title: 'Datos de Empresa',
        desc: 'Coloca tu RNC o Cédula, teléfono, dirección y redes sociales.'
      },
      {
        title: 'Logo e Impresora',
        desc: 'Sube tu logotipo para que aparezca en el encabezado de cada comprobante.'
      },
      {
        title: 'Cuentas de Banco y Caja',
        desc: 'Registra tus cuentas bancarias para cobros por transferencia y apertura de caja.'
      }
    ],
    actionLabel: 'Ir a Configuración',
    actionRoute: '/settings',
    tip: '💡 Puedes volver a consultar esta guía en cualquier momento desde tu menú de usuario.'
  }
];

export const QuickGuideDialog: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const { settings } = useCompanySettings();

  const userStorageKey = `cobro_quick_guide_seen_${profile?.id || 'guest'}`;

  // Check if first-time registration or guide requested
  useEffect(() => {
    const handleOpen = () => {
      setCurrentStep(0);
      setIsOpen(true);
    };

    window.addEventListener('cobro:open-quick-guide', handleOpen);

    // Auto-open on first time registration or if user hasn't seen it yet
    const justRegistered = localStorage.getItem('cobro_show_quick_guide');
    const hasSeen = localStorage.getItem(userStorageKey);

    if (justRegistered === 'true' || !hasSeen) {
      // Small delay to allow UI transition
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 700);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('cobro:open-quick-guide', handleOpen);
      };
    }

    return () => {
      window.removeEventListener('cobro:open-quick-guide', handleOpen);
    };
  }, [profile?.id, userStorageKey]);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.removeItem('cobro_show_quick_guide');
    localStorage.setItem(userStorageKey, 'true');
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
      navigate('/pos');
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleJumpToModule = (route: string) => {
    handleClose();
    navigate(route);
  };

  const activeStepData = STEPS[currentStep];
  const StepIcon = activeStepData.icon;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent
        hideCloseButton
        className="w-[calc(100%-1.5rem)] sm:w-full max-w-lg p-0 overflow-hidden bg-[#121619] border border-white/10 text-white shadow-2xl rounded-3xl z-[100]"
      >
        <DialogTitle className="sr-only">Guía Rápida Minimalista</DialogTitle>

        {/* Header with gradient glow background */}
        <div className="relative p-5 sm:p-6 pb-4 border-b border-white/[0.08] overflow-hidden">
          {/* Subtle glow accent */}
          <div className="absolute -top-12 -right-12 w-44 h-44 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors cursor-pointer"
            title="Cerrar guía"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative z-10 flex items-center justify-between pr-8">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-wider uppercase">
              <Sparkles className="h-3 w-3" />
              <span>Guía Rápida • Paso {currentStep + 1} de {STEPS.length}</span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
              {settings?.company_name || 'Cobro App'}
            </span>
          </div>

          <div className="relative z-10 mt-3 flex items-start gap-3.5">
            <div className={`p-3 rounded-2xl border ${activeStepData.iconBg} ${activeStepData.iconColor} shrink-0 shadow-inner`}>
              <StepIcon className="h-6 w-6" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                {activeStepData.title}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                {activeStepData.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Body content with smooth transition */}
        <div className="p-5 sm:p-6 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {/* Feature cards */}
              <div className="space-y-2">
                {activeStepData.features.map((feature, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="mt-0.5 p-1 rounded-full bg-emerald-500/10 text-emerald-400 shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="text-left leading-snug">
                      <p className="text-xs font-bold text-slate-200">{feature.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tip box */}
              {activeStepData.tip && (
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 text-[11px] text-slate-300">
                  {activeStepData.tip}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Module shortcut link */}
          <div className="pt-1 flex items-center justify-between text-xs">
            <button
              onClick={() => handleJumpToModule(activeStepData.actionRoute)}
              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors cursor-pointer group"
            >
              <span>{activeStepData.actionLabel}</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={handleClose}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              Saltar guía
            </button>
          </div>
        </div>

        {/* Footer with Step Dots and Navigation */}
        <div className="p-4 sm:p-5 bg-black/30 border-t border-white/[0.08] flex items-center justify-between gap-3">
          {/* Step indicator dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  currentStep === idx
                    ? 'w-6 bg-emerald-500'
                    : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
                title={`Ir al paso ${idx + 1}`}
              />
            ))}
          </div>

          {/* Prev & Next / Finish buttons */}
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                className="h-9 px-3 text-xs text-slate-300 hover:text-white hover:bg-white/10 rounded-xl"
              >
                <ChevronLeft className="h-4 w-4 mr-0.5" />
                Anterior
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleNext}
              className="h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
            >
              {currentStep < STEPS.length - 1 ? (
                <>
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-0.5" />
                </>
              ) : (
                <>
                  ¡Comenzar ahora!
                  <Sparkles className="h-3.5 w-3.5 ml-1.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
