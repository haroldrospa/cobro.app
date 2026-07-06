/**
 * Hook para usar productos con soporte offline
 * Funciona automáticamente sin internet usando IndexedDB
 *
 * ESTRATEGIA: Cache-first, sync-in-background
 * 1. Sirve datos de IndexedDB INMEDIATAMENTE (sin pantalla de carga)
 * 2. Sincroniza Supabase en segundo plano y actualiza el cache
 * 3. Solo bloquea en la primera instalación (cuando no hay datos locales)
 */

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';
import { offlineSyncManager } from '@/lib/offlineSync';
import { Product } from './useProducts';
import { useUserStore } from '@/hooks/useUserStore';
import { getSessionSafe } from '@/lib/authSession';

// Hook para detectar estado online/offline
export const useOnlineStatus = () => {
    const [isOnline, setIsOnline] = React.useState(navigator.onLine);

    React.useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
};

// Control de sincronización global
const syncInProgress = new Set<string>();
const lastSyncTimestamp = new Map<string, number>();
const SYNC_COOLDOWN = 1000 * 60; // 1 minuto entre sincronizaciones para evitar spam pero mantener frescura

export const useProductsOffline = () => {
    const isOnline = useOnlineStatus();
    const { data: store, isPending: isStorePending } = useUserStore();
    const storeId = store?.id;
    const queryClient = useQueryClient();

    // Sincroniza Supabase en background y actualiza el cache silenciosamente
    const syncFromSupabase = React.useCallback(async (sid: string) => {
        if (!isOnline || syncInProgress.has(sid)) return;
        
        const now = Date.now();
        const lastSync = lastSyncTimestamp.get(sid) || 0;
        if (now - lastSync < SYNC_COOLDOWN) {
            console.log(`📦 Background sync saltado: enfriamiento activo (${Math.round((SYNC_COOLDOWN - (now - lastSync)) / 1000)}s restantes)`);
            return;
        }

        syncInProgress.add(sid);
        try {
            const session = await getSessionSafe();
            if (!session) {
                console.warn('📦 Background sync abortado: sin sesión');
                return;
            }

            let allData: any[] = [];
            let hasMore = true;
            let from = 0;
            const step = 1000;

            while (hasMore) {
                // 8 segundos de timeout por página para evitar colgarse en conexiones lentas
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 8000);

                let chunk: any[] | null = null;
                let chunkError: any = null;

                try {
                    const result = await supabase
                         .from('products')
                         .select(`
                            *,
                            category:categories(name),
                            barcodes:product_barcodes(id, barcode, label)
                        `)
                        .eq('store_id', sid)
                        .order('name')
                        .range(from, from + step - 1)
                        .abortSignal(controller.signal);
                    clearTimeout(timer);
                    chunk = result.data;
                    chunkError = result.error;
                } catch (e) {
                    clearTimeout(timer);
                    console.log('📦 Background sync: timeout o error en página', from, e);
                    break;
                }

                if (chunkError) throw chunkError;
                if (!chunk) throw new Error('No chunk data');

                allData = [...allData, ...chunk];
                from += step;
                if (chunk.length < step) hasMore = false;
            }

            if (allData.length === 0) return;

            const filtered = allData.filter((p: any) => p.store_id === sid) as Product[];

            // Guardar en IndexedDB usando BULK (Alto rendimiento)
            await offlineDB.putBulk(OfflineStore.PRODUCTS, filtered);

            // Actualizar el cache de React Query: la UI se refresca automáticamente
            queryClient.setQueryData(['products', 'offline', sid], filtered);
            console.log(`📦 Background sync completado: ${filtered.length} productos actualizados`);

        } catch (error) {
            console.log('📦 Background sync error (no crítico):', error);
            // Si hay error, quitamos el cooldown para que pueda reintentar en el próximo render
            lastSyncTimestamp.delete(sid);
        } finally {
            syncInProgress.delete(sid);
        }
    }, [isOnline, queryClient]);

    const query = useQuery({
        queryKey: ['products', 'offline', storeId],
        enabled: !!storeId,
        queryFn: async () => {
            if (!storeId) return [];

            // 1. SIEMPRE intentar IndexedDB primero → carga instantánea
            const cached = await offlineDB.getAll<Product>(OfflineStore.PRODUCTS);
            const localProducts = cached.filter(p => (p as any).store_id === storeId);

            if (localProducts.length > 0) {
                console.log(`📦 ${localProducts.length} productos desde IndexedDB (instant) — sync en background`);
                // Disparar sync en background después de un breve delay para no bloquear el render
                setTimeout(() => syncFromSupabase(storeId), 200);
                return localProducts;
            }

            // 2. Primera instalación: sin caché local, hay que bajar de Supabase
            console.log('📦 Primera carga: descargando catálogo desde Supabase...');
            if (isOnline) {
                try {
                    const session = await getSessionSafe();
                    if (!session) {
                        throw new Error('Sin sesión válida al cargar productos');
                    }
                    let allData: any[] = [];
                    let hasMore = true;
                    let from = 0;
                    const step = 1000;

                    while (hasMore) {
                        const { data: chunk, error } = await supabase
                            .from('products')
                            .select(`
                                *,
                                category:categories(name),
                                barcodes:product_barcodes(id, barcode, label)
                            `)
                            .eq('store_id', storeId)
                            .order('name')
                            .range(from, from + step - 1);

                        if (error) throw error;
                        if (!chunk) break;
                        allData = [...allData, ...chunk];
                        from += step;
                        if (chunk.length < step) hasMore = false;
                    }

                    const filtered = allData.filter((p: any) => p.store_id === storeId) as Product[];
                    // Guardar en una sola transacción bulk (mucho más eficiente que N inserts individuales)
                    offlineDB.putBulk(OfflineStore.PRODUCTS, filtered)
                        .catch(e => console.warn('IndexedDB bulk write error:', e));
                    return filtered;
                } catch (error) {
                    console.log('📦 Error en primera carga desde Supabase:', error);
                    // Disparar intento de sync background si falló
                    setTimeout(() => syncFromSupabase(storeId), 1000);
                }
            } else {
                // Sin internet y sin caché: programar sync
                setTimeout(() => syncFromSupabase(storeId), 1000);
            }

            // Sin internet y sin caché, o hubo error: Lanza error para que React Query reintente y no cachee []
            throw new Error('Error de conexión al cargar catálogo');
        },
        staleTime: 1000 * 60 * 2,    // 2 min — usar caché local pero verificar seguido
        gcTime: 1000 * 60 * 60 * 24, // 24 horas
        refetchOnMount: true,        // Siempre refetchear al montar si está stale
        refetchOnWindowFocus: true,  // Refetchear al volver a la pestaña
    });

    return {
        ...query,
        // En React Query v5, isPending es true cuando no hay datos (aún si enabled: false).
        // Queremos mostrar la pantalla de carga si no hay storeId o si la query está cargando inicialmente.
        isLoading: isStorePending || (!!storeId && query.isPending)
    };
};

