import React from 'react';
import { cn } from '@/lib/utils';
import {
  Store,
  Building2,
  FileText,
  CreditCard,
  Package,
  Printer,
  Settings as SettingsIcon,
  Database,
  ChevronLeft,
  ChevronRight,
  Bell,
  Receipt,
  ChefHat,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

interface MobileSettingsLayoutProps {
  activeSection: string | null;
  onSectionChange: (section: string | null) => void;
  children: Record<string, React.ReactNode>;
  businessType?: string;
}

const settingsSections: SettingsSection[] = [
  { id: 'store', label: 'Mi Tienda', icon: Store, description: 'Configura tu tienda online' },
  { id: 'company', label: 'Empresa', icon: Building2, description: 'Información de la empresa' },
  { id: 'invoices', label: 'Facturas', icon: FileText, description: 'Numeración y formato' },
  { id: 'payments', label: 'Pagos', icon: CreditCard, description: 'Métodos de pago' },
  { id: 'products', label: 'Productos', icon: Package, description: 'Inventario y categorías' },
  { id: 'print', label: 'Impresión', icon: Printer, description: 'Configurar impresora' },
  { id: 'notifications', label: 'Notificaciones', icon: Bell, description: 'Sonidos y alertas' },
  { id: 'cocina', label: 'Cocina', icon: ChefHat, description: 'Umbrales y KDS' },
  { id: 'ai', label: 'Inteligencia Artificial', icon: Sparkles, description: 'Claves de API y escaneo con IA' },
  { id: 'system', label: 'Sistema', icon: SettingsIcon, description: 'Idioma y apariencia' },
  { id: 'advanced', label: 'Avanzado', icon: Database, description: 'Datos y seguridad' },
  { id: 'subscription', label: 'Suscripción', icon: Receipt, description: 'Plan y facturación' },
];

const MobileSettingsLayout: React.FC<MobileSettingsLayoutProps> = ({
  activeSection,
  onSectionChange,
  children,
  businessType = 'restaurant'
}) => {
  const filteredSections = settingsSections.filter(section => {
    if (section.id === 'cocina' && businessType !== 'restaurant') {
      return false;
    }
    return true;
  });

  const currentSection = settingsSections.find(s => s.id === activeSection);

  // Si no hay sección activa, mostrar el menú
  if (!activeSection) {
    return (
      <div className="flex flex-col animate-in fade-in duration-500">
        {/* --- PREMIUM HEADER --- */}
        <div className="flex flex-col items-center text-center pt-2 pb-8 px-6 space-y-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter uppercase tracking-[0.2em] text-foreground">
              Configuracion
            </h1>
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-6 bg-emerald-500/40" />
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-500/70">
                Centro de Control
              </p>
              <div className="h-px w-6 bg-emerald-500/40" />
            </div>
          </div>
        </div>

        {/* Section List */}
        <div className="px-6 pb-24">
          <div className="max-w-md mx-auto space-y-3">
            {filteredSections.map((section, index) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => onSectionChange(section.id)}
                  className={cn(
                    "group relative w-full flex items-center gap-4 p-5 rounded-3xl overflow-hidden",
                    "bg-zinc-900/40 backdrop-blur-md border border-zinc-900",
                    "transition-all duration-300 ease-out active:scale-[0.97]",
                    "text-left animate-in slide-in-from-bottom-4 fill-mode-both"
                  )}
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                    <Icon className="h-6 w-6 text-emerald-500" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-zinc-100 text-[15px] uppercase tracking-tight">{section.label}</h3>
                    <p className="text-xs text-zinc-500 font-medium">{section.description}</p>
                  </div>
                  
                  <ChevronRight className="h-5 w-5 text-zinc-700 group-hover:text-emerald-500 transition-colors" />

                  {/* Decorative glass glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Mostrar el contenido de la sección activa
  return (
    <div className="flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header with back button */}
      <div className="flex-shrink-0 pt-2 pb-4">
        <div className="flex items-center gap-4 px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSectionChange(null)}
            className="h-10 w-10 rounded-full bg-zinc-900/50 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-500/10"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="flex-1">
            <h2 className="font-black text-xl uppercase tracking-tight text-zinc-100">
              {currentSection?.label}
            </h2>
          </div>
        </div>
      </div>

      {/* Section Content */}
      <div className="px-6 pb-24">
        <div className="max-w-md mx-auto">
          {children[activeSection]}
        </div>
      </div>
    </div>
  );
};

export default MobileSettingsLayout;
