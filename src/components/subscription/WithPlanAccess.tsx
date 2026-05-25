import React from 'react';
import { usePlanFeatures, PlanFeatures } from '@/hooks/usePlanFeatures';
import { PlanRestrictionAlert, FeatureLocked } from './PlanRestrictions';

interface WithPlanAccessProps {
    children: React.ReactNode;
    feature: keyof PlanFeatures;
    requiredPlan?: 'pro' | 'enterprise';
    fallback?: React.ReactNode;
    showAlert?: boolean;
    featureName?: string;
}

/**
 * Component wrapper that checks if user has access to a feature based on their plan
 * Usage:
 * <WithPlanAccess feature="canAccessAccounting" requiredPlan="pro" featureName="Contabilidad">
 *   <AccountingComponent />
 * </WithPlanAccess>
 */
export const WithPlanAccess: React.FC<WithPlanAccessProps> = ({
    children,
    feature,
    requiredPlan = 'pro',
    fallback,
    showAlert = true,
    featureName = 'Esta función',
}) => {
    const { canAccess, isLoading } = usePlanFeatures();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    const hasAccess = canAccess(feature);

    if (!hasAccess) {
        if (fallback) {
            return <>{fallback}</>;
        }

        if (showAlert) {
            return (
                <div className="p-6">
                    <PlanRestrictionAlert feature={featureName} requiredPlan={requiredPlan} />
                </div>
            );
        }

        return null;
    }

    return <>{children}</>;
};

interface WithPlanLimitProps {
    children: React.ReactNode;
    limitType: 'employees' | 'products' | 'customers' | 'invoices';
    currentCount: number;
    onLimitReached?: () => void;
    showOverlay?: boolean;
}

/**
 * Component wrapper that checks if user has reached a resource limit
 * Usage:
 * <WithPlanLimit limitType="products" currentCount={productCount}>
 *   <AddProductButton />
 * </WithPlanLimit>
 */
export const WithPlanLimit: React.FC<WithPlanLimitProps> = ({
    children,
    limitType,
    currentCount,
    onLimitReached,
    showOverlay = false,
}) => {
    const { hasReachedLimit, isLoading } = usePlanFeatures();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
        );
    }

    const isAtLimit = hasReachedLimit(limitType, currentCount);

    if (isAtLimit) {
        if (onLimitReached) {
            onLimitReached();
        }

        if (showOverlay) {
            return (
                <FeatureLocked
                    featureName={`Más ${limitType === 'employees' ? 'empleados' : limitType === 'products' ? 'productos' : limitType === 'customers' ? 'clientes' : 'facturas'}`}
                    requiredPlan="pro"
                >
                    {children}
                </FeatureLocked>
            );
        }

        return null;
    }

    return <>{children}</>;
};

/**
 * Hook to get a disabled state and message for form inputs based on limits
 */
export const useLimitState = (
    limitType: 'employees' | 'products' | 'customers' | 'invoices',
    currentCount: number
) => {
    const { hasReachedLimit, getRemainingCount, features } = usePlanFeatures();

    const isDisabled = hasReachedLimit(limitType, currentCount);
    const remaining = getRemainingCount(limitType, currentCount);

    const labels = {
        employees: 'empleados',
        products: 'productos',
        customers: 'clientes',
        invoices: 'facturas',
    };

    const limits = {
        employees: features.maxEmployees,
        products: features.maxProducts,
        customers: features.maxCustomers,
        invoices: features.maxInvoicesPerMonth,
    };

    const limit = limits[limitType];
    const label = labels[limitType];

    const message = isDisabled
        ? `Has alcanzado el límite de ${limit} ${label} en tu plan actual.`
        : remaining === Infinity
            ? `${label} ilimitados`
            : `${remaining} ${label} disponibles`;

    return {
        isDisabled,
        message,
        remaining,
        limit,
    };
};