export const useCreateProductOffline = () => {
    const queryClient = useQueryClient();
    const isOnline = useOnlineStatus();
    const { data: store } = useUserStore();
    const storeId = store?.id;

    return useMutation({
        mutationFn: async (product: {
            name: string;
            price: number;
            cost?: number;
            cost_includes_tax?: boolean;
            tax_percentage?: number;
            internal_code?: string;
            barcode?: string;
            category_id?: string | null;
            stock: number;
            min_stock: number;
            status: 'active' | 'inactive';
            image_url?: string;
            discount_percentage?: number;
            discount_start_date?: string | null;
            discount_end_date?: string | null;
            is_featured?: boolean;
            is_variable_price?: boolean;
            is_variable_quantity?: boolean;
            is_visible_in_store?: boolean;
            track_inventory?: boolean;
            store_id?: string;
        }) => {
            const productId = crypto.randomUUID();
            const actualStoreId = product.store_id || storeId;

            // Resolver objeto de categoría para almacenamiento local
            let categoryObj = undefined;
            if (product.category_id) {
                const categories = queryClient.getQueryData<any[]>(['categories']);
                const newCat = categories?.find(c => c.id === product.category_id);
                categoryObj = newCat ? { name: newCat.name } : undefined;
            }

            const newProduct = {
                ...product,
                id: productId,
                store_id: actualStoreId,
                category: categoryObj,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            // Guardar en IndexedDB siempre
            await offlineDB.put(OfflineStore.PRODUCTS, newProduct);

            // Si estamos online, intentar guardar en Supabase
            if (isOnline) {
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('store_id')
                            .eq('id', user.id)
                            .maybeSingle();

                        // Filtrar propiedades relacionales que no existen en la tabla
                        const { category, barcodes, ...cleanProduct } = newProduct as any;

                        const { error } = await supabase
                            .from('products')
                            .insert([{
                                ...cleanProduct,
                                store_id: actualStoreId || profile?.store_id || null,
                            }]);

                        if (error) throw error;
                        return newProduct;
                    }
                } catch (error) {
                    console.error('Error guardando en Supabase, agregando a cola:', error);
                    // Agregar a cola de sincronización
                    await offlineDB.addToSyncQueue({
                        store: OfflineStore.PRODUCTS,
                        operation: 'CREATE',
                        data: newProduct,
                    });
                }
            } else {
                // Offline: agregar a cola de sincronización
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.PRODUCTS,
                    operation: 'CREATE',
                    data: newProduct,
                });
            }

            return newProduct;
        },
        onMutate: async (newProduct) => {
            await queryClient.cancelQueries({ queryKey: ['products', 'offline', storeId] });
            const previousProducts = queryClient.getQueryData<Product[]>(['products', 'offline', storeId]) || [];
            
            let categoryObj = undefined;
            if (newProduct.category_id) {
                const categories = queryClient.getQueryData<any[]>(['categories']);
                const newCat = categories?.find(c => c.id === newProduct.category_id);
                categoryObj = newCat ? { name: newCat.name } : undefined;
            }

            const optimisticProduct = {
                ...newProduct,
                id: crypto.randomUUID(),
                category: categoryObj,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            queryClient.setQueryData(['products', 'offline', storeId], (old: any) => [...(old || []), optimisticProduct]);
            return { previousProducts };
        },
        onError: (err, newProduct, context) => {
            queryClient.setQueryData(['products', 'offline', storeId], context?.previousProducts);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['products', 'offline', storeId] });
            queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
        },
    });
};

