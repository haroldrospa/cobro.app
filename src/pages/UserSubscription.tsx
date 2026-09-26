import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserStore } from '@/hooks/useUserStore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, Wallet, Loader2, Upload, DollarSign, CreditCard, ShieldCheck, Landmark, User, Leaf, Star, Building2, X, MessageSquare, Mail, Copy, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

    const [isBankModalOpen, setIsBankModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false); // Estado para pantalla de éxito
    const [isAnnual, setIsAnnual] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

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
            setIsBankModalOpen(true);
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
        setIsBankModalOpen(true);
    };

    const handleCopy = (text: string, fieldId: string, label: string) => {
        try {
            if (navigator?.clipboard?.writeText) {
                navigator.clipboard.writeText(text);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand("copy");
                document.body.removeChild(textArea);
            }
            setCopiedField(fieldId);
            setTimeout(() => setCopiedField(null), 2500);
            toast({
                title: "¡Copiado al portapapeles!",
                description: `${label}: ${text}`,
            });
        } catch (e) {
            toast({
                title: "Copia manual requerida",
                description: `Por favor copia: ${text}`,
                variant: "destructive"
            });
        }
    };

    const handleWhatsAppNotification = () => {
        const planNameToReport = targetPlanDetails?.name || currentPlanDetails?.name || 'Suscripción';
        const msg = encodeURIComponent(
            `¡Hola Harold! Acabo de realizar una transferencia bancaria en Banreservas para CobroApp.\n\n` +
            `🏪 Tienda: ${store?.store_name || 'Mi Tienda'} (${store?.store_code || 'S/C'})\n` +
            `👤 Titular/Usuario: ${profile?.full_name || 'Usuario'}\n` +
            `📦 Plan: ${planNameToReport}\n` +
            `💰 Monto: RD$ ${paymentAmount || '---'}\n\n` +
            `Adjunto mi comprobante por este medio para su confirmación. ¡Muchas gracias!`
        );
        window.open(`https://wa.me/18099175744?text=${msg}`, '_blank');
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
                description: "Por favor adjunte el comprobante de la transferencia y el monto.",
                variant: 'destructive'
            });
            return;
        }

        setIsProcessing(true);

        console.log('🔍 [DEBUG] Iniciando proceso de pago Banreservas...');
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

            // 2. REPORTAR PAGO PENDIENTE (Banreservas)
            const { data: rpcData, error: rpcError } = await supabase.rpc('submit_payment_pending', {
                p_company_id: store?.id,
                p_amount: parseFloat(paymentAmount),
                p_currency: 'DOP',
                p_bank_name: 'Banreservas',
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
                        planName: targetPlanDetails?.name || currentPlanDetails?.name || 'Suscripción',
                        amount: parseFloat(paymentAmount),
                        userName: profile?.full_name || 'Usuario',
                        proofUrl: filePath,
                        bankName: 'Banreservas'
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
                title: "¡Comprobante Recibido!",
                description: "Comprobante de Banreservas recibido. Tu pago está en validación.",
                duration: 5000
            });

        } catch (error: any) {
            console.error('❌ [ERROR COMPLETO]:', error);
            toast({
                title: "Error al registrar comprobante",
                description: error.message || "Hubo un problema. Intente nuevamente.",
                variant: 'destructive'
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const renderBanreservasBankCard = () => (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-stretch">
            {/* COLUMNA 1: DATOS BANCARIOS (BANRESERVAS) */}
            <div className="md:col-span-7 bg-card/95 border border-emerald-500/30 rounded-xl p-3 sm:p-3.5 shadow-sm space-y-2 relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />

                {/* Encabezado del Banco */}
                <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-inner shrink-0">
                            <Landmark className="h-3.5 w-3.5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h3 className="font-bold text-foreground text-xs sm:text-sm leading-none">
                                    Banco de Reservas
                                </h3>
                                <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold px-1.5 py-0 border-0 h-4">
                                    DOP
                                </Badge>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-medium">
                                Cuenta de ahorro en Pesos Dominicanos
                            </span>
                        </div>
                    </div>
                </div>

                {/* NÚMERO DE CUENTA PRINCIPAL (MÁS IMPORTANTE - DESTACADO) */}
                <div className="bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 border border-emerald-500/30 rounded-lg p-2 flex items-center justify-between shadow-sm">
                    <div className="space-y-0.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                            Número de Cuenta
                        </span>
                        <p className="font-mono text-lg sm:text-xl font-black text-foreground tracking-tight select-all leading-none">
                            9601938364
                        </p>
                    </div>
                    <Button
                        size="sm"
                        className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-md shadow-sm gap-1 text-[11px] transition-all shrink-0"
                        onClick={() => handleCopy('9601938364', 'num_cuenta', 'Número de cuenta')}
                    >
                        {copiedField === 'num_cuenta' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedField === 'num_cuenta' ? 'Copiado' : 'Copiar'}</span>
                    </Button>
                </div>

                {/* FILAS DE INFORMACIÓN COMPACTAS */}
                <div className="space-y-1.5 text-xs">
                    {/* Titular */}
                    <div className="bg-muted/40 px-2 py-1 rounded-md border border-border/60 flex items-center justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-medium text-muted-foreground block leading-tight">Titular</span>
                            <span className="font-bold text-foreground text-xs truncate block select-all leading-tight">
                                HAROLD MANUEL ROSADO PACHECO
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => handleCopy('HAROLD MANUEL ROSADO PACHECO', 'titular', 'Nombre del titular')}
                            title="Copiar Titular"
                        >
                            {copiedField === 'titular' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                    </div>

                    {/* Cédula y Correo en 2 columnas */}
                    <div className="grid grid-cols-2 gap-1.5">
                        <div className="bg-muted/40 px-2 py-1 rounded-md border border-border/60 flex items-center justify-between gap-1">
                            <div className="min-w-0 flex-1">
                                <span className="text-[9px] font-medium text-muted-foreground block leading-tight">Cédula</span>
                                <span className="font-mono font-bold text-foreground text-[11px] truncate block select-all leading-tight">
                                    40218246656
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={() => handleCopy('40218246656', 'cedula', 'Documento de identidad')}
                                title="Copiar Cédula"
                            >
                                {copiedField === 'cedula' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                        </div>

                        <div className="bg-muted/40 px-2 py-1 rounded-md border border-border/60 flex items-center justify-between gap-1">
                            <div className="min-w-0 flex-1">
                                <span className="text-[9px] font-medium text-muted-foreground block leading-tight">Correo</span>
                                <span className="font-medium text-foreground text-[11px] truncate block select-all leading-tight">
                                    haroldrospa@gmail.com
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={() => handleCopy('haroldrospa@gmail.com', 'correo', 'Correo')}
                                title="Copiar Correo"
                            >
                                {copiedField === 'correo' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                        </div>
                    </div>

                    {/* Cuenta estándar ACH */}
                    <div className="bg-muted/40 px-2 py-1 rounded-md border border-border/60 flex items-center justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-medium text-muted-foreground block leading-tight">
                                Cuenta Estándar (ACH / Interbancaria)
                            </span>
                            <span className="font-mono font-bold text-[10.5px] text-foreground truncate block select-all leading-tight">
                                DO36BRRD00000000009601938364
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => handleCopy('DO36BRRD00000000009601938364', 'iban', 'Cuenta estándar')}
                            title="Copiar Cuenta Estándar"
                        >
                            {copiedField === 'iban' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                    </div>

                    {/* SWIFT */}
                    <div className="bg-muted/30 px-2 py-1 rounded-md border border-dashed border-border/80 flex items-center justify-between gap-1.5">
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase">
                                SWIFT:
                            </span>
                            <span className="font-mono font-bold text-xs text-foreground select-all">
                                BRRDDOSDXXX
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => handleCopy('BRRDDOSDXXX', 'swift', 'Código SWIFT')}
                            title="Copiar SWIFT"
                        >
                            {copiedField === 'swift' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* COLUMNA 2: FORMULARIO DE REPORTE */}
            <div className="md:col-span-5 bg-card/95 border border-border rounded-xl p-3 sm:p-3.5 shadow-sm flex flex-col justify-between space-y-2.5 h-full">
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                        <div className="flex items-center gap-1.5">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black">
                                2
                            </span>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                Reportar Pago
                            </h4>
                        </div>
                        {targetPlan && (
                            <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-500 py-0 px-1.5 h-4">
                                {targetPlanDetails?.name}
                            </Badge>
                        )}
                    </div>

                    <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground">Monto Transferido (RD$)</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                className="pl-7 h-8 text-xs font-semibold rounded-md"
                                type="number"
                                placeholder="Ej: 1000"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground">Comprobante o Captura</Label>
                        <div className="relative border border-dashed border-input hover:border-emerald-500/50 hover:bg-muted/50 transition-colors rounded-md h-8 overflow-hidden cursor-pointer flex items-center px-2 group bg-background">
                            <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                onChange={handleProofUpload}
                            />
                            {paymentProof ? (
                                <div className="flex items-center gap-1.5 truncate w-full">
                                    <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                                    <span className="text-[11px] text-foreground font-semibold truncate">{paymentProof.name}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-emerald-500 transition-colors">
                                    <Upload className="h-3 w-3 shrink-0" />
                                    <span className="text-[10.5px] font-medium truncate">Adjuntar Foto o Recibo</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-1.5 pt-1">
                    <Button
                        className="w-full h-8 font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md shadow-sm gap-1.5 text-xs transition-all"
                        onClick={submitPaymentReport}
                        disabled={isProcessing}
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Enviando...</span>
                            </>
                        ) : (
                            <>
                                <Check className="h-3 w-3" />
                                <span>Notificar Transferencia</span>
                            </>
                        )}
                    </Button>

                    <Button
                        variant="outline"
                        type="button"
                        className="w-full h-7 font-semibold rounded-md border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1.5 text-[11px]"
                        onClick={handleWhatsAppNotification}
                    >
                        <MessageSquare className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span>Avisar por WhatsApp</span>
                    </Button>
                </div>
            </div>
        </div>
    );

    if (loadingProfile) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-7xl animate-fade-in space-y-8">
            {/* Header del Módulo Plan y Usuario */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-5">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
                        <User className="h-7 w-7 text-emerald-500" />
                        Plan y Usuario
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        Administra la suscripción de tu negocio, datos de tu cuenta y opciones de pago
                    </p>
                </div>
            </div>

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

                <div className="flex-1 min-w-0 space-y-1">
                    <h1 className="text-2xl font-bold truncate">{store?.store_name || 'Mi Negocio'}</h1>
                    <div className="flex flex-col gap-1">
                        <p className="text-muted-foreground text-sm font-medium">Tienda: {store?.store_code || '---'}</p>
                        <div className="flex flex-col gap-0.5 mt-1 p-2 bg-muted/30 rounded-lg border border-border/50">
                            <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                                <User className="h-3 w-3 text-primary shrink-0" />
                                <span className="truncate">Usuario: {profile?.full_name || '---'}</span>
                            </p>
                            <p className="text-[10px] font-mono text-muted-foreground select-all truncate">
                                ID: {companySettings?.rnc || profile?.rnc || profile?.user_number || '---'}
                            </p>
                        </div>
                    </div>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 mt-2">
                        Plan {currentPlanDetails.name}
                    </Badge>
                </div>

                <Card className="w-full md:w-80 lg:w-[350px] shrink-0 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-md">
                    <CardContent className="p-4 sm:p-5 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-foreground">Estado de Cuenta</span>
                            <div className="flex flex-col items-end gap-1">
                                <Badge className={subscription?.status === 'active' ? 'bg-green-500 font-bold' : 'bg-gray-500 font-bold'}>
                                    {subscription?.status === 'active' ? 'Activo' : 'Inactivo'}
                                </Badge>
                                {pendingPayment && (
                                    <Badge variant="outline" className="text-[10px] animate-pulse border-yellow-500 text-yellow-600 bg-yellow-50 font-semibold">
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
                                    const daysLeft = getDaysRemaining(subscription.end_date);
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

                        <div className="space-y-2 pt-1">
                            <Button 
                                className="w-full shadow-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-auto min-h-11 py-2.5 px-3 flex items-center justify-center gap-2 rounded-xl transition-all text-xs sm:text-sm text-center leading-tight whitespace-normal break-words"
                                onClick={() => {
                                    setIsSuccess(false);
                                    setTargetPlan(activePlan);
                                    const defaultAmt = currentPlanDetails.price > 0 
                                        ? (isAnnual ? currentPlanDetails.annualPrice : currentPlanDetails.price).toString() 
                                        : '17';
                                    setPaymentAmount(defaultAmt);
                                    setIsBankModalOpen(true);
                                }}
                            >
                                <Landmark className="h-4 w-4 shrink-0" />
                                <span className="text-center font-bold">
                                    Pagar con Transferencia Banreservas
                                </span>
                            </Button>

                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full text-xs font-semibold h-9 px-3 rounded-xl text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 flex items-center justify-center gap-1.5"
                                onClick={() => window.open('https://wa.me/18099175744?text=Hola!%20Deseo%20informaci%C3%B3n%20sobre%20el%20pago%20de%20mi%20suscripci%C3%B3n%20CobroApp', '_blank')}
                                title="Soporte WhatsApp"
                            >
                                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                                <span>Soporte por WhatsApp</span>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Modal Exclusivo de Transferencia Banreservas */}
            <Dialog open={isBankModalOpen} onOpenChange={setIsBankModalOpen}>
                <DialogContent className="w-[96vw] sm:max-w-[720px] md:max-w-[760px] p-0 overflow-hidden gap-0 bg-background border-border shadow-2xl max-h-[96vh] flex flex-col">
                    {isSuccess ? (
                        <div className="flex flex-col items-center justify-center py-8 px-6 text-center space-y-4 animate-in zoom-in-50 duration-300">
                            <div className="h-16 w-16 bg-emerald-500/15 rounded-full flex items-center justify-center mb-1">
                                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                            </div>
                            <div className="space-y-1 max-w-sm">
                                <h2 className="text-xl font-black text-foreground">¡Comprobante Recibido!</h2>
                                <p className="text-xs text-muted-foreground">Tu transferencia a Banreservas ha sido reportada exitosamente.</p>
                                <p className="text-[11px] text-muted-foreground font-medium pt-0.5">
                                    Revisaremos el comprobante y activaremos tu plan a la mayor brevedad.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full mt-2 max-w-xs">
                                <Button 
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 text-xs"
                                    onClick={handleWhatsAppNotification}
                                >
                                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Enviar por WhatsApp
                                </Button>
                                <Button 
                                    variant="outline"
                                    className="h-9 text-xs"
                                    onClick={() => {
                                        setIsBankModalOpen(false);
                                        window.location.reload();
                                    }}
                                >
                                    Cerrar
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="bg-emerald-500/10 border-b border-border px-4 py-2 sm:px-5 sm:py-2.5 flex flex-col items-center text-center relative shrink-0">
                                <DialogHeader>
                                    <DialogTitle className="text-sm sm:text-base font-black text-foreground flex items-center justify-center gap-1.5">
                                        <Landmark className="h-4 w-4 text-emerald-500" />
                                        {targetPlan ? `Activar Plan ${targetPlanDetails?.name || ''} - Banreservas` : 'Transferencia Bancaria Banreservas'}
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground text-[10.5px] sm:text-xs mt-0.5">
                                        Transfiere desde tu banca en línea o cajero y notifica tu pago
                                    </DialogDescription>
                                </DialogHeader>
                            </div>

                            <div className="p-3 sm:p-4 overflow-y-auto">
                                {renderBanreservasBankCard()}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Banner Destacado Banreservas */}
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
                <div className="flex items-start sm:items-center gap-3.5">
                    <div className="h-11 w-11 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 shadow-inner">
                        <Landmark className="h-6 w-6" />
                    </div>
                    <div>
                        <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                            Pago directo por Transferencia Banreservas
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] uppercase font-bold">
                                Oficial RD
                            </Badge>
                        </h4>
                        <p className="text-xs text-zinc-300 mt-0.5">
                            Transfiere a nuestra cuenta de Banreservas en pesos dominicanos (DOP) para renovar o activar tu membresía.
                        </p>
                    </div>
                </div>
                <Button 
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-4 sm:px-5 h-auto min-h-10 py-2.5 rounded-xl shadow-md w-full md:w-auto shrink-0 transition-transform active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm text-center leading-tight whitespace-normal"
                    onClick={() => {
                        setIsSuccess(false);
                        setTargetPlan(activePlan);
                        const defaultAmt = currentPlanDetails.price > 0 
                            ? (isAnnual ? currentPlanDetails.annualPrice : currentPlanDetails.price).toString() 
                            : '17';
                        setPaymentAmount(defaultAmt);
                        setIsBankModalOpen(true);
                    }}
                >
                    <Landmark className="h-4 w-4 shrink-0" />
                    <span>Pagar con Transferencia Banreservas</span>
                </Button>
            </div>

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
                                        className="w-full h-auto min-h-11 py-2 px-3 bg-zinc-800 hover:bg-[#2c2e33] text-white font-bold rounded-xl flex items-center justify-center gap-2 border border-zinc-700 transition-all active:scale-[0.98] text-xs sm:text-sm text-center leading-tight whitespace-normal"
                                        onClick={() => {
                                            setIsSuccess(false);
                                            setTargetPlan('enterprise');
                                            setPaymentAmount('');
                                            setIsBankModalOpen(true);
                                        }}
                                    >
                                        <Landmark className="h-4 w-4 shrink-0" />
                                        <span>Pagar con Transferencia Banreservas</span>
                                    </Button>
                                </div>
                            ) : (
                                <div className="w-full mt-auto">
                                    <Button
                                        className={`w-full h-auto min-h-11 py-2 px-3 font-bold rounded-xl transition-all active:scale-[0.98] text-xs sm:text-sm text-center leading-tight whitespace-normal flex items-center justify-center gap-2 ${
                                            activePlan === plan.id
                                                ? isPro
                                                    ? 'bg-emerald-800/20 text-emerald-800 border-0 cursor-not-allowed opacity-60'
                                                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 cursor-not-allowed'
                                                : isPro
                                                ? 'bg-white text-emerald-950 hover:bg-emerald-50 border-0 shadow-lg shadow-emerald-950/10'
                                                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-0 shadow-md'
                                        }`}
                                        disabled={activePlan === plan.id}
                                        onClick={() => handleSelectPlan(plan)}
                                    >
                                        <Landmark className="h-4 w-4 shrink-0" />
                                        <span>
                                            {activePlan === plan.id ? 'Plan Actual' : 'Pagar por Transferencia'}
                                        </span>
                                    </Button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

        </div>
    );
};

export default UserSubscription;
