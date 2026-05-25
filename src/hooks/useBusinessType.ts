import { useStoreSettings } from './useStoreSettings';

export type BusinessType = 'restaurant' | 'store' | 'supermarket';

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
];

export const useBusinessType = () => {
    const { settings, updateSettings, isUpdating } = useStoreSettings();

    // Normalize raw shop_type.
    // Legacy web-store theme values: 'default', 'fashion', 'technology' → treat as 'restaurant'
    // so existing users don't lose the kitchen screen after updating.
    const raw = settings?.shop_type;
    const businessType: BusinessType = (() => {
        if (raw === 'store') return 'store';
        if (raw === 'supermarket') return 'supermarket';
        return 'restaurant'; // 'restaurant', 'default', 'fashion', 'technology', undefined → restaurant
    })();

    const isRestaurant = businessType === 'restaurant';
    const isStore = businessType === 'store';
    const isSupermarket = businessType === 'supermarket';

    // Kitchen display: restaurant type + not explicitly disabled via use_kitchen toggle
    // use_kitchen defaults to true so restaurant users keep seeing it by default
    const useKitchen = settings?.use_kitchen !== false;
    const hasKitchenDisplay = isRestaurant && useKitchen;

    // Delivery page — defaults to true so existing users keep seeing it
    const hasDelivery = settings?.use_delivery !== false;

    // Kitchen order step should be skipped when kitchen is not active
    const skipKitchenStep = !hasKitchenDisplay;

    const orderTypeLabels = {
        'dine-in': (isStore || isSupermarket) ? 'Compra aquí' : 'Comer Aquí',
        'takeout': (isStore || isSupermarket) ? 'Delivery' : 'Para Llevar',
    };

    const orderTypeIcons = {
        'dine-in': (isStore || isSupermarket) ? 'Tag' : 'Utensils',
        'takeout': (isStore || isSupermarket) ? 'ShoppingBag' : 'ShoppingBag',
    };

    const orderTypeTags = {
        'dine-in': `[${orderTypeLabels['dine-in'].toUpperCase()}]`,
        'takeout': `[${orderTypeLabels['takeout'].toUpperCase()}]`,
    };

    const setBusinessType = (type: BusinessType) => {
        updateSettings({ shop_type: type });
    };

    return {
        businessType,
        isRestaurant,
        isStore,
        isSupermarket,
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