export const useUpdateProductOffline = () => {
    const queryClient = useQueryClient();
    const isOnline = useOnlineStatus();
    const { data: store } = useUserStore();
    const storeId = store?.id;

    return useMutation({
        mutationFn: async ({ id, ...product }: {
            id: string;
            name: string;
            price: number;
            cost?: number;
            cost_includes_tax?: boolean;
            tax_percentage?: number;
            internal_code?: string;
            barcode?: string;
            category_id?: string | null;
            stock: number;
            min_stock: number;
            status: 'active' | 'inactive';
            image_url?: string;
            discount_percentage?: number;
            discount_start_date?: string | null;
            discount_end_date?: string | null;
            is_featured?: boolean;
            is_variable_price?: boolean;
            is_variable_quantity?: boolean;
            is_visible_in_store?: boolean;
            track_inventory?: boolean;
            store_id?: string;
            reason?: string;
        }) => {
            const actualStoreId = product.store_id || storeId;

            // Obtener el producto existente en IndexedDB para realizar un merge y no perder sub-relaciones
            const existing = await offlineDB.get<Product>(OfflineStore.PRODUCTS, id);

            let categoryObj = existing?.category;
            if (product.category_id !== existing?.category_id) {
                if (product.category_id) {
                    const categories = queryClient.getQueryData<any[]>(['categories']);
                    const newCat = categories?.find(c => c.id === product.category_id);
                    categoryObj = newCat ? { name: newCat.name } : undefined;
                } else {
                    categoryObj = undefined;
                }
            }

            const updatedProduct = {
                ...existing,
                ...product,
                id,
                store_id: actualStoreId,
                category: categoryObj,
                updated_at: new Date().toISOString(),
            };

            // Registrar movimiento de inventario si cambia el stock
            const oldStock = existing?.stock || 0;
            const newStock = product.stock || 0;
            const diff = newStock - oldStock;

            if (existing && diff !== 0) {
                const { data: { user } } = await supabase.auth.getUser();
                const userName = user?.email || 'Sistema';
                
                const newMovement = {
                    id: crypto.randomUUID(),
                    store_id: actualStoreId,
                    product_id: id,
                    profile_id: user?.id || null,
                    user_name: userName,
                    quantity_changed: diff,
                    previous_stock: oldStock,
                    new_stock: newStock,
                    reason: product.reason || 'Ajuste manual de inventario',
                    created_at: new Date().toISOString(),
                };
                
                await offlineDB.put(OfflineStore.INVENTORY_MOVEMENTS, newMovement);
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.INVENTORY_MOVEMENTS,
                    operation: 'CREATE',
                    data: newMovement,
                });
            }

            // Actualizar en IndexedDB
            await offlineDB.put(OfflineStore.PRODUCTS, updatedProduct);

            // Si estamos online, intentar actualizar en Supabase
            if (isOnline) {
                try {
                    // Filtrar propiedades relacionales que no existen en la tabla
                    const { category, barcodes, created_at, updated_at, reason, ...cleanProduct } = product as any;

                    const { error } = await supabase
                        .from('products')
                        .update(cleanProduct)
                        .eq('id', id);

                    if (error) throw error;
                    return updatedProduct;
                } catch (error) {
                    console.error('Error actualizando en Supabase, agregando a cola:', error);
                    await offlineDB.addToSyncQueue({
                        store: OfflineStore.PRODUCTS,
                        operation: 'UPDATE',
                        data: updatedProduct,
                    });
                }
            } else {
                // Offline: agregar a cola
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.PRODUCTS,
                    operation: 'UPDATE',
                    data: updatedProduct,
                });
            }

            return updatedProduct;
        },
        onMutate: async (updatedProduct) => {
            await queryClient.cancelQueries({ queryKey: ['products', 'offline', storeId] });
            const previousProducts = queryClient.getQueryData<Product[]>(['products', 'offline', storeId]) || [];
            
            let categoryObj = undefined;
            if (updatedProduct.category_id) {
                const categories = queryClient.getQueryData<any[]>(['categories']);
                const newCat = categories?.find(c => c.id === updatedProduct.category_id);
                categoryObj = newCat ? { name: newCat.name } : undefined;
            }

            queryClient.setQueryData(['products', 'offline', storeId], (old: Product[]) => 
                old?.map(p => {
                    if (p.id === updatedProduct.id) {
                        return {
                            ...p,
                            ...updatedProduct,
                            category: categoryObj !== undefined ? categoryObj : p.category
                        };
                    }
                    return p;
                })
            );
            return { previousProducts };
        },
        onError: (err, updatedProduct, context) => {
            queryClient.setQueryData(['products', 'offline', storeId], context?.previousProducts);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['products', 'offline', storeId] });
            queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
        },
    });
};

