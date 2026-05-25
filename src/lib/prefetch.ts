/**
 * Precarga inteligente de datos críticos para facturación ultrarrápida
 * Este módulo precarga productos, clientes y configuraciones antes de que el usuario los necesite
 */

import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Precarga todos los datos del POS para facturación instantánea
 */
export const prefetchPOSData = async (queryClient: QueryClient, storeId?: string) => {
    if (!storeId) return;

    console.log('🚀 Precargando datos del POS...');

    // Precarga en paralelo para máxima velocidad
    await Promise.allSettled([
        // 1. Productos (crítico para búsqueda rápida)
        queryClient.prefetchQuery({
            queryKey: ['products', 'offline', storeId],
            queryFn: async () => {
                const { data } = await supabase
                    .from('products')
                    .select('*, category:categories(name)')
                    .eq('store_id', storeId)
                    .eq('status', 'active')
                    .order('name');
                return data || [];
            },
            staleTime: 1000 * 60 * 30, // 30 minutos
        }),

        // 2. Clientes (para crédito rápido)
        queryClient.prefetchQuery({
            queryKey: ['customers'],
            queryFn: async () => {
                const { data } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('store_id', storeId)
                    .order('name');
                return data || [];
            },
            staleTime: 1000 * 60 * 30,
        }),

        // 3. Configuración de impresión
        queryClient.prefetchQuery({
            queryKey: ['print-settings', storeId],
            queryFn: async () => {
                const stored = localStorage.getItem('print-settings');
                return stored ? JSON.parse(stored) : null;
            },
            staleTime: Infinity, // No caduca, se actualiza manualmente
        }),

        // 4. Tipos de factura
        queryClient.prefetchQuery({
            queryKey: ['invoice-types', storeId],
            queryFn: async () => {
                const { data } = await supabase
                    .from('invoice_types')
                    .select('*')
                    .eq('store_id', storeId)
                    .eq('is_enabled', true);
                return data || [];
            },
            staleTime: 1000 * 60 * 60, // 1 hora
        }),
    ]);

    console.log('✅ Datos del POS precargados!');
};

/**
 * Precarga datos de reportes y dashboard
 */
export const prefetchDashboardData = async (queryClient: QueryClient, storeId?: string) => {
    if (!storeId) return;

    console.log('📊 Precargando datos del dashboard...');

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    await Promise.allSettled([
        // Ventas del mes actual
        queryClient.prefetchQuery({
            queryKey: ['sales', 'monthly', storeId, startOfMonth.toISOString()],
            queryFn: async () => {
                const { data } = await supabase
                    .from('sales')
                    .select('*')
                    .eq('store_id', storeId)
                    .gte('created_at', startOfMonth.toISOString())
                    .order('created_at', { ascending: false });
                return data || [];
            },
            staleTime: 1000 * 60 * 5, // 5 minutos
        }),
    ]);

    console.log('✅ Datos del dashboard precargados!');
};

/**
 * Precarga inteligente basada en la ruta actual
 */
export const prefetchByRoute = async (queryClient: QueryClient, route: string, storeId?: string) => {
    switch (route) {
        case '/pos':
        case '/':
            await prefetchPOSData(queryClient, storeId);
            break;
        case '/dashboard':
            await prefetchDashboardData(queryClient, storeId);
            break;
        default:
            // Siempre precargar POS (es lo más usado)
            await prefetchPOSData(queryClient, storeId);
    }
};
