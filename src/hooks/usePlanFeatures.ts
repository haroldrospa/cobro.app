import { useMemo } from 'react';
import { useSubscription } from './useSubscription';

export type PlanTier = 'basic' | 'pro' | 'enterprise';

export interface PlanFeatures {
    // General Features
    maxEmployees: number;
    maxProducts: number;
    maxCustomers: number;
    maxInvoicesPerMonth: number;

    // Advanced Features
    canAccessReports: boolean;
    canAccessAdvancedReports: boolean;
    canAccessAccounting: boolean;
    canAccessPayroll: boolean;
    canManageMultipleStores: boolean;
    canAccessAPI: boolean;
    canCustomizeBranding: boolean;
    canAccessInventoryAlerts: boolean;
    canAccessEmailReports: boolean;
    canAccessWebOrders: boolean;
    canAccessPromotions: boolean;
    canExportData: boolean;
    canAccessDashboardAnalytics: boolean;

    // Support
    supportLevel: 'basic' | 'priority' | 'dedicated';
    hasWhatsAppSupport: boolean;
    hasPhoneSupport: boolean;
}

const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
    basic: {
        // Limits - Emprendedor
        maxEmployees: 1,
        maxProducts: 500,
        maxCustomers: 50,
        maxInvoicesPerMonth: Infinity,

        // Features
        canAccessReports: true,
        canAccessAdvancedReports: false,
        canAccessAccounting: false,
        canAccessPayroll: false,
        canManageMultipleStores: false,
        canAccessAPI: false,
        canCustomizeBranding: false,
        canAccessInventoryAlerts: true,
        canAccessEmailReports: false,
        canAccessWebOrders: false,
        canAccessPromotions: false,
        canExportData: true, // Basic export (Excel)
        canAccessDashboardAnalytics: true,

        // Support
        supportLevel: 'basic',
        hasWhatsAppSupport: false,
        hasPhoneSupport: false,
    },
    pro: {
        // Limits - Negocio
        maxEmployees: 5,
        maxProducts: 1000,
        maxCustomers: 500,
        maxInvoicesPerMonth: Infinity,

        // Features
        canAccessReports: true,
        canAccessAdvancedReports: true,
        canAccessAccounting: true,
        canAccessPayroll: true,
        canManageMultipleStores: false,
        canAccessAPI: false,
        canCustomizeBranding: true,
        canAccessInventoryAlerts: true,
        canAccessEmailReports: true,
        canAccessWebOrders: true,
        canAccessPromotions: true,
        canExportData: true,
        canAccessDashboardAnalytics: true,

        // Support
        supportLevel: 'priority',
        hasWhatsAppSupport: true,
        hasPhoneSupport: false,
    },
    enterprise: {
        // Limits - Corporativo (Unlimited)
        maxEmployees: Infinity,
        maxProducts: Infinity,
        maxCustomers: Infinity,
        maxInvoicesPerMonth: Infinity,

        // Features (All enabled)
        canAccessReports: true,
        canAccessAdvancedReports: true,
        canAccessAccounting: true,
        canAccessPayroll: true,
        canManageMultipleStores: true,
        canAccessAPI: true,
        canCustomizeBranding: true,
        canAccessInventoryAlerts: true,
        canAccessEmailReports: true,
        canAccessWebOrders: true,
        canAccessPromotions: true,
        canExportData: true,
        canAccessDashboardAnalytics: true,

        // Support
        supportLevel: 'dedicated',
        hasWhatsAppSupport: true,
        hasPhoneSupport: true,
    },
};

export const usePlanFeatures = () => {
    const { data: subscription, isLoading: isSubscriptionLoading } = useSubscription();
    const isLoading = isSubscriptionLoading || !subscription;

    const planTier: PlanTier = useMemo(() => {
        if (!subscription || !subscription.plan_id) return 'basic';
        // Validate that the plan_id exists in our features map
        if (subscription.plan_id in PLAN_FEATURES) {
            return subscription.plan_id as PlanTier;
        }
        console.warn(`Unknown plan_id: ${subscription.plan_id}, falling back to basic`);
        return 'basic';
    }, [subscription]);

    const features = useMemo(() => {
        return PLAN_FEATURES[planTier] || PLAN_FEATURES.basic;
    }, [planTier]);

    const canAccess = (feature: keyof PlanFeatures): boolean => {
        const value = features[feature];
        if (typeof value === 'boolean') return value;
        return true; // For numeric/string values, return true (handled separately)
    };

    const hasReachedLimit = (
        limitType: 'employees' | 'products' | 'customers' | 'invoices',
        currentCount: number
    ): boolean => {
        const limits = {
            employees: features.maxEmployees,
            products: features.maxProducts,
            customers: features.maxCustomers,
            invoices: features.maxInvoicesPerMonth,
        };

        const limit = limits[limitType];
        return limit !== Infinity && currentCount >= limit;
    };

    const getRemainingCount = (
        limitType: 'employees' | 'products' | 'customers' | 'invoices',
        currentCount: number
    ): number => {
        const limits = {
            employees: features.maxEmployees,
            products: features.maxProducts,
            customers: features.maxCustomers,
            invoices: features.maxInvoicesPerMonth,
        };

        const limit = limits[limitType];
        if (limit === Infinity) return Infinity;
        return Math.max(0, limit - currentCount);
    };

    const getPlanName = (): string => {
        const names = {
            basic: 'Emprendedor',
            pro: 'Negocio',
            enterprise: 'Corporativo',
        };
        return names[planTier];
    };

    return {
        planTier,
        features,
        canAccess,
        hasReachedLimit,
        getRemainingCount,
        getPlanName,
        isLoading,
        subscription,
    };
};
