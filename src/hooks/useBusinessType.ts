import { useStoreSettings } from './useStoreSettings';

export type BusinessType = 'restaurant' | 'store' | 'supermarket' | 'services';

export const BUSINESS_TYPES: { id: BusinessType; label: string; emoji: string; description: string }[] = [
    {
        id: 'restaurant',
        label: 'Restaurante',
        emoji: '🍽️',
        description: 'Mesas, cocina, pedidos para llevar y delivery'
    },
    {
        id: 'store',
        label: 'Tienda',
        emoji: '🛍️',
        description: 'Venta de productos, inventario y clientes'
    },
    {
        id: 'supermarket',
        label: 'Supermercado',
        emoji: '🛒',
        description: 'Gran inventario, múltiples categorías y cajas'
    },
    {
        id: 'services',
        label: 'Servicios',
        emoji: '💼',
        description: 'Servicios profesionales, contabilidad, asesoría y facturación'
    },
];

export const useBusinessType = () => {
    const { settings, updateSettings, isUpdating } = useStoreSettings();

    // Normalize raw shop_type.
    // Legacy web-store theme values: 'default', 'fashion', 'technology' → treat as 'restaurant'
    // so existing users don't lose the kitchen screen after updating.
    const raw = settings?.shop_type;
    const businessType: BusinessType = (() => {
        if (raw === 'store' || raw === 'fashion' || raw === 'technology') return 'store';
        if (raw === 'supermarket') return 'supermarket';
        if (raw === 'services') return 'services';
        return 'restaurant'; // 'restaurant', 'default', undefined → restaurant
    })();

    const isRestaurant = businessType === 'restaurant';
    const isStore = businessType === 'store';
    const isSupermarket = businessType === 'supermarket';
    const isServices = businessType === 'services';

    // Kitchen display: restaurant type + not explicitly disabled via use_kitchen toggle
    // use_kitchen defaults to true so restaurant users keep seeing it by default
    const useKitchen = settings?.use_kitchen !== false;
    const hasKitchenDisplay = isRestaurant && useKitchen;

    // Delivery page — defaults to true so existing users keep seeing it (disabled for services by default)
    const hasDelivery = isServices ? false : settings?.use_delivery !== false;

    // Kitchen order step should be skipped when kitchen is not active
    const skipKitchenStep = !hasKitchenDisplay;

    const orderTypeLabels = {
        'dine-in': isServices ? 'Presencial' : (isStore || isSupermarket) ? 'Compra aquí' : 'Comer Aquí',
        'takeout': isServices ? 'Remoto / Virtual' : (isStore || isSupermarket) ? 'Delivery' : 'Para Llevar',
    };

    const orderTypeIcons = {
        'dine-in': isServices ? 'Briefcase' : (isStore || isSupermarket) ? 'Tag' : 'Utensils',
        'takeout': isServices ? 'Send' : (isStore || isSupermarket) ? 'ShoppingBag' : 'ShoppingBag',
    };

    const orderTypeTags = {
        'dine-in': `[${orderTypeLabels['dine-in'].toUpperCase()}]`,
        'takeout': `[${orderTypeLabels['takeout'].toUpperCase()}]`,
    };

    const setBusinessType = (type: BusinessType) => {
        if (type === 'services') {
            updateSettings({ shop_type: type, paper_size: 'carta' });
        } else {
            updateSettings({ shop_type: type });
        }
    };

    return {
        businessType,
        isRestaurant,
        isStore,
        isSupermarket,
        isServices,
        hasKitchenDisplay,
        hasDelivery,
        useKitchen,
        skipKitchenStep,
        orderTypeLabels,
        orderTypeTags,
        orderTypeIcons,
        setBusinessType,
        isUpdating,
    };
};
