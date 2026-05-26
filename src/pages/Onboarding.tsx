import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, ChefHat, Store as StoreIcon, ArrowRight, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { useUserStore } from '@/hooks/useUserStore';
import { useToast } from '@/hooks/use-toast';

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 1000 : -1000,
    opacity: 0
  })
};

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { data: store } = useUserStore();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    storeName: '',
    shopType: 'store'
  });

  // Pre-fill store name if available and not default
  useEffect(() => {
    if (store && store.store_name && store.store_name !== 'Mi Negocio') {
      setFormData(prev => ({ ...prev, storeName: store.store_name }));
    }
  }, [store]);

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setStep(step + newDirection);
  };

  const handleFinish = async () => {
    if (!store?.id) return;
    setLoading(true);

    try {
      // 1. Update store name
      const { error: storeError } = await supabase
        .from('stores')
        .update({ store_name: formData.storeName || 'Mi Negocio' })
        .eq('id', store.id);

      if (storeError) throw storeError;

      // 2. Update store settings (shop_type)
      // Check if store_settings exists first
      const { data: settingsData } = await supabase
        .from('store_settings')
        .select('id')
        .eq('store_id', store.id)
        .maybeSingle();

      if (settingsData) {
        await supabase
          .from('store_settings')
          .update({ shop_type: formData.shopType })
          .eq('store_id', store.id);
      } else {
        await supabase
          .from('store_settings')
          .insert({
            store_id: store.id,
            shop_type: formData.shopType
          });
      }

      // 3. Mark onboarding as completed in user metadata
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const currentMetadata = userData.user.user_metadata || {};
        await supabase.auth.updateUser({
          data: { 
            ...currentMetadata,
            onboarding_completed: true 
          }
        });
      }

      toast({
        title: "¡Todo listo!",
        description: "Tu tienda ha sido configurada con éxito.",
      });

      // Reload to apply settings globally and clear cache
      setTimeout(() => {
        window.location.href = '/app';
      }, 1000);

    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast({
        title: "Error al guardar configuración",
        description: error.message,
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  const shopTypes = [
    { id: 'store', label: 'Tienda', emoji: '🛍️', desc: 'Venta directa, inventario, clientes y facturas', color: 'blue', icon: StoreIcon },
    { id: 'restaurant', label: 'Restaurante', emoji: '🍽️', desc: 'Mesas, pantalla de cocina, pedidos y delivery', color: 'orange', icon: ChefHat },
    { id: 'supermarket', label: 'Supermercado', emoji: '🛒', desc: 'Gran inventario, múltiples categorías y cajas rápidas', color: 'green', icon: Building2 },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        
        {/* Header Steps */}
        <div className="flex items-center justify-center mb-8 space-x-4">
            <div className={`h-2 w-16 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-16 rounded-full transition-all duration-500 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-16 rounded-full transition-all duration-500 ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
        </div>

        <Card className="border-border shadow-2xl bg-card/80 backdrop-blur-xl rounded-[2rem] overflow-hidden">
          <CardContent className="p-8 md:p-12">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-8"
                >
                  <div className="text-center space-y-4">
                    <h1 className="text-4xl font-black tracking-tight">¡Bienvenido a CobroApp!</h1>
                    <p className="text-muted-foreground text-lg">
                      Vamos a configurar tu espacio de trabajo en unos pocos pasos.
                    </p>
                  </div>

                  <div className="space-y-4 max-w-md mx-auto pt-6">
                    <Label className="text-base">¿Cómo se llama tu negocio?</Label>
                    <Input 
                      value={formData.storeName}
                      onChange={(e) => setFormData({...formData, storeName: e.target.value})}
                      placeholder="Ej. Mi Super Tienda"
                      className="h-14 text-lg rounded-xl bg-background/50 border-primary/20 focus-visible:ring-primary"
                    />
                  </div>

                  <div className="flex justify-end pt-8">
                    <Button 
                      size="lg" 
                      onClick={() => paginate(1)}
                      disabled={!formData.storeName.trim()}
                      className="rounded-xl px-8"
                    >
                      Continuar <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-8"
                >
                  <div className="text-center space-y-2 mb-8">
                    <h2 className="text-3xl font-bold">¿Qué tipo de negocio tienes?</h2>
                    <p className="text-muted-foreground">Adaptaremos el sistema a tus necesidades específicas.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {shopTypes.map((type) => {
                      const isSelected = formData.shopType === type.id;
                      const ring = { orange: 'ring-orange-500 bg-orange-500/10 border-orange-400/50', blue: 'ring-blue-500 bg-blue-500/10 border-blue-400/50', green: 'ring-green-500 bg-green-500/10 border-green-400/50' }[type.color as 'orange'|'blue'|'green'];
                      const iconColor = { orange: 'text-orange-500 bg-orange-500/20', blue: 'text-blue-500 bg-blue-500/20', green: 'text-green-500 bg-green-500/20' }[type.color as 'orange'|'blue'|'green'];

                      return (
                        <div
                          key={type.id}
                          onClick={() => setFormData({...formData, shopType: type.id})}
                          className={`relative flex flex-col items-center text-center p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${isSelected ? `ring-2 ${ring} scale-105 shadow-xl` : 'border-border bg-background/50 hover:bg-muted/80'}`}
                        >
                          {isSelected && <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-primary" />}
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-3xl ${iconColor}`}>
                            {type.emoji}
                          </div>
                          <h3 className={`font-bold text-lg mb-2 ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>{type.label}</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">{type.desc}</p>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex justify-between pt-8">
                    <Button variant="ghost" size="lg" onClick={() => paginate(-1)} className="rounded-xl">
                      Atrás
                    </Button>
                    <Button size="lg" onClick={() => paginate(1)} className="rounded-xl px-8">
                      Continuar <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-8"
                >
                  <div className="text-center space-y-4">
                    <div className="mx-auto w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
                      <CheckCircle2 className="w-10 h-10 text-green-500" />
                    </div>
                    <h2 className="text-3xl font-bold">¡Todo listo para empezar!</h2>
                    <p className="text-muted-foreground text-lg max-w-md mx-auto">
                      Hemos configurado <strong>{formData.storeName || 'tu tienda'}</strong> como un <strong>{shopTypes.find(t => t.id === formData.shopType)?.label}</strong>.
                    </p>
                  </div>

                  <div className="bg-primary/5 rounded-2xl p-6 text-center border border-primary/10 max-w-md mx-auto">
                    <p className="text-sm font-medium text-foreground">
                      Podrás cambiar todas estas configuraciones más adelante desde el panel de Ajustes.
                    </p>
                  </div>

                  <div className="flex justify-between pt-8">
                    <Button variant="ghost" size="lg" onClick={() => paginate(-1)} disabled={loading} className="rounded-xl">
                      Atrás
                    </Button>
                    <Button 
                      size="lg" 
                      onClick={handleFinish} 
                      disabled={loading}
                      className="rounded-xl px-8 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {loading ? (
                        <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> Configurando...</>
                      ) : (
                        "Empezar a usar CobroApp"
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
