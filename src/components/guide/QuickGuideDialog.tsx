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
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  X
} from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';

export const triggerQuickGuide = () => {
  window.dispatchEvent(new CustomEvent('cobro:open-quick-guide'));
};

interface QuickGuideStep {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  points: { title: string; desc: string }[];
  actionLabel: string;
  actionRoute: string;
  tip?: string;
}

const STEPS: QuickGuideStep[] = [
  {
    id: 1,
    title: 'Punto de Venta',
    subtitle: 'Registra ventas y emite comprobantes en segundos.',
    icon: ShoppingCart,
    points: [
      {
        title: 'Búsqueda rápida',
        desc: 'Encuentra productos por nombre o código de barra con tu teclado o lector.'
      },
      {
        title: 'Métodos de pago',
        desc: 'Cobra en efectivo, tarjeta, transferencia bancaria o crédito a plazo.'
      },
      {
        title: 'Facturación directa',
        desc: 'Asigna clientes, aplica descuentos y emite tickets o facturas fiscales.'
      }
    ],
    actionLabel: 'Ir al Punto de Venta',
    actionRoute: '/pos',
    tip: 'Accede al POS en cualquier momento desde el menú superior.'
  },
  {
    id: 2,
    title: 'Catálogo e Inventario',
    subtitle: 'Administra tus existencias o servicios profesionales.',
    icon: Package,
    points: [
      {
        title: 'Productos y servicios',
        desc: 'Define precios, costos, impuestos y categorías para tu catálogo.'
      },
      {
        title: 'Control de stock',
        desc: 'Recibe alertas automáticas cuando un producto esté por agotarse.'
      },
      {
        title: 'Carga masiva',
        desc: 'Importa tu inventario completo fácilmente desde una plantilla de Excel.'
      }
    ],
    actionLabel: 'Ver Productos',
    actionRoute: '/products',
    tip: 'Si eres de servicios, registra tus tarifas por hora o por proyecto.'
  },
  {
    id: 3,
    title: 'Comprobantes y NCF',
    subtitle: 'Emite facturas fiscales o en formato Carta.',
    icon: FileText,
    points: [
      {
        title: 'Comprobantes fiscales',
        desc: 'Soporte para Crédito Fiscal (B01/E31), Consumidor Final (B02/E32) y más.'
      },
      {
        title: 'Formatos de impresión',
        desc: 'Compatible con rollos térmicos de 80mm/58mm y hojas estándar Carta.'
      },
      {
        title: 'Descarga y envío',
        desc: 'Genera PDFs al instante o comparte comprobantes directamente por WhatsApp.'
      }
    ],
    actionLabel: 'Historial de Facturas',
    actionRoute: '/invoices',
    tip: 'Configura tus secuencias fiscales en Ajustes > Comprobantes.'
  },
  {
    id: 4,
    title: 'Configuración de Tienda',
    subtitle: 'Ajusta tu logo, datos de empresa e impresora.',
    icon: Settings,
    points: [
      {
        title: 'Datos fiscales',
        desc: 'Coloca tu RNC o Cédula, teléfono, dirección comercial y redes.'
      },
      {
        title: 'Logo e impresión',
        desc: 'Sube tu logotipo para el encabezado y elige el tamaño de papel predeterminado.'
      },
      {
        title: 'Cuentas de banco',
        desc: 'Registra tus cuentas bancarias para cobros por transferencia y cuadres.'
      }
    ],
    actionLabel: 'Ir a Configuración',
    actionRoute: '/settings',
    tip: 'Puedes volver a abrir esta guía desde tu menú de perfil.'
  }
];

export const QuickGuideDialog: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const { profile } = useUserProfile();

  const userStorageKey = `cobro_quick_guide_seen_${profile?.id || 'guest'}`;

  useEffect(() => {
    const handleOpen = () => {
      setCurrentStep(0);
      setIsOpen(true);
    };

    window.addEventListener('cobro:open-quick-guide', handleOpen);

    const justRegistered = localStorage.getItem('cobro_show_quick_guide');
    const hasSeen = localStorage.getItem(userStorageKey);

    if (justRegistered === 'true' || !hasSeen) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 600);
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
        className="w-[calc(100%-1.5rem)] sm:w-full max-w-[460px] p-6 bg-[#0e1215] border border-white/[0.08] text-white shadow-2xl rounded-2xl z-[100]"
      >
        <DialogTitle className="sr-only">Guía Rápida</DialogTitle>

        {/* Minimalist Top Bar: subtle step counter & close icon */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono tracking-widest text-emerald-400 font-semibold uppercase">
            0{currentStep + 1} / 0{STEPS.length}
          </span>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors p-1 -mr-1 rounded-md hover:bg-white/5 cursor-pointer"
            title="Cerrar guía"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Header: Clean icon, title and subtitle without heavy boxes */}
        <div className="mt-4 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <StepIcon className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-white tracking-tight leading-tight">
              {activeStepData.title}
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {activeStepData.subtitle}
            </p>
          </div>
        </div>

        {/* Body: Clean minimalist points */}
        <div className="mt-5 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-2.5"
            >
              {activeStepData.points.map((point, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-left">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong className="text-white font-medium">{point.title}: </strong>
                    <span className="text-slate-400">{point.desc}</span>
                  </p>
                </div>
              ))}

              {activeStepData.tip && (
                <p className="text-[11px] text-slate-400/80 pt-2 border-t border-white/[0.06] leading-relaxed">
                  💡 {activeStepData.tip}
                </p>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Module shortcut link */}
          <div className="pt-1 flex items-center justify-between text-xs">
            <button
              onClick={() => handleJumpToModule(activeStepData.actionRoute)}
              className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors cursor-pointer group"
            >
              <span>{activeStepData.actionLabel}</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={handleClose}
              className="text-[11px] text-slate-400 hover:text-slate-300 transition-colors cursor-pointer"
            >
              Saltar
            </button>
          </div>
        </div>

        {/* Minimalist Footer: dots on left, nav buttons on right */}
        <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between gap-3">
          {/* Subtle dot indicators */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  currentStep === idx
                    ? 'w-5 bg-emerald-400'
                    : 'w-1.5 bg-white/20 hover:bg-white/40'
                }`}
                title={`Paso ${idx + 1}`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                className="h-8 px-2.5 text-xs text-slate-400 hover:text-white hover:bg-white/5 rounded-lg"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                Anterior
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleNext}
              className="h-8 px-3.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              {currentStep < STEPS.length - 1 ? (
                <>
                  Siguiente
                  <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </>
              ) : (
                'Comenzar'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
