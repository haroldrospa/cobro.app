import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserStore } from '@/hooks/useUserStore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, Wallet, Loader2, Upload, DollarSign, CreditCard, ShieldCheck, Landmark, User } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useCompanySettings } from '@/hooks/useCompanySettings';

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

    // Estado para reporte de pago manual
    const [paymentProof, setPaymentProof] = useState<File | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');

    const plans = [
        {
            id: 'basic',
            name: 'Emprendedor',
            price: 1500,
            currency: 'DOP',
            period: 'mes',
            description: 'Perfecto para negocios que inician',
            features: [
                '2 Usuarios',
                'Hasta 100 productos',
                '250 Facturas/mes',
                'Soporte por email'
            ],
            popular: false
        },
        {
            id: 'pro',
            name: 'Profesional',
            price: 3000,
            currency: 'DOP',
            period: 'mes',
            description: 'Para negocios en expansión',
            features: [
                '3 Usuarios',
                '1,000 productos',
                'Facturación Ilimitada',
                'Reportes avanzados',
                'Módulo de Gastos'
            ],
            popular: true
        },
        {
            id: 'enterprise',
            name: 'Empresarial',
            price: 6000,
            currency: 'DOP',
            period: 'mes',
            description: 'Control total sin límites',
            features: [
                '10 Usuarios',
                'Productos Ilimitados',
                'Múltiples Sucursales',
                'API Access',
                'Soporte Prioritario VIP'
            ],
            popular: false
        }
    ];

    const currentPlanDetails = plans.find(p => p.id === activePlan) || plans[0];
    const targetPlanDetails = plans.find(p => p.id === targetPlan);

    const handleSelectPlan = (plan: typeof plans[0]) => {
        setIsSuccess(false); // Reset por si acaso
        setTargetPlan(plan.id);
        setPaymentAmount(plan.price.toString());
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

    // NUEVA FUNCIÓN: Activación automatizada (Stripe / PayPal)
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
                                    const start = subscription.start_date ? new Date(subscription.start_date) : new Date();
                                    const end = new Date(subscription.end_date!); // ! is safe because of parent check
                                    const now = new Date();
                                    const total = end.getTime() - start.getTime();
                                    const remaining = end.getTime() - now.getTime();
                                    const daysLeft = Math.ceil(remaining / (1000 * 60 * 60 * 24));
                                    // Progress bar logic: Full (100%) when new, Empty (0%) when expired.
                                    const percentRemaining = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

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

                        <Button className="w-full shadow-md" onClick={() => {
                            setIsSuccess(false);
                            setTargetPlan(null); // Reset target
                            setPaymentAmount(currentPlanDetails.price.toString());
                            setIsPaymentOpen(true);
                        }}>
                            <Wallet className="mr-2 h-4 w-4" />
                            Reportar Pago / Renovar
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
                                    <TabsList className="grid w-full grid-cols-3 h-11 bg-muted/50 p-1">
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

                                {/* TAB 1: CARD (STRIPE) */}
                                <TabsContent value="card" className="p-5 space-y-4 animate-in slide-in-from-left-2 transition-all">
                                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5 text-center space-y-4 shadow-sm">
                                        <div className="flex justify-center gap-3">
                                            <div className="h-8 w-12 bg-white rounded border flex items-center justify-center shadow-sm">
                                                <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" className="h-4" alt="Visa" />
                                            </div>
                                            <div className="h-8 w-12 bg-white rounded border flex items-center justify-center shadow-sm">
                                                <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" className="h-5" alt="Mastercard" />
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-blue-900">Pago Seguro con Stripe</h3>
                                            <p className="text-[11px] text-blue-700/70">Tu pago será procesado de forma segura y tu cuenta se activará al instante.</p>
                                        </div>

                                        <div className="bg-white/80 p-3 rounded-lg border border-blue-200/50 flex flex-col items-center">
                                            <span className="text-2xl font-black text-blue-900">RD${parseFloat(paymentAmount).toLocaleString()}</span>
                                            <span className="text-[10px] text-muted-foreground font-medium">TOTAL A PAGAR</span>
                                        </div>

                                        <Button 
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 shadow-lg"
                                            onClick={() => activatePlanAutomated('stripe')}
                                            disabled={isProcessing}
                                        >
                                            {isProcessing ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <>
                                                    <ShieldCheck className="mr-2 h-5 w-5" />
                                                    Pagar con Tarjeta
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
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
                                            <span className="text-2xl font-black text-orange-900">RD${parseFloat(paymentAmount).toLocaleString()}</span>
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
            <h2 className="text-xl font-bold mt-8">Planes Disponibles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => (
                    <Card
                        key={plan.id}
                        className={`relative flex flex-col ${activePlan === plan.id
                            ? 'border-primary ring-2 ring-primary/20 shadow-lg scale-[1.02] md:-mt-2 bg-gradient-to-b from-card to-primary/5'
                            : 'border-border hover:border-primary/50 transition-colors'
                            }`}
                    >
                        {plan.popular && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <Badge className="bg-primary text-primary-foreground hover:bg-primary px-3 py-1">
                                    MÁS POPULAR
                                </Badge>
                            </div>
                        )}

                        <CardHeader className="text-center pb-2">
                            <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                            <CardDescription>{plan.description}</CardDescription>
                        </CardHeader>

                        <CardContent className="flex-1 flex flex-col items-center">
                            <div className="text-3xl font-bold mb-6 mt-2">
                                RD${plan.price.toLocaleString()}
                                <span className="text-sm font-normal text-muted-foreground">/{plan.period}</span>
                            </div>

                            <ul className="space-y-3 w-full text-sm">
                                {plan.features.map((feature, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <Check className="h-3 w-3 text-primary" />
                                        </div>
                                        <span className="text-muted-foreground">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>

                        <CardFooter className="pt-2">
                            <Button
                                className="w-full"
                                variant={activePlan === plan.id ? "secondary" : "default"}
                                disabled={activePlan === plan.id}
                                onClick={() => handleSelectPlan(plan)}
                            >
                                {activePlan === plan.id ? 'Plan Actual' : 'Seleccionar Plan'}
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

        </div>
    );
};

export default UserSubscription;
