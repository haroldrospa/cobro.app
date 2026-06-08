import React from 'react';
import { Crown, Users, Package, UserPlus, FileText, Lock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlanBadge, UsageMeter } from '@/components/subscription/PlanRestrictions';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useEmployees } from '@/hooks/useEmployees';
import { useProductsOffline } from '@/hooks/useProductsOffline';
import { useCustomers } from '@/hooks/useCustomers';
import { useSales } from '@/hooks/useSalesManagement';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useUserStore } from '@/hooks/useUserStore';

export default function SubscriptionOverview() {
    const {
        planTier,
        features,
        getPlanName,
        canAccess
    } = usePlanFeatures();

    const { data: userStore } = useUserStore();
    const { settings, loadingSettings } = useStoreSettings();

    if (loadingSettings && !settings) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    // Get counts for usage meters
    const { data: employees = [] } = useEmployees();
    const { data: products = [] } = useProductsOffline();
    const { data: customers = [] } = useCustomers();

    // Get invoices from current month
    const currentMonth = new Date();
    const { data: sales = [] } = useSales({
        dateFrom: startOfMonth(currentMonth),
        dateTo: endOfMonth(currentMonth),
    });

    const featuresList = [
        {
            name: 'Reportes Básicos',
            available: canAccess('canAccessReports'),
            icon: FileText
        },
        {
            name: 'Reportes Avanzados',
            available: canAccess('canAccessAdvancedReports'),
            icon: FileText,
            requiredPlan: 'pro' as const
        },
        {
            name: 'Contabilidad',
            available: canAccess('canAccessAccounting'),
            icon: FileText,
            requiredPlan: 'pro' as const
        },
        {
            name: 'Nómina',
            available: canAccess('canAccessPayroll'),
            icon: Users,
            requiredPlan: 'pro' as const
        },
        {
            name: 'Pedidos Web',
            available: canAccess('canAccessWebOrders'),
            icon: Package,
            requiredPlan: 'pro' as const
        },
        {
            name: 'API de Integración',
            available: canAccess('canAccessAPI'),
            icon: Lock,
            requiredPlan: 'enterprise' as const
        },
        {
            name: 'Múltiples Tiendas',
            available: canAccess('canManageMultipleStores'),
            icon: Package,
            requiredPlan: 'enterprise' as const
        },
    ];

    const planColors = {
        basic: 'bg-gradient-to-br from-slate-100 to-gray-200 border-gray-300 dark:from-slate-800 dark:to-gray-900 dark:border-gray-700',
        pro: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-900/40 dark:to-indigo-900/40 dark:border-blue-800',
        enterprise: 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 dark:from-purple-900/40 dark:to-pink-900/40 dark:border-purple-800',
    };

    const PlanIcon = planTier === 'enterprise' ? Crown : (planTier === 'pro' ? Package : Users);

    return (
        <div className="space-y-8 p-6 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8 border border-primary/10">
                <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded-full blur opacity-50 group-hover:opacity-100 transition duration-500"></div>
                        <Avatar className="h-24 w-24 border-4 border-background relative">
                            <AvatarImage src={settings?.logo_url || userStore?.store_settings?.logo_url || undefined} alt={userStore?.store_name} className="object-cover" />
                            <AvatarFallback className="text-3xl font-bold bg-background text-foreground">
                                {userStore?.store_name?.charAt(0)?.toUpperCase() || 'T'}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                    <div className="text-center md:text-left space-y-2">
                        <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
                            {userStore?.store_name || 'Mi Tienda'}
                        </h1>
                        <p className="text-muted-foreground font-mono text-sm flex items-center gap-2 justify-center md:justify-start">
                            <span className="opacity-50">ID:</span> {userStore?.id || '...'}
                        </p>
                        <div className="pt-2">
                            <PlanBadge showUpgrade={false} />
                        </div>
                    </div>
                </div>
                {/* Decorative background circle */}
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-primary/10 rounded-full blur-3xl opacity-50 pointer-events-none" />
            </div>

            {/* Current Plan Card */}
            <Card className={`${planColors[planTier]} border shadow-lg overflow-hidden relative transition-all duration-300 hover:shadow-xl`}>
                <div className="absolute top-0 right-0 p-32 bg-white/5 dark:bg-black/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

                <CardHeader className="relative z-10 pb-2">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="space-y-1 text-center md:text-left">
                            <CardTitle className="text-3xl font-bold flex items-center justify-center md:justify-start gap-3">
                                <div className={`p-2 rounded-lg ${planTier === 'enterprise' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/50' : planTier === 'pro' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50' : 'bg-gray-100 text-gray-600 dark:bg-gray-800'}`}>
                                    <PlanIcon className="h-6 w-6" />
                                </div>
                                <span>Plan {getPlanName()}</span>
                            </CardTitle>
                            <CardDescription className="text-base font-medium opacity-90">
                                {planTier === 'basic' && 'Comienza tu viaje con las herramientas esenciales.'}
                                {planTier === 'pro' && 'Potencia tu crecimiento con funciones avanzadas.'}
                                {planTier === 'enterprise' && 'Escala sin límites con todo el poder desbloqueado.'}
                            </CardDescription>
                        </div>
                        {planTier !== 'enterprise' && (
                            <Button
                                size="lg"
                                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-md transform hover:scale-105 transition-all duration-200"
                                onClick={() => (window.location.href = '/subscription')}
                            >
                                <Crown className="mr-2 h-5 w-5 animate-pulse" />
                                Mejorar Plan
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="relative z-10 pt-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { icon: Users, label: "Empleados", value: features.maxEmployees, color: "text-blue-500", bg: "bg-blue-500/10" },
                            { icon: Package, label: "Productos", value: features.maxProducts, color: "text-green-500", bg: "bg-green-500/10" },
                            { icon: UserPlus, label: "Clientes", value: features.maxCustomers, color: "text-orange-500", bg: "bg-orange-500/10" },
                            { icon: FileText, label: "Facturas/mes", value: features.maxInvoicesPerMonth, color: "text-purple-500", bg: "bg-purple-500/10" },
                        ].map((stat, idx) => (
                            <div key={idx} className="flex flex-col items-center p-4 bg-white/60 dark:bg-black/20 backdrop-blur-sm rounded-xl border border-white/20 dark:border-white/5 shadow-sm hover:bg-white/80 dark:hover:bg-black/30 transition-colors">
                                <div className={`p-3 rounded-full ${stat.bg} mb-3`}>
                                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                                </div>
                                <span className="text-3xl font-extrabold tracking-tight">
                                    {stat.value === Infinity ? '∞' : stat.value}
                                </span>
                                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide text-[10px] mt-1">
                                    {stat.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Usage Meters */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-8 w-1 bg-primary rounded-full" />
                        <h2 className="text-2xl font-bold">Uso del Sistema</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <UsageMeter
                            limitType="employees"
                            currentCount={employees.length}
                            label="Empleados"
                        />
                        <UsageMeter
                            limitType="products"
                            currentCount={products.length}
                            label="Productos"
                        />
                        <UsageMeter
                            limitType="customers"
                            currentCount={customers.length}
                            label="Clientes"
                        />
                        <UsageMeter
                            limitType="invoices"
                            currentCount={sales.length}
                            label="Facturas (Mes)"
                        />
                    </div>

                    <div className="mt-8">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-8 w-1 bg-purple-500 rounded-full" />
                            <h2 className="text-2xl font-bold">Funcionalidades</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {featuresList.map((feature, index) => (
                                <div
                                    key={index}
                                    className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${feature.available
                                        ? 'bg-card border-border hover:border-primary/50 hover:shadow-md'
                                        : 'bg-muted/30 border-transparent opacity-60 grayscale'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${feature.available ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-400'}`}>
                                            <feature.icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold">{feature.name}</p>
                                            {!feature.available && feature.requiredPlan && (
                                                <p className="text-xs font-medium text-orange-500 flex items-center gap-1">
                                                    <Lock className="h-3 w-3" />
                                                    Plan {feature.requiredPlan === 'pro' ? 'Negocio' : 'Corporativo'}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {feature.available && (
                                        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Support Sidebar */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-8 w-1 bg-blue-500 rounded-full" />
                        <h2 className="text-2xl font-bold">Soporte</h2>
                    </div>

                    <Card className="border-none shadow-lg bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Badge
                                    variant="secondary"
                                    className={`px-3 py-1 text-sm font-semibold border ${features.supportLevel === 'dedicated'
                                        ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300'
                                        : features.supportLevel === 'priority'
                                            ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300'
                                            : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300'
                                        }`}
                                >
                                    {features.supportLevel === 'dedicated' && 'Soporte VIP Dedicado'}
                                    {features.supportLevel === 'priority' && 'Soporte Prioritario'}
                                    {features.supportLevel === 'basic' && 'Soporte Estándar'}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <div className={`flex items-center gap-3 p-3 rounded-lg ${features.hasWhatsAppSupport ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-gray-50 text-gray-400 dark:bg-gray-900/20'}`}>
                                        <div className="p-2 bg-white dark:bg-black/20 rounded-full">
                                            {features.hasWhatsAppSupport ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                        </div>
                                        <span className="font-medium">Soporte WhatsApp</span>
                                    </div>

                                    <div className={`flex items-center gap-3 p-3 rounded-lg ${features.hasPhoneSupport ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'bg-gray-50 text-gray-400 dark:bg-gray-900/20'}`}>
                                        <div className="p-2 bg-white dark:bg-black/20 rounded-full">
                                            {features.hasPhoneSupport ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                        </div>
                                        <span className="font-medium">Línea Telefónica Directa</span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t">
                                    <p className="text-xs text-center text-muted-foreground">
                                        ¿Necesitas ayuda? Contáctanos de Lunes a Viernes, 9AM - 6PM
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// Icons for support section
const CheckCircle = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
);

const XCircle = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
);
