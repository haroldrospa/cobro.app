/**
 * Hook para crear ventas con soporte offline completo
 * Las ventas se guardan localmente cuando no hay internet y se sincronizan automáticamente
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CartItem } from '@/types/pos';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';
import { useOnlineStatus } from './useProductsOffline';

interface CreateSaleData {
    customer_id?: string;
    invoice_type_id: string;
    invoice_type_code?: string;
    is_electronic?: boolean;
    subtotal: number;
    discount_total: number;
    tax_total: number;
    total: number;
    payment_method: string;
    amount_received?: number;
    change_amount?: number;
    split_cash?: number | null;
    split_method?: string | null;
    payment_status?: string;
    due_date?: string;
    items: CartItem[];
    store_id?: string;
    id?: string;
    profile_id?: string;
}

export const useCreateSaleOffline = () => {
    const queryClient = useQueryClient();
    const isOnline = useOnlineStatus();

    return useMutation({
        mutationFn: async (saleData: CreateSaleData) => {
            const saleId = crypto.randomUUID();
            const localInvoiceNumber = await generateLocalInvoiceNumber(saleData.invoice_type_id);

            // Obtener store_id local
            const storeId = await getLocalStoreId();

            // Obtener usuario actual para profile_id de forma local/rápida sin peticiones de red
            let profileId = saleData.profile_id;
            if (!profileId) {
                const { data: sessionData } = await supabase.auth.getSession();
                profileId = sessionData.session?.user?.id || null;
            }

            // Preparar la venta completa
            const completeSale = {
                id: saleId,
                invoice_number: localInvoiceNumber,
                customer_id: saleData.customer_id || null,
                profile_id: profileId, // Guardar ID del usuario creador
                invoice_type_id: saleData.invoice_type_id,
                subtotal: saleData.subtotal,
                discount_total: saleData.discount_total,
                tax_total: saleData.tax_total,
                total: saleData.total,
                payment_method: saleData.payment_method,
                amount_received: saleData.amount_received,
                change_amount: saleData.change_amount,
                split_cash: saleData.split_cash,
                split_method: saleData.split_method,
                payment_status: saleData.payment_status || 'paid',
                due_date: saleData.due_date || null,
                created_at: new Date().toISOString(),
                synced: false, // Marca para saber si se sincronizó
                store_id: storeId, // Agregamos store_id
                items: saleData.items, // Guardamos los items con la venta
            };

            // Guardar venta en IndexedDB siempre primero
            await offlineDB.put(OfflineStore.SALES, completeSale);
            console.log('💾 Venta guardada localmente:', localInvoiceNumber);

            // Actualizar stock local en paralelo (Optimizado con putBulk) y registrar movimientos
            const validItems = saleData.items.filter(item => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id));
            if (validItems.length > 0) {
                const productsToUpdate: any[] = [];
                const movementsToInsert: any[] = [];
                const userName = 'Sistema';

                for (const item of validItems) {
                    const product = await offlineDB.get<any>(OfflineStore.PRODUCTS, item.id);
                    if (product) {
                        const previousStock = product.stock || 0;
                        const newStock = Math.max(0, previousStock - item.quantity);
                        
                        product.stock = newStock;
                        productsToUpdate.push(product);

                        // Crear movimiento de historial de inventario
                        const newMovement = {
                            id: crypto.randomUUID(),
                            store_id: storeId,
                            product_id: item.id,
                            profile_id: profileId,
                            user_name: userName,
                            quantity_changed: -item.quantity,
                            previous_stock: previousStock,
                            new_stock: newStock,
                            reason: `Venta #${localInvoiceNumber}`,
                            created_at: new Date().toISOString(),
                        };
                        movementsToInsert.push(newMovement);

                        // Añadir a la cola de sincronización para Supabase
                        await offlineDB.addToSyncQueue({
                            store: OfflineStore.INVENTORY_MOVEMENTS,
                            operation: 'CREATE',
                            data: newMovement,
                        });
                    }
                }
                if (productsToUpdate.length > 0) {
                    await offlineDB.putBulk(OfflineStore.PRODUCTS, productsToUpdate);
                }
                if (movementsToInsert.length > 0) {
                    await offlineDB.putBulk(OfflineStore.INVENTORY_MOVEMENTS, movementsToInsert);
                }
            }

            if (isOnline) {
                // Modo ONLINE: Forzar subida directa y fallar si hay errores (nada en segundo plano)
                console.log('🌐 Dispositivo online, guardando venta directamente en Supabase...');
                try {
                    const result = await saveSaleToSupabase({ ...saleData, id: saleId, store_id: storeId || undefined });

                    const updatedCompleteSale = {
                        ...completeSale,
                        invoice_number: result.encf || result.invoice_number,
                        is_electronic: result.is_electronic || false,
                        estado_fiscal: result.estado_fiscal || null,
                        encf: result.encf || null,
                        codigo_seguridad: result.codigo_seguridad || null,
                        qrcode_url: result.qrcode_url || null,
                        fecha_firma: result.fecha_firma || null,
                        synced: true
                    };
                    await offlineDB.put(OfflineStore.SALES, updatedCompleteSale);
                    await updateLocalSequenceFromOnlineSale(saleData.invoice_type_id, result.invoice_number);
                    console.log('✅ Venta sincronizada con Supabase:', result.encf || result.invoice_number);
                    return updatedCompleteSale;
                } catch (error: any) {
                    console.error('❌ Error crítico guardando en Supabase en modo online:', error);
                    // Lanzar el error para que la UI muestre el fallo real y no continúe como si hubiera tenido éxito
                    throw error;
                }
            } else {
                // Modo OFFLINE: Guardar localmente y encolar para sincronización posterior
                console.warn('🔌 Dispositivo offline, guardando venta localmente en cola de sincronización...');
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.SALES,
                    operation: 'CREATE',
                    data: completeSale,
                });
                return completeSale;
            }

            return completeSale;
        },
        onMutate: async (newSale) => {
            // Cancelar queries para evitar sobreescritura
            await queryClient.cancelQueries({ queryKey: ['sales'] });
            await queryClient.cancelQueries({ queryKey: ['products'] });

            const previousSales = queryClient.getQueryData(['sales']);
            const previousProducts = queryClient.getQueryData(['products']);

            // Actualización optimista de stock
            queryClient.setQueryData(['products'], (old: any[]) => {
                if (!old) return old;
                return old.map(p => {
                    const saleItem = newSale.items.find(item => item.id === p.id);
                    if (saleItem) {
                        return { ...p, stock: Math.max(0, (p.stock || 0) - saleItem.quantity) };
                    }
                    return p;
                });
            });

            // Actualización optimista de ventas (si existe la query)
            queryClient.setQueryData(['sales'], (old: any[]) => {
                const optimisticSale = {
                    ...newSale,
                    id: newSale.id || crypto.randomUUID(),
                    invoice_number: 'PENDIENTE...',
                    created_at: new Date().toISOString(),
                    synced: false
                };
                return [optimisticSale, ...(old || [])];
            });

            return { previousSales, previousProducts };
        },
        onError: (err, newSale, context) => {
            queryClient.setQueryData(['sales'], context?.previousSales);
            queryClient.setQueryData(['products'], context?.previousProducts);
        },
        onSettled: () => {
            // Only invalidate what actually changes from a sale
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
        },
    });
};

// Función para generar número de factura local (cuando estamos offline)
async function generateLocalInvoiceNumber(invoiceTypeId: string): Promise<string> {
    // 1. Obtener los tipos de factura cacheados para resolver UUID -> Code
    let typeCode = invoiceTypeId;

    // Si parece ser un UUID (longitud 36), buscar su código real
    if (invoiceTypeId.length > 10) {
        const cachedType = await offlineDB.get<any>(OfflineStore.INVOICE_TYPES, invoiceTypeId);
        if (cachedType && cachedType.code) {
            typeCode = cachedType.code;
        }
    }

    // 2. Obtener las configuraciones de secuencias guardadas localmente
    const settings = await offlineDB.get<any>(OfflineStore.SETTINGS, 'invoice_sequences');

    // Check if electronic billing is active locally
    const storeId = await getLocalStoreId();
    let isElectronicActive = false;
    if (storeId) {
        const alanubeConfig = await offlineDB.get<any>(OfflineStore.SETTINGS, `alanube_config_${storeId}`);
        isElectronicActive = alanubeConfig?.is_active || false;
    }

    // Si no hay configuración, usar un número temporal pero intentando respetar el prefijo
    if (!settings) {
        const timestamp = Date.now();
        return `${typeCode}-OFFLINE-${timestamp}`;
    }

    // 3. Generar número usando la secuencia correcta
    // Usamos typeCode (ej: 'B02') para buscar en settings
    const sequence = settings[typeCode] || { current: 0 };

    sequence.current += 1;

    let displayPrefix = typeCode;
    let separator = '-';
    let padding = 8;

    if (isElectronicActive) {
        separator = '';
        padding = 10;
        switch (typeCode) {
            case 'B01': displayPrefix = 'E31'; break;
            case 'B02': displayPrefix = 'E32'; break;
            case 'B03': displayPrefix = 'E33'; break;
            case 'B04': displayPrefix = 'E34'; break;
            case 'B14': displayPrefix = 'E44'; break;
            case 'B15': displayPrefix = 'E45'; break;
            case 'B16': displayPrefix = 'E46'; break;
        }
    }

    const formattedNumber = `${displayPrefix}${separator}${String(sequence.current).padStart(padding, '0')}`;

    console.log(`🎫 Generando factura offline: Tipo=${typeCode} (#${sequence.current}) -> ${formattedNumber}`);

    // Guardar la secuencia actualizada
    await offlineDB.put(OfflineStore.SETTINGS, {
        key: 'invoice_sequences',
        ...settings,
        [typeCode]: sequence,
    });

    return formattedNumber;
}

// Función auxiliar para actualizar la secuencia local desde una venta online exitosa
async function updateLocalSequenceFromOnlineSale(invoiceTypeId: string, invoiceNumber: string) {
    try {
        const match = invoiceNumber.match(/\d+$/);
        if (!match || !match[0]) return;

        const currentNumber = parseInt(match[0], 10);
        const settings = await offlineDB.get<any>(OfflineStore.SETTINGS, 'invoice_sequences') || {};
        
        let typeCode = invoiceTypeId;
        if (invoiceTypeId.length > 10) {
            const cachedType = await offlineDB.get<any>(OfflineStore.INVOICE_TYPES, invoiceTypeId);
            if (cachedType && cachedType.code) {
                typeCode = cachedType.code;
            }
        }

        // Solo actualizar si el número es mayor al que tenemos
        const currentSequence = settings[typeCode] || { current: 0 };
        if (currentNumber > (currentSequence.current || 0)) {
            const isElectronic = invoiceNumber.startsWith('E');
            settings[typeCode] = {
                current: currentNumber,
                prefix: isElectronic ? invoiceNumber.slice(0, 3) : `${typeCode}-`
            };

            await offlineDB.put(OfflineStore.SETTINGS, {
                key: 'invoice_sequences',
                ...settings
            });
            console.log('🔄 Secuencia local actualizada desde venta online:', invoiceNumber);
        }
    } catch (e) {
        console.error('Error actualizando secuencia local:', e);
    }
}

// Función auxiliar para obtener el store_id localmente
async function getLocalStoreId(): Promise<string | null> {
    // Intentar obtenerlo del token de sesión almacenado o configuración
    // Por simplicidad, intentamos obtener un perfil cacheado si existe, o usamos null
    // y dejamos que el backend (o la sincronización) lo resuelva si es posible.
    // Una mejor opción es guardar el store_id en 'settings' al loguearse.
    const settings = await offlineDB.get<any>(OfflineStore.SETTINGS, 'user_profile');
    return settings?.store_id || null;
}

// Función para guardar venta en Supabase (cuando hay conexión)
async function saveSaleToSupabase(saleData: CreateSaleData) {
    let profileId = saleData.profile_id;
    if (!profileId) {
        const { data: sessionData } = await supabase.auth.getSession();
        profileId = sessionData.session?.user?.id;
    }
    if (!profileId) throw new Error('Usuario no autenticado');

    // 0. VERIFICACIÓN PREVENTIVA: Si ya tenemos un ID, revisar si ya existe la venta
    if (saleData.id) {
        const { data: existingSale } = await supabase
            .from('sales')
            .select('*')
            .eq('id', saleData.id)
            .maybeSingle();

        if (existingSale) {
            console.log('✅ Factura ya registrada anteriormente (ID duplicado evitado):', existingSale.invoice_number);
            return existingSale;
        }
    }

    let storeId = saleData.store_id;

    if (!storeId) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('store_id')
            .eq('id', profileId)
            .maybeSingle();

        storeId = profile?.store_id;
    }

    if (!storeId) {
        const localSettings = await offlineDB.get<any>(OfflineStore.SETTINGS, 'user_profile');
        if (localSettings?.store_id) {
            storeId = localSettings.store_id;
        }

        if (!storeId) {
            console.error('CRITICAL: Intentando guardar venta sin store_id');
            throw new Error('No se pudo identificar la tienda (store_id) para esta venta. Por favor recarga la página.');
        }
    }

    // --- RPC PATH: Intentar facturación atómica de 1 roundtrip ---
    try {
        console.log('⚡ Ejecutando facturación rápida via RPC...');
        const rpcItems = saleData.items.map(item => ({
            id: item.id,
            price: item.price,
            quantity: item.quantity,
            tax: item.tax,
            cost_includes_tax: item.cost_includes_tax || false
        }));

        const { data: rpcResult, error: rpcError } = await supabase.rpc('create_sale_transaction_v3', {
            p_sale_id: saleData.id || crypto.randomUUID(),
            p_customer_id: saleData.customer_id || null,
            p_invoice_type_id: saleData.invoice_type_id,
            p_subtotal: saleData.subtotal,
            p_discount_total: saleData.discount_total,
            p_tax_total: saleData.tax_total,
            p_total: saleData.total,
            p_payment_method: saleData.payment_method,
            p_amount_received: saleData.amount_received || null,
            p_change_amount: saleData.change_amount || null,
            p_split_cash: saleData.split_cash || null,
            p_split_method: saleData.split_method || null,
            p_payment_status: saleData.payment_status || 'paid',
            p_due_date: saleData.due_date || null,
            p_store_id: storeId,
            p_profile_id: profileId,
            p_items: rpcItems
        });

        if (rpcError) {
            console.error('❌ RPC create_sale_transaction_v3 falló:', rpcError);
            throw rpcError;
        }

        if (rpcResult) {
            console.log('✅ Facturación rápida via RPC completada con éxito:', rpcResult.invoice_number);

            // Emisión de Alanube en segundo plano (asíncrona)
            if (rpcResult.is_electronic_active) {
                console.log('🔌 Alanube e-NCF está activo. Emitiendo comprobante electrónico en segundo plano...');
                import('@/services/alanube/AlanubeService')
                    .then(({ AlanubeService }) => {
                        AlanubeService.emitirFacturaElectronica(rpcResult.id, true);
                    })
                    .catch(err => console.error('⚠️ Error al cargar AlanubeService para emisión en segundo plano:', err));
            }

            return rpcResult;
        }
    } catch (err: any) {
        if (err && err.code === 'PGRST202') {
            console.warn('🔄 RPC no encontrado. Usando fallback clásico de facturación por JS...');
        } else {
            console.error('❌ Error crítico en RPC de facturación:', err);
            throw err;
        }
    }

    // --- FALLBACK CLÁSICO POR JS ---
    let traditionalCode = saleData.invoice_type_code || saleData.invoice_type_id;

    if (traditionalCode.length > 10) {
        const { data: invoiceTypeData } = await supabase
            .from('invoice_types')
            .select('code')
            .eq('id', saleData.invoice_type_id)
            .single();
        if (invoiceTypeData?.code) {
            traditionalCode = invoiceTypeData.code;
        }
    }

    let isElectronicActive = saleData.is_electronic;
    if (isElectronicActive === undefined) {
        const { data: alanubeConfig } = await supabase
            .from('alanube_config')
            .select('is_active')
            .eq('store_id', storeId)
            .maybeSingle();
        isElectronicActive = alanubeConfig?.is_active || false;
    }

    let attempts = 0;
    const maxAttempts = 20;
    let finalSale = null;
    let highestTriedNumber = 0;

    while (attempts < maxAttempts) {
        attempts++;
        try {
            let currentSeqNumber = 0;
            let sequenceRowId = null;

            if (storeId) {
                const { data: seqData } = await supabase
                    .from('invoice_sequences')
                    .select('id, current_number')
                    .eq('invoice_type_id', traditionalCode)
                    .eq('store_id', storeId)
                    .maybeSingle();

                if (seqData) {
                    currentSeqNumber = seqData.current_number;
                    sequenceRowId = seqData.id;
                }

                // AUTO-REPARACIÓN AGRESIVA: Siempre verificar el máximo real en la tabla de ventas
                // Esto evita el ciclo lento de 20 reintentos si la secuencia se quedó atascada
                const { data: maxSale } = await supabase
                    .from('sales')
                    .select('invoice_number')
                    .eq('store_id', storeId)
                    .eq('invoice_type_id', saleData.invoice_type_id)
                    .order('invoice_number', { ascending: false })
                    .limit(1);

                if (maxSale && maxSale.length > 0) {
                    const m = maxSale[0].invoice_number?.match(/-(\d{1,9})$/);
                    if (m) {
                        const maxRealNumber = parseInt(m[1], 10);
                        if (maxRealNumber > currentSeqNumber) {
                            console.log(`🔄 Auto-reparando secuencia para ${traditionalCode}: saltando de ${currentSeqNumber} a ${maxRealNumber}`);
                            currentSeqNumber = maxRealNumber;
                        }
                    }
                }
            }

            const nextNumber = Math.max(currentSeqNumber + 1, highestTriedNumber + 1);
            
            let displayPrefix = traditionalCode;
            let separator = '-';
            let padding = 8;

            if (isElectronicActive) {
                separator = '';
                padding = 10;
                switch (traditionalCode) {
                    case 'B01': displayPrefix = 'E31'; break;
                    case 'B02': displayPrefix = 'E32'; break;
                    case 'B03': displayPrefix = 'E33'; break;
                    case 'B04': displayPrefix = 'E34'; break;
                    case 'B14': displayPrefix = 'E44'; break;
                    case 'B15': displayPrefix = 'E45'; break;
                    case 'B16': displayPrefix = 'E46'; break;
                }
            }

            const formattedInvoiceNumber = `${displayPrefix}${separator}${String(nextNumber).padStart(padding, '0')}`;

            const { data: sale, error: saleError } = await supabase
                .from('sales')
                .insert([{
                    id: saleData.id,
                    invoice_number: formattedInvoiceNumber,
                    customer_id: saleData.customer_id || null,
                    invoice_type_id: saleData.invoice_type_id,
                    subtotal: saleData.subtotal,
                    discount_total: saleData.discount_total,
                    tax_total: saleData.tax_total,
                    total: saleData.total,
                    payment_method: saleData.payment_method,
                    amount_received: saleData.amount_received,
                    change_amount: saleData.change_amount,
                    split_cash: saleData.split_cash || null,
                    split_method: saleData.split_method || null,
                    payment_status: saleData.payment_status || 'paid',
                    due_date: saleData.due_date || null,
                    store_id: storeId || null,
                    profile_id: profileId
                }])
                .select()
                .single();

            if (saleError) {
                const errorMsg = saleError.message || '';

                if (saleError.code === '23505' || errorMsg.includes('unique constraint') || errorMsg.includes('duplicate')) {
                    // BULLETPROOF IDEMPOTENCY CHECK:
                    // En vez de depender del texto del error ('sales_pkey'), verificamos directamente
                    // si la venta ya se insertó (ej. por el RPC que triunfó pero dio timeout al cliente)
                    const { data: checkExisting } = await supabase
                        .from('sales')
                        .select('id')
                        .eq('id', saleData.id!)
                        .maybeSingle();

                    if (checkExisting) {
                        console.log('✅ La venta ya existe por ID (idempotencia comprobada). Recuperando registro...');
                        const { data: existingSale } = await supabase
                            .from('sales')
                            .select()
                            .eq('id', saleData.id!)
                            .single();
                        if (existingSale) {
                            finalSale = existingSale;
                            break;
                        }
                    }

                    // Si NO fue por el ID, entonces fue choque de secuencia (invoice_number). Reintentamos.
                    console.warn(`Choque de secuencia detectado (intento ${attempts}). Reintentando...`);
                    highestTriedNumber = Math.max(highestTriedNumber, nextNumber);
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100)); // Reducido a 100-400ms
                    continue;
                }
                throw saleError;
            }

            if (sequenceRowId) {
                await supabase
                    .from('invoice_sequences')
                    .update({ current_number: nextNumber, updated_at: new Date().toISOString() })
                    .eq('id', sequenceRowId)
                    .lt('current_number', nextNumber);
            } else if (storeId) {
                await supabase.from('invoice_sequences').insert({
                    store_id: storeId,
                    invoice_type_id: traditionalCode,
                    current_number: nextNumber
                });
            }

            finalSale = sale;
            break;

        } catch (err: any) {
            if (attempts === maxAttempts) throw err;
            if (!err.message?.includes('duplicate') && !err.message?.includes('unique constraint')) throw err;
        }
    }

    if (!finalSale) throw new Error('No se pudo generar número de factura único tras varios intentos');

    const totalSubtotal = saleData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const saleItems = saleData.items.map(item => {
        const taxRate = item.tax || 0.18;
        const itemSubtotal = item.price * item.quantity;
        const itemProportion = totalSubtotal > 0 ? itemSubtotal / totalSubtotal : 0;
        const itemDiscountAmount = saleData.discount_total * itemProportion;
        const itemDiscountPercentage = itemSubtotal > 0 ? (itemDiscountAmount / itemSubtotal) * 100 : 0;
        const itemAfterDiscount = itemSubtotal - itemDiscountAmount;

        let finalItemTaxAmount, finalItemTotal;

        if (item.cost_includes_tax) {
            finalItemTotal = itemAfterDiscount;
            const baseNet = finalItemTotal / (1 + taxRate);
            finalItemTaxAmount = finalItemTotal - baseNet;
        } else {
            finalItemTaxAmount = itemAfterDiscount * taxRate;
            finalItemTotal = itemAfterDiscount + finalItemTaxAmount;
        }

        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id);

        return {
            sale_id: finalSale.id,
            product_id: isValidUuid ? item.id : null,
            quantity: item.quantity,
            unit_price: item.price,
            discount_percentage: itemDiscountPercentage,
            tax_percentage: taxRate * 100,
            subtotal: itemSubtotal,
            discount_amount: itemDiscountAmount,
            tax_amount: finalItemTaxAmount,
            total: finalItemTotal
        };
    });

    const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

    if (itemsError) throw itemsError;

    const validItems = saleData.items.filter(item =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id)
    );

    await Promise.all(validItems.map(async (item) => {
        const { data: product } = await supabase
            .from('products')
            .select('stock')
            .eq('id', item.id)
            .single();

        const updateAndRecipePromises: Promise<any>[] = [];

        if (product) {
            const newStock = Math.max(0, (product.stock || 0) - item.quantity);
            updateAndRecipePromises.push(
                supabase.from('products').update({ stock: newStock }).eq('id', item.id)
            );
        }

        try {
            const { data: recipes } = await supabase
                .from('product_recipes')
                .select('ingredient_id, quantity')
                .eq('product_id', item.id);

            if (recipes && recipes.length > 0) {
                const recipeDeductions = recipes.map(recipe =>
                    supabase.rpc('decrement_ingredient_stock', {
                        p_ingredient_id: recipe.ingredient_id,
                        p_amount: recipe.quantity * item.quantity,
                    })
                );
                updateAndRecipePromises.push(...recipeDeductions);
            }
        } catch (recipeErr) {
            console.warn('⚠️ No se pudieron descontar ingredientes de receta:', recipeErr);
        }

        await Promise.all(updateAndRecipePromises);
    }));

    // Emisión de Alanube en segundo plano (asíncrona)
    if (isElectronicActive && storeId) {
        console.log('🔌 Alanube e-NCF está activo. Emitiendo comprobante electrónico en segundo plano...');
        import('@/services/alanube/AlanubeService')
            .then(({ AlanubeService }) => {
                AlanubeService.emitirFacturaElectronica(finalSale.id, true);
            })
            .catch(err => console.error('⚠️ Error cargando AlanubeService para emisión en segundo plano:', err));
    }

    return finalSale;
}