export const useDeleteProductOffline = () => {
    const queryClient = useQueryClient();
    const isOnline = useOnlineStatus();
    const { data: store } = useUserStore();
    const storeId = store?.id;

    return useMutation({
        mutationFn: async (id: string) => {
            // Eliminar de IndexedDB
            await offlineDB.delete(OfflineStore.PRODUCTS, id);

            // Si estamos online, intentar eliminar de Supabase
            if (isOnline) {
                try {
                    const { error: rpcError } = await supabase.rpc('delete_product_cascade' as any, {
                        target_product_id: id
                    });

                    if (rpcError) {
                        if (rpcError.message.includes('Could not find') || rpcError.message.includes('function delete_product_cascade')) {
                            throw new Error('FALTA_SQL');
                        }
                        throw rpcError;
                    }
                } catch (error) {
                    console.error('Error eliminando de Supabase, agregando a cola:', error);
                    await offlineDB.addToSyncQueue({
                        store: OfflineStore.PRODUCTS,
                        operation: 'DELETE',
                        data: { id },
                    });
                }
            } else {
                // Offline: agregar a cola
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.PRODUCTS,
                    operation: 'DELETE',
                    data: { id },
                });
            }
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['products', 'offline', storeId] });
            const previousProducts = queryClient.getQueryData<Product[]>(['products', 'offline', storeId]);
            
            queryClient.setQueryData(['products', 'offline', storeId], (old: Product[]) => 
                old?.filter(p => p.id !== id)
            );
            return { previousProducts };
        },
        onError: (err, id, context) => {
            queryClient.setQueryData(['products', 'offline', storeId], context?.previousProducts);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['products', 'offline', storeId] });
        },
    });
};
