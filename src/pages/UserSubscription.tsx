import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserStore } from '@/hooks/useUserStore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, Wallet, Loader2, Upload, DollarSign, CreditCard, ShieldCheck, Landmark, User, Leaf, Star, Building2, X, MessageSquare, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { getDaysRemaining } from '@/lib/utils';

const UserSubscription = () => {
    const { profile, loading: loadingProfile } = useUserProfile();
    const { data: store } = useUserStore();
    const { settings } = useStoreSettings();
    const { settings: companySettings } = useCompanySettings();
    const { toast } = useToast();

    // Use the verified hook for subscription state
    const { data: subscription } = useSubscription();
    const activePlan = subscription?.plan_id || 'basic';

    const { data: pendingPayment } = useQuery({
        queryKey: ['pending-payment', store?.id],
        enabled: !!store?.id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('payment_reports')
                .select('*')
                .eq('company_id', store?.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            return data;
        }
    });

    const { data: globalAdminSettings } = useQuery({
        queryKey: ['admin-global-settings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('admin_global_settings')
                .select('value')
                .eq('id', 'notification_email')
                .maybeSingle();
            if (error) return { value: 'haroldrospa@gmail.com' };
            return data || { value: 'haroldrospa@gmail.com' };
        }
    });

    const [targetPlan, setTargetPlan] = useState<string | null>(null);

    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false); // Estado para pantalla de éxito
    const [isAnnual, setIsAnnual] = useState(false);

    // Estado para reporte de pago manual
    const [paymentProof, setPaymentProof] = useState<File | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');

    const plans = [
        {
            id: 'basic',
            name: 'Emprendedor',
            priceDisplay: '$17',
            price: 17,
            annualPriceDisplay: '$14',
            annualPrice: 168,
            currency: 'USD',
            period: 'mes',
            description: 'Ideal para empezar con el pie derecho.',
            features: [
                { text: 'Facturas electrónicas ilimitadas', included: true },
                { text: '1 Empleado', included: true },
                { text: 'Control de inventario', included: true },
                { text: 'Múltiples métodos de pago', included: true },
                { text: 'Reportes de ventas', included: true },
                { text: 'Soporte estándar', included: true },
                { text: 'Gestión de clientes (CRM)', included: true },
                { text: 'Mi tienda online', included: false },
                { text: 'Nómina', included: false },
                { text: 'Contabilidad', included: false },
                { text: 'API de integración', included: false },
            ],
            popular: false
        },
        {
            id: 'pro',
            name: 'Empresarial',
            priceDisplay: '$45',
            price: 45,
            annualPriceDisplay: '$37',
            annualPrice: 444,
            currency: 'USD',
            period: 'mes',
            description: 'Todo lo que necesitas para escalar.',
            features: [
                { text: 'Facturas electrónicas ilimitadas', included: true },
                { text: 'Hasta 5 Empleados', included: true },
                { text: 'Control de inventario avanzado', included: true },
                { text: 'Múltiples métodos de pago', included: true },
                { text: 'Reportes y analíticas', included: true },
                { text: 'Soporte prioritario', included: true },
                { text: 'Gestión de clientes (CRM)', included: true },
                { text: 'Mi tienda online', included: true },
                { text: 'Nómina', included: true },
                { text: 'Contabilidad', included: true },
                { text: 'API de integración', included: false },
            ],
            popular: true
        },
        {
            id: 'enterprise',
            name: 'Corporativo',
            priceDisplay: 'Personalizado',
            price: 0,
            annualPriceDisplay: 'Personalizado',
            annualPrice: 0,
            currency: '',
            period: '',
            description: 'Potencia ilimitada y adaptación exacta a las necesidades de tu negocio.',
            features: [
                { text: 'Facturas electrónicas ilimitadas', included: true },
                { text: 'Empleados ilimitados', included: true },
                { text: 'Inventario de alto volumen', included: true },
                { text: 'Múltiples métodos de pago', included: true },
                { text: 'Reportes personalizados', included: true },
                { text: 'Soporte 24/7 y dedicado', included: true },
                { text: 'Gestión de clientes (CRM)', included: true },
                { text: 'Mi tienda online', included: true },
                { text: 'Nómina', included: true },
                { text: 'Contabilidad', included: true },
                { text: 'API y Webhooks', included: true },
                { text: 'Software adaptado a medida', included: true },
            ],
            popular: false
        }
    ];

    const currentPlanDetails = plans.find(p => p.id === activePlan) || plans[0];
    const targetPlanDetails = plans.find(p => p.id === targetPlan);
    const effectivePlanId = targetPlan || (activePlan === 'enterprise' ? 'basic' : (activePlan || 'basic'));
    const effectivePlanDetails = plans.find(p => p.id === effectivePlanId) || plans[0];

    const parsedAmount = parseFloat(paymentAmount);
    const displayAmount = !isNaN(parsedAmount) && parsedAmount > 0 
        ? parsedAmount 
        : (isAnnual ? effectivePlanDetails.annualPrice : effectivePlanDetails.price) || 17;

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('pay') === 'true') {
            const initialPlanId = activePlan === 'enterprise' ? 'basic' : (activePlan || 'basic');
            const initialPlan = plans.find(p => p.id === initialPlanId) || plans[0];
            setTargetPlan(initialPlan.id);
            setPaymentAmount((isAnnual ? initialPlan.annualPrice : initialPlan.price).toString());
            setIsPaymentOpen(true);
        }
    }, [activePlan, isAnnual]);

    const handleSelectPlan = (plan: typeof plans[0]) => {
        if (plan.id === 'enterprise') {
            window.open('https://wa.me/18099175744?text=Hola!%20Deseo%20cotizar%20el%20Plan%20Corporativo%20de%20CobroApp', '_blank');
            return;
        }
        setIsSuccess(false);
        setTargetPlan(plan.id);
        const amt = isAnnual ? plan.annualPrice : plan.price;
        setPaymentAmount(amt.toString());
        setIsPaymentOpen(true);
    };

    const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setPaymentProof(e.target.files[0]);
        }
    };

    const submitPaymentReport = async () => {
        if (!paymentProof || !paymentAmount) {
            toast({
                title: "Datos incompletos",
                description: "Por favor adjunte el comprobante de PayPal y el monto.",
                variant: 'destructive'
            });
            return;
        }

        setIsProcessing(true);

        console.log('🔍 [DEBUG] Iniciando proceso de pago...');
        console.log('📊 Company ID:', store?.id);
        console.log('💰 Monto:', paymentAmount);
        console.log('🎯 Plan Objetivo:', targetPlan || activePlan);

        try {
            // 1. Subir imagen
            const fileExt = paymentProof.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `proofs/${fileName}`;

            console.log('📤 Subiendo comprobante...');
            const { error: uploadError } = await supabase.storage
                .from('payment-proofs')
                .upload(filePath, paymentProof);

            if (uploadError) {
                console.error('❌ Error al subir imagen:', uploadError);
                throw uploadError;
            }
            console.log('✅ Comprobante subido:', filePath);

            // 2. REPORTAR PAGO PENDIENTE (Nuevo Flow)
            const { data: rpcData, error: rpcError } = await supabase.rpc('submit_payment_pending', {
                p_company_id: store?.id,
                p_amount: parseFloat(paymentAmount),
                p_currency: 'DOP',
                p_bank_name: 'PayPal',
                p_proof_url: filePath,
                p_target_plan_id: targetPlan || activePlan
            });

            console.log('📥 Respuesta de RPC:', { data: rpcData, error: rpcError });

            if (rpcError) {
                console.error('❌ Error en RPC:', rpcError);
                throw rpcError;
            }

            console.log('✅ Pago reportado (Pendiente de aprobación)');

            // 3. ENVIAR NOTIFICACIÓN POR CORREO
            try {
                const adminEmail = globalAdminSettings?.value || 'haroldrospa@gmail.com';
                console.log('📧 Intentando enviar correo a:', adminEmail);
                
                const { data, error } = await supabase.functions.invoke('send-subscription-notification', {
                    body: {
                        adminEmail: adminEmail,
                        storeName: store?.store_name || 'Sin Nombre',
                        storeCode: store?.store_code || 'N/A',
                        planName: targetPlanDetails?.name || 'Suscripción',
                        amount: parseFloat(paymentAmount),
                        userName: profile?.full_name || 'Usuario',
                        proofUrl: filePath
                    }
                });
                
                if (error) throw error;
                console.log('✅ Notificación enviada correctamente');
            } catch (emailErr) {
                console.error('❌ Error enviando notificación:', emailErr);
            }

            // 4. MOSTRAR PANTALLA DE "EN ESPERA"
            setIsSuccess(true);
            toast({
                title: "¡Recibido!",
                description: "Comprobante en espera de confirmación.",
                duration: 5000
            });

            // No recargar de inmediato, dejar que vean el mensaje
            // setTimeout(() => {
            //     window.location.reload();
            // }, 5000);

        } catch (error: any) {
            console.error('❌ [ERROR COMPLETO]:', error);
            toast({
                title: "Error al activar",
                description: error.message || "Hubo un problema. Intente nuevamente.",
                variant: 'destructive'
            });
            setIsProcessing(false);
        }
    };

    // NUEVA FUNCIÓN: Activación automatizada (Paddle / PayPal)
    const handlePaddleCheckout = () => {
        if (!store?.id) return;

        const selectedPlanId = targetPlan || (activePlan === 'enterprise' ? 'basic' : activePlan);

        if (selectedPlanId === 'enterprise') {
            window.open('https://wa.me/18099175744?text=Hola!%20Deseo%20cotizar%20el%20Plan%20Corporativo%20de%20CobroApp', '_blank');
            return;
        }

        const paddlePriceIds: Record<string, string | undefined> = {
            'basic': isAnnual ? import.meta.env.VITE_PADDLE_BASIC_ANNUAL_PRICE_ID : import.meta.env.VITE_PADDLE_BASIC_PRICE_ID,
            'pro': isAnnual ? import.meta.env.VITE_PADDLE_PRO_ANNUAL_PRICE_ID : import.meta.env.VITE_PADDLE_PRO_PRICE_ID,
            'enterprise': import.meta.env.VITE_PADDLE_ENTERPRISE_PRICE_ID
        };

        const rawPriceId = paddlePriceIds[selectedPlanId];
        const priceId = (rawPriceId || '').replace(/['"]/g, '').trim();

        if (!priceId || priceId.includes('...')) {
            toast({
                title: "Pasarela Directa en Configuración",
                description: `El pago con tarjeta para el plan ${effectivePlanDetails.name} se encuentra en mantenimiento. Puedes pagar por PayPal o Transferencia Bancaria.`,
                variant: 'destructive'
            });
            return;
        }

        // @ts-ignore
        if (window.Paddle) {
            try {
                // @ts-ignore
                window.Paddle.Checkout.open({
                    items: [{ priceId: priceId, quantity: 1 }],
                    customData: {
                        company_id: store.id,
                        target_plan_id: selectedPlanId
                    },
                    settings: {
                        displayMode: "overlay",
                        theme: "light",
                        locale: "es",
                    },
                    eventCallback: (event: any) => {
                        console.log("💳 Paddle Event:", event);
                        if (event?.name === 'checkout.error' || event?.type === 'checkout.error') {
                            toast({
                                title: "Error en Pasarela Paddle",
                                description: "Verifica que el 'Default Payment Link' esté configurado en tu Dashboard de Paddle.",
                                variant: "destructive"
                            });
                        }
                    }
                });
                setIsPaymentOpen(false);
            } catch (err: any) {
                console.error("❌ Error al abrir Paddle:", err);
                toast({
                    title: "Error al abrir pasarela",
                    description: "Usa la pestaña de PayPal o Transferencia Bancaria para activar tu suscripción.",
                    variant: "destructive"
                });
            }
        } else {
            toast({
                title: "Pasarela no disponible",
                description: "La pasarela de tarjeta no está disponible. Puedes utilizar PayPal o Transferencia Bancaria.",
                variant: 'destructive'
            });
        }
    };

    const activatePlanAutomated = async (method: 'stripe' | 'paypal') => {
        setIsProcessing(true);
        console.log(`🚀 [AUTO] Activando plan vía ${method}...`);

        try {
            // Simulamos delay de respuesta de pasarela
            await new Promise(resolve => setTimeout(resolve, 2000));

            const { data: rpcData, error: rpcError } = await supabase.rpc('submit_payment_and_activate', {
                p_company_id: store?.id,
                p_amount: parseFloat(paymentAmount),
                p_currency: 'DOP',
                p_bank_name: method === 'stripe' ? 'Stripe Card' : 'PayPal Auto',
                p_proof_url: 'automated_payment_success',
                p_target_plan_id: targetPlan || activePlan
            });

            if (rpcError) throw rpcError;

            console.log(`✅ [AUTO] Plan activado vía ${method}`);
            setIsSuccess(true);
            toast({
                title: "¡Membresía Activada!",
                description: "Tu cuenta se ha actualizado al instante.",
                duration: 5000
            });
        } catch (error: any) {
            console.error('❌ Error en activación automática:', error);
            toast({
                title: "Fallo en activación",
                description: "El pago se procesó pero no pudimos activar automáticamente. Contacta a soporte.",
                variant: 'destructive'
            });
        } finally {
            setIsProcessing(false);
        }
    };

    if (loadingProfile) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-7xl animate-fade-in space-y-8">


            {/* Header / Perfil */}
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center bg-card p-6 rounded-xl border border-border shadow-sm">
                <div className="relative group">
                    {/* Efecto de brillo/aura sutil detrás del logo */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-primary/10 rounded-full blur-md opacity-75 group-hover:opacity-100 transition duration-500"></div>
                    
                    <Avatar className="relative h-24 w-24 md:h-28 md:w-28 border-2 border-white/50 shadow-2xl overflow-hidden bg-white">
                        <AvatarImage 
                            src={companySettings?.logo_url || ""} 
                            className="object-contain p-3 transition-transform duration-500 group-hover:scale-105" 
                        />
                        <AvatarFallback className="text-3xl bg-primary/10 text-primary font-bold">
                            {store?.store_name?.charAt(0) || 'S'}
                        </AvatarFallback>
                    </Avatar>
                </div>

                <div className="flex-1 space-y-1">
                    <h1 className="text-2xl font-bold">{store?.store_name || 'Mi Negocio'}</h1>
                    <div className="flex flex-col gap-1">
                        <p className="text-muted-foreground text-sm font-medium">Tienda: {store?.store_code || '---'}</p>
                        <div className="flex flex-col gap-0.5 mt-1 p-2 bg-muted/30 rounded-lg border border-border/50">
                            <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                                <User className="h-3 w-3 text-primary" />
                                Usuario: {profile?.full_name || '---'}
                            </p>
                            <p className="text-[10px] font-mono text-muted-foreground select-all">
                                ID: {companySettings?.rnc || profile?.rnc || profile?.user_number || '---'}
                            </p>
                        </div>
                    </div>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 mt-2">
                        Plan {currentPlanDetails.name}
                    </Badge>
                </div>

                <Card className="w-full md:w-72 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                    <CardContent className="p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Estado de Cuenta</span>
                            <div className="flex flex-col items-end gap-1">
                                <Badge className={subscription?.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}>
                                    {subscription?.status === 'active' ? 'Activo' : 'Inactivo'}
                                </Badge>
                                {pendingPayment && (
                                    <Badge variant="outline" className="text-[10px] animate-pulse border-yellow-500 text-yellow-600 bg-yellow-50">
                                        Pago en revisión
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {subscription?.end_date && (
                            <div className="space-y-2">
                                {/* Cálculo de días */}
                                {(() => {
                                    if (!subscription) return null;
                                    const end = new Date(subscription.end_date!); // ! is safe because of parent check
                                    // Misma función que el banner de aviso de pago (SubscriptionWarningBanner)
                                    // — antes este cálculo usaba Math.ceil sobre la diferencia exacta en
                                    // milisegundos mientras el banner truncaba, así que podían mostrar
                                    // números distintos (ej. 6 vs 5) para la misma fecha de vencimiento.
                                    const daysLeft = getDaysRemaining(subscription.end_date);

                                    // La barra representa los últimos 30 días. 
                                    // Si quedan más de 30 días, está al 100% (verde). 
                                    // Si quedan menos, empieza a bajar progresivamente.
                                    const referenceDays = 30;
                                    const percentRemaining = Math.max(0, Math.min(100, (daysLeft / referenceDays) * 100));

                                    return (
                                        <>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-muted-foreground">Vence: {end.toLocaleDateString()}</span>
                                                <span className={`font-bold ${daysLeft <= 7 ? 'text-red-500' : 'text-primary'}`}>
                                                    {daysLeft > 0 ? `${daysLeft} días restantes` : 'Vencido'}
                                                </span>
                                            </div>
                                            <div className="h-2.5 w-full bg-background/50 rounded-full overflow-hidden border border-border">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${daysLeft <= 7 ? 'bg-red-500' : 'bg-green-500'
                                                        }`}
                                                    style={{ width: `${percentRemaining}%` }}
                                                />
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {!subscription?.end_date && (
                            <p className="text-xs text-muted-foreground">
                                Tu plan básico no tiene fecha de vencimiento.
                            </p>
                        )}

                        <Button className="w-full shadow-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold" onClick={() => {
                            if (currentPlanDetails.id === 'enterprise') {
                                window.open('https://wa.me/18099175744?text=Hola!%20Deseo%20contactar%20al%20soporte%20t%C3%A9cnico%20de%20CobroApp', '_blank');
                                return;
                            }
                            setIsSuccess(false);
                            setTargetPlan(null); // Reset target
                            setPaymentAmount(currentPlanDetails.price.toString());
                            setIsPaymentOpen(true);
                        }}>
                            <Wallet className="mr-2 h-4 w-4" />
                            {currentPlanDetails.id === 'enterprise' ? 'Contactar Soporte' : 'Reportar Pago / Renovar'}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Modal de Pagos */}
            <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden gap-0 bg-background border-border shadow-xl">
                    {isSuccess ? (
                        // VISTA DE ÉXITO ESTILIZADA
                        <div className="flex flex-col items-center justify-center py-10 px-6 text-center space-y-5 animate-in zoom-in-50 duration-300">
                            <div className="h-20 w-20 bg-orange-500/10 rounded-full flex items-center justify-center mb-2 animate-pulse">
                                <Loader2 className="h-10 w-10 text-orange-500" />
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-2xl font-bold text-foreground">¡Reportado!</h2>
                                <p className="text-muted-foreground">Tu comprobante está en espera de confirmación.</p>
                                <p className="text-xs text-muted-foreground font-medium mt-2">Te enviaremos un correo una vez validado.</p>
                            </div>
                            <Button onClick={() => window.location.reload()} className="w-full mt-4">
                                Entendido
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="bg-primary/5 border-b border-border p-5 flex flex-col items-center text-center relative">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold text-primary flex items-center justify-center gap-2">
                                        {targetPlan ? `Activar Plan ${targetPlanDetails?.name}` : 'Continuar Membresía'}
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground text-xs mt-1">
                                        Selecciona tu método de pago preferido
                                    </DialogDescription>
                                </DialogHeader>
                            </div>

                            <Tabs defaultValue="card" className="w-full">
                                <div className="px-5 pt-4">
                                    <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start h-11 bg-muted/50 p-1 sm:grid sm:grid-cols-3">
                                        <TabsTrigger value="card" className="flex items-center gap-2 text-xs">
                                            <CreditCard className="w-3.5 h-3.5" />
                                            Tarjeta
                                        </TabsTrigger>
                                        <TabsTrigger value="paypal" className="flex items-center gap-2 text-xs">
                                            <Wallet className="w-3.5 h-3.5" />
                                            PayPal
                                        </TabsTrigger>
                                        <TabsTrigger value="bank" className="flex items-center gap-2 text-xs">
                                            <Landmark className="w-3.5 h-3.5" />
                                            Transferencia
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                {/* TAB 1: CARD (PADDLE) */}
                                <TabsContent value="card" className="p-2 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                                    <div className="relative overflow-hidden bg-[#1c1d22] border border-white/5 rounded-2xl p-6 text-center shadow-2xl">
                                        {/* Background Glow */}
                                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/20 blur-[80px] rounded-full pointer-events-none" />
                                        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />
                                        
                                        <div className="relative z-10 flex flex-col items-center">
                                            {/* Icons */}
                                            <div className="flex justify-center gap-2 mb-5">
                                                <div className="h-10 w-14 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg flex items-center justify-center shadow-inner">
                                                    <svg className="h-4 text-white opacity-90" viewBox="0 0 38 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M14.502 11.233L16.892.427h3.818l-2.39 10.806h-3.818zm11.18-10.609c-1.077-.423-2.736-.889-4.739-.889-4.212 0-7.18 2.228-7.202 5.419-.023 2.362 2.146 3.673 3.774 4.465 1.673.814 2.234 1.336 2.234 2.062-.02 1.116-1.349 1.62-2.593 1.62-1.748 0-2.695-.272-4.127-.923l-.58-.27-1.12 5.093c1.078.498 3.064.927 5.143.953 4.492 0 7.41-2.197 7.433-5.597.022-1.895-1.127-3.336-3.6-4.505-1.503-.772-2.42-1.284-2.42-2.068 0-.712.809-1.464 2.464-1.464 1.412-.023 2.457.29 3.238.65l.39.18 1.125-5.118zm10.74 10.609l-3.612-9.673c-.27-.687-.852-1.034-1.554-1.133h-6.7l-.105.485c1.298.272 2.766.777 3.682 1.348l-3.14 8.973h4.032l.805-2.224h4.925l.47 2.224h3.197zm-5.717-5.32l1.986-5.417 1.143 5.418h-3.13zM6.91 11.233l-2.78-7.502L2.946.804A1.674 1.674 0 0 0 1.378 0H.02L0 .093c2.723.687 5.795 1.956 7.643 3.447l1.196-3.113h4.1l-6.03 10.806H6.91z" />
                                                    </svg>
                                                </div>
                                                <div className="h-10 w-14 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg flex items-center justify-center shadow-inner">
                                                    <svg className="h-6" viewBox="0 0 36 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <circle cx="11.25" cy="11.25" r="11.25" fill="#EB001B"/>
                                                        <circle cx="24.75" cy="11.25" r="11.25" fill="#F79E1B"/>
                                                        <path fillRule="evenodd" clipRule="evenodd" d="M18 17.58A11.25 11.25 0 0 1 18 4.92a11.25 11.25 0 0 1 0 12.66Z" fill="#FF5F00"/>
                                                    </svg>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-1.5 mb-6">
                                                <h3 className="text-lg font-bold text-white tracking-tight flex items-center justify-center gap-2">
                                                    Pago Seguro
                                                </h3>
                                                <p className="text-[12px] text-zinc-400 max-w-[240px] mx-auto leading-relaxed">
                                                    Cifrado de grado bancario. Tu suscripción se activará al instante.
                                                </p>
                                            </div>

                                            <div className="w-full bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col items-center mb-6">
                                                <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-1">Total a Pagar</span>
                                                <span className="text-3xl font-black text-white tracking-tighter">
                                                    ${displayAmount.toLocaleString()} {effectivePlanDetails.currency || 'USD'}
                                                </span>
                                            </div>

                                            <Button 
                                                className="w-full bg-white text-black hover:bg-zinc-200 font-bold h-12 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:scale-[1.02] active:scale-[0.98] group"
                                                onClick={handlePaddleCheckout}
                                                disabled={isProcessing}
                                            >
                                                {isProcessing ? (
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                ) : (
                                                    <>
                                                        <ShieldCheck className="w-4 h-4 mr-2 group-hover:text-emerald-600 transition-colors" />
                                                        Ingresar Tarjeta
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1 mt-2">
                                        <ShieldCheck className="h-3 w-3" /> Conexión cifrada de 256 bits
                                    </p>
                                </TabsContent>

                                {/* TAB 2: PAYPAL */}
                                <TabsContent value="paypal" className="p-5 space-y-4 animate-in slide-in-from-right-2 transition-all">
                                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-100 rounded-xl p-5 text-center space-y-4 shadow-sm">
                                        <div className="flex justify-center">
                                            <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" className="h-6" alt="PayPal" />
                                        </div>
                                        
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-orange-900">Botones de Pago PayPal</h3>
                                            <p className="text-[11px] text-orange-700/70">Usa tu saldo PayPal o tarjeta vinculada para activar tu membresía.</p>
                                        </div>

                                        <div className="bg-white/80 p-3 rounded-lg border border-orange-200/50 flex flex-col items-center">
                                            <span className="text-2xl font-black text-orange-900">${displayAmount.toLocaleString()} {effectivePlanDetails.currency || 'USD'}</span>
                                            <span className="text-[10px] text-muted-foreground font-medium">TOTAL A PAGAR</span>
                                        </div>

                                        <Button 
                                            className="w-full bg-[#0070ba] hover:bg-[#005ea6] text-white font-bold h-11 shadow-lg"
                                            onClick={() => activatePlanAutomated('paypal')}
                                            disabled={isProcessing}
                                        >
                                            {isProcessing ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                "Pagar con PayPal"
                                            )}
                                        </Button>
                                    </div>
                                </TabsContent>

                                {/* TAB 3: TRANSFERENCIA (EXISTING LOGIC) */}
                                <TabsContent value="bank" className="p-5 space-y-5 animate-in slide-in-from-bottom-2 transition-all">
                                    {/* Instrucciones de Banco */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold italic">i</span>
                                            Cuentas Bancarias
                                        </Label>
                                        <div className="grid grid-cols-1 gap-2">
                                            <div className="bg-card border border-border rounded-lg p-3 shadow-sm hover:border-primary/30 transition-all group">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="text-xs font-bold text-foreground">BANRESERVAS</p>
                                                        <p className="text-[11px] text-muted-foreground">Ahorros: <span className="font-mono font-bold text-foreground">9600-00000-0</span></p>
                                                        <p className="text-[10px] text-muted-foreground">Titular: Harold Rosado</p>
                                                    </div>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { navigator.clipboard.writeText("9600000000"); toast({ description: "Copiado!" }); }}><Upload className="h-3 w-3 rotate-90"/></Button>
                                                </div>
                                            </div>
                                            <div className="bg-card border border-border rounded-lg p-3 shadow-sm hover:border-primary/30 transition-all group">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="text-xs font-bold text-foreground">BANCO POPULAR</p>
                                                        <p className="text-[11px] text-muted-foreground">Ahorros: <span className="font-mono font-bold text-foreground">800-00000-0</span></p>
                                                        <p className="text-[10px] text-muted-foreground">Titular: Harold Rosado</p>
                                                    </div>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { navigator.clipboard.writeText("8000000000"); toast({ description: "Copiado!" }); }}><Upload className="h-3 w-3 rotate-90"/></Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Reporte de Comprobante */}
                                    <div className="space-y-3 pt-2 border-t border-dashed border-border mt-4">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold italic">2</span>
                                            Reportar Comprobante
                                        </Label>

                                        <div className="grid grid-cols-5 gap-3">
                                            <div className="col-span-2 space-y-1.5">
                                                <Label className="text-[10px] font-medium text-muted-foreground">Monto RD$</Label>
                                                <div className="relative">
                                                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                    <Input
                                                        className="pl-8 h-9 text-sm font-medium"
                                                        type="number"
                                                        value={paymentAmount}
                                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <div className="col-span-3 space-y-1.5">
                                                <Label className="text-[10px] font-medium text-muted-foreground">Recibo / Captura</Label>
                                                <div className="relative border border-dashed border-input hover:border-primary/50 hover:bg-muted/50 transition-colors rounded-md h-9 overflow-hidden cursor-pointer flex items-center px-3 group bg-background">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                                        onChange={handleProofUpload}
                                                    />
                                                    {paymentProof ? (
                                                        <div className="flex items-center gap-2 truncate w-full">
                                                            <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                                            <span className="text-xs text-foreground font-medium truncate">{paymentProof.name}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-muted-foreground/70 group-hover:text-primary/80">
                                                            <Upload className="h-3.5 w-3.5" />
                                                            <span className="text-xs">Adjuntar Foto</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            className="w-full h-10 font-bold shadow-sm mt-2"
                                            onClick={submitPaymentReport}
                                            disabled={isProcessing}
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Enviando Informe...
                                                </>
                                            ) : (
                                                <>
                                                    Notificar Transferencia
                                                    <Check className="ml-2 h-4 w-4" />
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Planes y Precios Grid */}
            <div className="text-center mt-12 mb-8">
                <h2 className="text-2xl font-black uppercase tracking-widest mb-6">
                    Planes Disponibles
                </h2>
                
                <div className="flex items-center justify-center gap-3">
                    <span className={`text-sm font-medium ${!isAnnual ? 'text-white' : 'text-slate-400'}`}>Pago Mensual</span>
                    <button 
                        onClick={() => setIsAnnual(!isAnnual)}
                        className="w-14 h-7 bg-emerald-500 rounded-full relative transition-colors focus:outline-none"
                    >
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${isAnnual ? 'left-8' : 'left-1'}`} />
                    </button>
                    <span className={`text-sm font-medium flex items-center gap-1 ${isAnnual ? 'text-white' : 'text-slate-400'}`}>
                        Pago Anual <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">(Ahorra hasta 17%)</span>
                    </span>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto px-2">
                {plans.map((plan) => {
                    const isBasic = plan.id === 'basic';
                    const isPro = plan.id === 'pro';
                    const isEnterprise = plan.id === 'enterprise';

                    return (
                        <div
                            key={plan.id}
                            className={`relative rounded-3xl border flex flex-col justify-between p-7 transition-all duration-300 ${
                                isPro
                                    ? 'bg-[#0bb274] border-0 text-emerald-950 shadow-2xl scale-[1.03] md:-mt-2 md:z-10 min-h-[500px]'
                                    : 'bg-[#1a1b1e] border-zinc-800 text-white shadow-xl min-h-[500px]'
                            }`}
                        >
                            {/* Star badge for pro (Negocio) */}
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Badge className="bg-amber-300 text-emerald-950 hover:bg-amber-300 px-4 py-1.5 font-black uppercase text-[10px] tracking-widest rounded-full shadow-lg border-0">
                                        EL MÁS POPULAR
                                    </Badge>
                                </div>
                            )}

                            <div>
                                {/* Header with Plan Name and Icon */}
                                <div className="flex items-center gap-2 mb-3 mt-2">
                                    {isBasic && (
                                        <>
                                            <Leaf className="h-6 w-6 text-emerald-500 fill-emerald-500/20" />
                                            <h3 className="text-xl font-black tracking-tight text-white">
                                                Plan {plan.name}
                                            </h3>
                                        </>
                                    )}
                                    {isPro && (
                                        <>
                                            <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                                            <h3 className="text-xl font-black tracking-tight text-emerald-950">
                                                Plan {plan.name}
                                            </h3>
                                        </>
                                    )}
                                    {isEnterprise && (
                                        <>
                                            <Building2 className="h-6 w-6 text-blue-400 fill-blue-400/20" />
                                            <h3 className="text-xl font-black tracking-tight text-white">
                                                Plan {plan.name}
                                            </h3>
                                        </>
                                    )}
                                </div>

                                <p
                                    className={`text-sm mb-6 ${
                                        isPro ? 'text-emerald-900/90 font-medium' : 'text-zinc-400'
                                    }`}
                                >
                                    {plan.description}
                                </p>

                                {/* Pricing block */}
                                {isEnterprise ? (
                                    <div className="flex items-baseline mb-8">
                                        <span className="text-3xl font-black tracking-tight text-white">
                                            {plan.priceDisplay}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1 mb-8">
                                        <div className="flex items-baseline gap-1.5">
                                            <span
                                                className={`text-4xl font-black tracking-tighter ${
                                                    isPro ? 'text-emerald-950' : 'text-white'
                                                }`}
                                            >
                                                {isAnnual ? plan.annualPriceDisplay : plan.priceDisplay}
                                            </span>
                                            <span
                                                className={`text-sm font-bold uppercase tracking-wider ${
                                                    isPro ? 'text-emerald-900/60' : 'text-zinc-500'
                                                }`}
                                            >
                                                USD / mes
                                            </span>
                                        </div>
                                        {isAnnual && (
                                            <div className="mt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <span className={`inline-block text-xs font-bold px-2 py-1 rounded-full ${isPro ? 'bg-emerald-950 text-emerald-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                    Pago único de ${plan.annualPrice} USD
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Features List */}
                                <ul className="space-y-3.5 w-full text-[13px] mb-8">
                                    {plan.features.map((feature, i) => (
                                        <li
                                            key={i}
                                            className={`flex items-start gap-3 ${
                                                feature.included
                                                    ? isPro
                                                        ? 'text-emerald-950 font-medium'
                                                        : 'text-zinc-100'
                                                    : isPro
                                                    ? 'text-emerald-900/40 opacity-40 font-medium'
                                                    : 'text-zinc-500 opacity-30'
                                            }`}
                                        >
                                            {feature.included ? (
                                                <div
                                                    className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                                                        isPro
                                                            ? 'bg-emerald-950/20 border-emerald-950/30'
                                                            : 'bg-emerald-500/20 border-emerald-500/30'
                                                    }`}
                                                >
                                                    <Check
                                                        className={`h-3.5 w-3.5 ${
                                                            isPro ? 'text-emerald-950' : 'text-emerald-400'
                                                        }`}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="h-5 w-5 flex items-center justify-center shrink-0 mt-0.5">
                                                    <X
                                                        className={`h-3.5 w-3.5 ${
                                                            isPro ? 'text-emerald-900/30' : 'text-zinc-700'
                                                        }`}
                                                    />
                                                </div>
                                            )}
                                            <span className="leading-tight">{feature.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* CTA Action Buttons */}
                            {isEnterprise ? (
                                <div className="space-y-2.5 w-full mt-auto">
                                    <Button
                                        className="w-full h-11 bg-[#10b981] hover:bg-[#0bb274] text-white font-bold rounded-xl flex items-center justify-center gap-2 border-0 shadow-lg shadow-emerald-500/10 transition-all active:scale-[0.98]"
                                        onClick={() =>
                                            window.open(
                                                'https://wa.me/18099175744?text=Hola!%20Estoy%20interesado%20en%20el%20Plan%20Corporativo%20de%20Cobroapp',
                                                '_blank'
                                            )
                                        }
                                    >
                                        <MessageSquare className="h-4 w-4 fill-white" />
                                        Contactar por WhatsApp
                                    </Button>
                                    <Button
                                        className="w-full h-11 bg-zinc-800 hover:bg-[#2c2e33] text-white font-bold rounded-xl flex items-center justify-center gap-2 border border-zinc-700 transition-all active:scale-[0.98]"
                                        onClick={() =>
                                            window.open(
                                                'mailto:haroldrospa@gmail.com?subject=Inter%C3%A9s%20en%20Plan%20Corporativo%20-%20CobroApp',
                                                '_blank'
                                            )
                                        }
                                    >
                                        <Mail className="h-4 w-4" />
                                        Escribir por Correo
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    className={`w-full h-11 font-bold rounded-xl transition-all active:scale-[0.98] ${
                                        activePlan === plan.id
                                            ? isPro
                                                ? 'bg-emerald-800/20 text-emerald-800 border-0 cursor-not-allowed opacity-60'
                                                : 'bg-zinc-800 border-zinc-700 text-zinc-400 cursor-not-allowed'
                                            : isPro
                                            ? 'bg-white text-emerald-950 hover:bg-emerald-50 border-0 shadow-lg shadow-emerald-950/10'
                                            : 'bg-[#25262b] border-zinc-800 hover:bg-[#2c2e33] text-white border'
                                    }`}
                                    disabled={activePlan === plan.id}
                                    onClick={() => handleSelectPlan(plan)}
                                >
                                    {activePlan === plan.id ? 'Plan Actual' : (plan.id === 'enterprise' ? 'Contactar Soporte' : 'Empezar Prueba')}
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>

        </div>
    );
};

export default UserSubscription;
