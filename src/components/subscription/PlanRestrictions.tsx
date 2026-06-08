import React from 'react';
import { AlertCircle, Crown, Zap, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import cobroLogoLight from '@/assets/cobro-logo-light.png';
import cobroLogoDark from '@/assets/cobro-logo-dark.png';

interface PlanRestrictionProps {
    feature: string;
    requiredPlan?: 'pro' | 'enterprise';
    currentCount?: number;
    limitType?: 'employees' | 'products' | 'customers' | 'invoices';
}

export const PlanRestrictionAlert: React.FC<PlanRestrictionProps> = ({
    feature,
    requiredPlan = 'pro',
}) => {
    const planNames = {
        pro: 'Negocio',
        enterprise: 'Corporativo',
    };

    return (
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 opacity-[0.03] pointer-events-none select-none">
                <Crown size={140} className="transform rotate-12 -translate-y-8 translate-x-8 text-primary" />
            </div>

            <div className="relative flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                <div className="flex flex-col md:flex-row items-center gap-5">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/5 shadow-sm border border-primary/10 overflow-hidden p-3">
                        <img src={cobroLogoLight} alt="CobroApp" className="w-full h-full object-contain dark:hidden" />
                        <img src={cobroLogoDark} alt="CobroApp" className="w-full h-full object-contain hidden dark:block" />
                    </div>
                    <div className="space-y-1.5">
                        <h4 className="flex flex-col md:flex-row items-center gap-2 text-lg font-bold text-foreground">
                            Función Premium
                            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 px-2.5">
                                Plan {planNames[requiredPlan]}
                            </Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
                            <span className="font-medium text-foreground">{feature}</span> está disponible exclusivamente en el plan <strong>{planNames[requiredPlan]}</strong>.
                            Mejora tu plan para desbloquear todo el potencial de tu negocio.
                        </p>
                    </div>
                </div>

                <Button
                    onClick={() => window.location.href = '/subscription'}
                    className="shrink-0 h-10 px-6 font-semibold shadow-sm rounded-full"
                >
                    Actualizar Plan
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

export const LimitReachedAlert: React.FC<PlanRestrictionProps> = ({
    feature,
    currentCount,
    limitType,
}) => {
    const { features, getRemainingCount } = usePlanFeatures();

    const limits = {
        employees: features.maxEmployees,
        products: features.maxProducts,
        customers: features.maxCustomers,
        invoices: features.maxInvoicesPerMonth,
    };

    const limit = limitType ? limits[limitType] : 0;
    const count = currentCount || 0;

    return (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-900">Límite Alcanzado</AlertTitle>
            <AlertDescription className="text-red-800">
                <div className="space-y-2">
                    <p>
                        Has alcanzado el límite de <strong>{limit}</strong> {feature} en tu plan actual.
                        {count > 0 && ` Actualmente tienes ${count}.`}
                    </p>
                    <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => (window.location.href = '/subscription')}
                    >
                        Actualizar Plan <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </AlertDescription>
        </Alert>
    );
};

interface PlanBadgeProps {
    showUpgrade?: boolean;
}

export const PlanBadge: React.FC<PlanBadgeProps> = ({ showUpgrade = false }) => {
    const { planTier, getPlanName } = usePlanFeatures();

    const badgeColors = {
        basic: 'bg-gray-100 text-gray-800 border-gray-300',
        pro: 'bg-blue-100 text-blue-800 border-blue-300',
        enterprise: 'bg-purple-100 text-purple-800 border-purple-300',
    };

    const icons = {
        basic: null,
        pro: <Zap className="h-3 w-3 mr-1" />,
        enterprise: <Crown className="h-3 w-3 mr-1" />,
    };

    return (
        <div className="flex items-center gap-2">
            <Badge className={`${badgeColors[planTier]} border flex items-center`}>
                {icons[planTier]}
                {getPlanName()}
            </Badge>
            {showUpgrade && planTier !== 'enterprise' && (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs"
                    onClick={() => (window.location.href = '/subscription')}
                >
                    <Crown className="h-3 w-3 mr-1" />
                    Mejorar
                </Button>
            )}
        </div>
    );
};

interface UsageMeterProps {
    limitType: 'employees' | 'products' | 'customers' | 'invoices';
    currentCount: number;
    label: string;
}

export const UsageMeter: React.FC<UsageMeterProps> = ({
    limitType,
    currentCount,
    label,
}) => {
    const { features, hasReachedLimit, getRemainingCount } = usePlanFeatures();

    const limits = {
        employees: features.maxEmployees,
        products: features.maxProducts,
        customers: features.maxCustomers,
        invoices: features.maxInvoicesPerMonth,
    };

    const limit = limits[limitType];
    const isUnlimited = limit === Infinity;
    const percentage = isUnlimited ? 0 : Math.min((currentCount / limit) * 100, 100);
    const isNearLimit = percentage >= 80 && !isUnlimited;
    const isAtLimit = hasReachedLimit(limitType, currentCount);

    const barColor = isAtLimit
        ? 'bg-red-500'
        : isNearLimit
            ? 'bg-orange-500'
            : 'bg-green-500';

    return (
        <Card className={isAtLimit ? 'border-red-300' : isNearLimit ? 'border-orange-300' : ''}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{label}</CardTitle>
                    {isAtLimit && (
                        <Badge variant="destructive" className="text-xs">
                            Límite alcanzado
                        </Badge>
                    )}
                    {isNearLimit && !isAtLimit && (
                        <Badge variant="outline" className="text-xs border-orange-500 text-orange-700">
                            Cerca del límite
                        </Badge>
                    )}
                </div>
                <CardDescription className="text-xs">
                    {isUnlimited ? (
                        <span className="text-green-600 font-medium">Ilimitado ✨</span>
                    ) : (
                        <>
                            {currentCount} de {limit} usados
                            {!isAtLimit && (
                                <span className="text-muted-foreground ml-1">
                                    ({getRemainingCount(limitType, currentCount)} disponibles)
                                </span>
                            )}
                        </>
                    )}
                </CardDescription>
            </CardHeader>
            {!isUnlimited && (
                <CardContent className="pb-4">
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                            className={`h-full ${barColor} transition-all duration-300`}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                </CardContent>
            )}
        </Card>
    );
};

interface FeatureLockedProps {
    featureName: string;
    requiredPlan: 'pro' | 'enterprise';
    children?: React.ReactNode;
}

export const FeatureLocked: React.FC<FeatureLockedProps> = ({
    featureName,
    requiredPlan,
    children,
}) => {
    const planNames = {
        pro: 'Negocio',
        enterprise: 'Corporativo',
    };

    return (
        <div className="relative">
            <div className="absolute inset-0 bg-gray-900/10 backdrop-blur-sm z-10 rounded-lg flex items-center justify-center">
                <Card className="max-w-md mx-4">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Crown className="h-5 w-5 text-orange-600" />
                            Función Bloqueada
                        </CardTitle>
                        <CardDescription>
                            <strong>{featureName}</strong> requiere el plan{' '}
                            <strong className="text-orange-700">{planNames[requiredPlan]}</strong>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            className="w-full bg-orange-600 hover:bg-orange-700"
                            onClick={() => (window.location.href = '/subscription')}
                        >
                            <Crown className="mr-2 h-4 w-4" />
                            Actualizar a {planNames[requiredPlan]}
                        </Button>
                    </CardContent>
                </Card>
            </div>
            <div className="opacity-30 pointer-events-none">{children}</div>
        </div>
    );
};

export interface LimitReachedDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    limitType?: 'employees' | 'products' | 'customers' | 'invoices';
}

export const LimitReachedDialog: React.FC<LimitReachedDialogProps> = ({
    isOpen,
    onClose,
    title,
    description,
    limitType
}) => {
    const { features } = usePlanFeatures();
    
    const limits = {
        employees: features.maxEmployees,
        products: features.maxProducts,
        customers: features.maxCustomers,
        invoices: features.maxInvoicesPerMonth,
    };

    const limit = limitType ? limits[limitType] : null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="flex flex-col items-center justify-center text-center pt-4">
                    <div className="h-16 w-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                        <Crown className="h-8 w-8 text-orange-600" />
                    </div>
                    <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
                    <DialogDescription className="text-base mt-2 px-4">
                        {description}
                        {limit && limit !== Infinity && (
                            <div className="mt-4 p-3 bg-secondary/80 rounded-lg text-sm font-semibold border border-border">
                                Límite actual: {limit} {limitType === 'invoices' ? 'facturas al mes' : limitType}
                            </div>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 py-4">
                    <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
                        <h5 className="font-bold text-sm mb-2 flex items-center gap-2 text-primary">
                            <Zap className="h-4 w-4 fill-primary" />
                            Beneficios de actualizar
                        </h5>
                        <ul className="text-xs text-muted-foreground space-y-2">
                            <li className="flex items-center gap-2 text-left">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary/40 shrink-0" />
                                Sin límites en tus operaciones diarias
                            </li>
                            <li className="flex items-center gap-2 text-left">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary/40 shrink-0" />
                                Reportes avanzados y analítica en tiempo real
                            </li>
                            <li className="flex items-center gap-2 text-left">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary/40 shrink-0" />
                                Soporte técnico prioritario
                            </li>
                        </ul>
                    </div>
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                    <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">
                        Cerrar
                    </Button>
                    <Button 
                        onClick={() => window.location.href = '/subscription'}
                        className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-bold"
                    >
                        <Crown className="mr-2 h-4 w-4" />
                        Ver Planes y Precios
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
