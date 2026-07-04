/**
 * Sistema de Sincronización Automática
 * Sincroniza datos offline con Supabase cuando hay conexión
 */

import { offlineDB, OfflineStore, SyncQueueItem } from './offlineDB';
import { supabase } from '@/integrations/supabase/client';

class OfflineSyncManager {
    private isSyncing = false;
    private syncInterval: number | null = null;
    private onlineListener: (() => void) | null = null;
    private offlineListener: (() => void) | null = null;
    private abortController: AbortController | null = null;

    // Estado de conexión
    get isOnline(): boolean {
        return navigator.onLine;
    }

    // Iniciar el manager de sincronización
    start() {
        // Escuchar eventos de conexión
        this.onlineListener = this.handleOnline.bind(this);
        this.offlineListener = this.handleOffline.bind(this);

        window.addEventListener('online', this.onlineListener);
        window.addEventListener('offline', this.offlineListener);

        // Intentar sincronizar cada 5 minutos si estamos online
        this.syncInterval = window.setInterval(() => {
            if (this.isOnline && !this.isSyncing) {
                this.sync();
            }
        }, 300000); // 5 minutos

        // CRITICAL: Defer initial sync by 8 seconds to avoid blocking the initial render on mobile.
        // The UI must be interactive before we start downloading products, customers, etc.
        if (this.isOnline) {
            setTimeout(() => {
                if (this.isOnline && !this.isSyncing) {
                    console.log('[OfflineSync] Iniciando sincronización diferida (8s post-startup)...');
                    this.sync();
                }
            }, 8000);
        }

        console.log('🔄 Offline Sync Manager iniciado (Intervalo: 5m, Primera sync en 8s)');
    }

    private getNextSignal(): AbortSignal {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();
        return this.abortController.signal;
    }

    // Detener el manager
    stop() {
        if (this.onlineListener) {
            window.removeEventListener('online', this.onlineListener);
        }
        if (this.offlineListener) {
            window.removeEventListener('offline', this.offlineListener);
        }
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        console.log('⏹️ Offline Sync Manager detenido');
    }

    private async handleOnline() {
        console.log('✅ Conexión restaurada - sincronización en 3s...');
        // Wait 3s before syncing on reconnect to avoid competing with UI recovery
        setTimeout(async () => {
            await this.reconcileSequences();
            if (!this.isSyncing) this.sync();
        }, 3000);
    }

    private handleOffline() {
        console.log('❌ Sin conexión - modo offline activado');
    }

    // Sincronizar todos los datos pendientes
    async sync(): Promise<void> {
        if (this.isSyncing || !this.isOnline) {
            return;
        }

        this.isSyncing = true;
        const signal = this.getNextSignal();
        console.log('🔄 Iniciando sincronización...');

        try {
            // 1. Sincronizar datos (PRIMERO SUBIR CAMBIOS LOCALES)
            // Esto es crucial para que las secuencias locales avanzadas se guarden en el servidor
            // antes de descargar los valores del servidor (que podrían ser más viejos si no subimos primero).
            await this.syncToSupabase(signal);

            // 2. Sincronizar datos desde Supabase a IndexedDB (DESCARGAR CAMBIOS)
            await this.syncFromSupabase(signal);

            // 3. Sincronizar (Reconciliar) Secuencias - CRÍTICO para evitar duplicados
            await this.reconcileSequences(signal);

            // 4. Limpiar items antiguos
            await offlineDB.cleanOldSyncedItems();

            console.log('✅ Sincronización completada');
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                console.log('⏹️ Sincronización abortada');
            } else {
                console.error('❌ Error en sincronización:', error);
            }
        } finally {
            this.isSyncing = false;
        }
    }

    // RECONCILIADOR DE SECUENCIAS (Bidireccional)
    // Asegura que Online y Offline estén siempre en el número más alto
    private async reconcileSequences(signal?: AbortSignal): Promise<void> {
        try {
            console.log('⚖️ Reconciliando secuencias...');

            // 1. Obtener usuario y tienda
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('store_id')
                .eq('id', user.id)
                .maybeSingle();

            if (!profile?.store_id) return;

            // 2. Obtener secuencias Locales
            const localSettings = await offlineDB.get<any>(OfflineStore.SETTINGS, 'invoice_sequences') || {};

            // 3. Obtener secuencias Remotas
            const { data: remoteSequences } = await supabase
                .from('invoice_sequences')
                .select('*')
                .eq('store_id', profile.store_id)
                .abortSignal(signal || null);

            if (!remoteSequences) return;

            let updatesMade = false;

            // 4. Comparar y corregir
            for (const remote of remoteSequences) {
                const typeCode = remote.invoice_type_id;
                const localSeq = localSettings[typeCode];

                // Caso A: Local está más adelantado (Offline avanzó más)
                if (localSeq && localSeq.current > remote.current_number) {
                    console.log(`⚡️ CORRIGIENDO REMOTO: ${typeCode} Local(${localSeq.current}) > Remoto(${remote.current_number})`);

                    // Actualizar Supabase directamente
                    const { error } = await supabase
                        .from('invoice_sequences')
                        .update({
                            current_number: localSeq.current,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', remote.id)
                        .abortSignal(signal || null);

                    if (error) {
                        console.error('Error actualizando secuencia remota:', error);
                        // Fallback a RPC si el update directo falla
                        await supabase.rpc('update_invoice_sequence_max' as any, {
                            p_invoice_type_id: typeCode,
                            p_store_id: profile.store_id,
                            p_new_sequence_number: localSeq.current
                        }, { abortSignal: signal });
                    }
                    updatesMade = true;
                }
                // Caso B: Remoto está más adelantado (Hubo ventas en otro PC)
                else if (localSeq && remote.current_number > localSeq.current) {
                    console.log(`⚡️ CORRIGIENDO LOCAL: ${typeCode} Remoto(${remote.current_number}) > Local(${localSeq.current})`);

                    localSettings[typeCode] = {
                        current: remote.current_number,
                        prefix: `${typeCode}-`
                    };
                    updatesMade = true;
                }
            }

            // Guardar cambios locales si hubo correcciones
            if (updatesMade) {
                await offlineDB.put(OfflineStore.SETTINGS, {
                    key: 'invoice_sequences',
                    ...localSettings
                });
                console.log('✅ Secuencias sincronizadas y corregidas');
            }

        } catch (error: any) {
            if (!navigator.onLine || error?.message?.includes('Failed to fetch')) {
                // Silent fail for network issues during reconciliation
            } else {
                console.error('⚠️ Error en reconciliación de secuencias:', error);
            }
        }
    }

    // Descargar datos desde Supabase a IndexedDB
    private async syncFromSupabase(signal?: AbortSignal): Promise<void> {
        try {
            // Obtener el usuario actual
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Obtener store_id del usuario
            const { data: profile } = await supabase
                .from('profiles')
                .select('store_id, is_active')
                .eq('id', user.id)
                .maybeSingle();

            const storeId = profile?.store_id;

            // Guardar perfil en offline DB para tener el store_id disponible offline
            if (profile) {
                await offlineDB.put(OfflineStore.SETTINGS, {
                    key: 'user_profile',
                    store_id: profile.store_id,
                    is_active: profile.is_active
                });
            }

            // Sincronizar productos
            let allProducts: any[] = [];
            let productsError = null;
            let hasMoreProducts = true;
            let fromProd = 0;
            const stepProd = 1000;

            while (hasMoreProducts) {
                let productsQuery = supabase
                    .from('products')
                    .select(`
                        *,
                        category:categories(name),
                        barcodes:product_barcodes(id, barcode, label)
                    `)
                    .range(fromProd, fromProd + stepProd - 1)
                    .abortSignal(signal || null);

                if (storeId) {
                    productsQuery = productsQuery.eq('store_id', storeId);
                }

                const { data: chunk, error: chunkError } = await productsQuery;

                if (chunkError) {
                    productsError = chunkError;
                    break;
                }

                if (chunk && chunk.length > 0) {
                    allProducts = [...allProducts, ...chunk];
                    fromProd += stepProd;
                    if (chunk.length < stepProd) {
                        hasMoreProducts = false;
                    }
                } else {
                    hasMoreProducts = false;
                }
            }
            
            const products = allProducts;

            if (productsError) {
                if (!navigator.onLine || productsError.message?.includes('Offline') || productsError.code === 'OFFLINE') {
                    console.warn('⚠️ Sincronización de productos omitida (Modo Offline)');
                } else {
                    console.error('❌ Error sincronizando productos (Status ' + productsError.code + '):', productsError.message);
                }
            } else if (products) {
                // Purge local products for this store that are not in server response
                const localProducts = await offlineDB.getAll<any>(OfflineStore.PRODUCTS);
                const serverProductsIds = new Set(products.map(p => p.id));
                
                const toDelete = localProducts.filter(lp => lp.store_id === storeId && !serverProductsIds.has(lp.id));
                if (toDelete.length > 0) {
                    await offlineDB.deleteBulk(OfflineStore.PRODUCTS, toDelete.map(item => item.id));
                }

                if (products.length > 0) {
                    await offlineDB.putBulk(OfflineStore.PRODUCTS, products);
                }
                console.log(`📦 ${products.length} productos sincronizados (Limpiados ${toDelete.length} obsoletos)`);
            }

            // Sincronizar categorías
            let categoriesQuery = supabase
                .from('categories')
                .select('*')
                .abortSignal(signal || null);

            if (storeId) {
                categoriesQuery = categoriesQuery.eq('store_id', storeId);
            }

            const { data: categories, error: categoriesError } = await categoriesQuery;

            if (!categoriesError && categories) {
                const localCategories = await offlineDB.getAll<any>(OfflineStore.CATEGORIES);
                const serverIds = new Set(categories.map(c => c.id));
                
                const toDelete = localCategories.filter(lc => lc.store_id === storeId && !serverIds.has(lc.id));
                if (toDelete.length > 0) {
                    await offlineDB.deleteBulk(OfflineStore.CATEGORIES, toDelete.map(item => item.id));
                }

                if (categories.length > 0) {
                    await offlineDB.putBulk(OfflineStore.CATEGORIES, categories);
                }
                console.log(`📁 ${categories.length} categorías sincronizadas`);
            }

            // Sincronizar clientes
            let customersQuery = supabase
                .from('customers')
                .select('*')
                .abortSignal(signal || null);

            if (storeId) {
                customersQuery = customersQuery.eq('store_id', storeId);
            }

            const { data: customers, error: customersError } = await customersQuery;

            if (!customersError && customers) {
                const localCustomers = await offlineDB.getAll<any>(OfflineStore.CUSTOMERS);
                const serverIds = new Set(customers.map(c => c.id));
                
                const toDelete = localCustomers.filter(lc => lc.store_id === storeId && !serverIds.has(lc.id));
                if (toDelete.length > 0) {
                    await offlineDB.deleteBulk(OfflineStore.CUSTOMERS, toDelete.map(item => item.id));
                }

                if (customers.length > 0) {
                    await offlineDB.putBulk(OfflineStore.CUSTOMERS, customers);
                }
                console.log(`👥 ${customers.length} clientes sincronizados`);
            }

            // Sincronizar tipos de facturas (cache)
            const { data: invoiceTypes, error: typesError } = await supabase
                .from('invoice_types')
                .select('*')
                .abortSignal(signal || null);

            if (!typesError && invoiceTypes) {
                for (const type of invoiceTypes) {
                    await offlineDB.put(OfflineStore.INVOICE_TYPES, type);
                }
                console.log(`📄 ${invoiceTypes.length} tipos de facturas sincronizados`);
            }

            // Sincronizar secuencias de facturas
            let sequencesQuery = supabase
                .from('invoice_sequences')
                .select('invoice_type_id, current_number')
                .abortSignal(signal || null);

            if (storeId) {
                sequencesQuery = sequencesQuery.eq('store_id', storeId);
            }

            const { data: sequences, error: sequencesError } = await sequencesQuery;

            if (!sequencesError && sequences) {
                const sequenceMap: any = { key: 'invoice_sequences' };

                for (const seq of sequences) {
                    sequenceMap[seq.invoice_type_id] = {
                        current: seq.current_number,
                        prefix: `${seq.invoice_type_id}-`
                    };
                }

                await offlineDB.put(OfflineStore.SETTINGS, sequenceMap);
                console.log(`🔢 ${sequences.length} secuencias sincronizadas`);
            }

            /* Sincronizar movimientos de inventario (comentado porque la tabla aún no existe en Supabase y da error 500)
            let movementsQuery = supabase
                .from('inventory_movements' as any)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(500)
                .abortSignal(signal || null);

            if (storeId) {
                movementsQuery = movementsQuery.eq('store_id', storeId);
            }

            const { data: invMovements, error: invMovementsError } = await movementsQuery;

            if (!invMovementsError && invMovements) {
                const localMovements = await offlineDB.getAll<any>(OfflineStore.INVENTORY_MOVEMENTS);
                const serverIds = new Set(invMovements.map(m => m.id));
                
                const toDelete = localMovements.filter(lm => lm.store_id === storeId && !serverIds.has(lm.id));
                if (toDelete.length > 0) {
                    await offlineDB.deleteBulk(OfflineStore.INVENTORY_MOVEMENTS, toDelete.map(item => item.id));
                }

                if (invMovements.length > 0) {
                    await offlineDB.putBulk(OfflineStore.INVENTORY_MOVEMENTS, invMovements);
                }
                console.log(`📦 ${invMovements.length} movimientos de inventario sincronizados`);
            }
            */

            // Sincronizar gastos fijos mensuales
            let fixedExpensesQuery = supabase
                .from('fixed_expenses' as any)
                .select('*')
                .abortSignal(signal || null);

            if (storeId) {
                fixedExpensesQuery = fixedExpensesQuery.eq('store_id', storeId);
            }

            const { data: fixedExpenses, error: fixedExpensesError } = await fixedExpensesQuery;

            if (!fixedExpensesError && fixedExpenses) {
                const localFixed = await offlineDB.getAll<any>(OfflineStore.FIXED_EXPENSES);
                const serverIds = new Set(fixedExpenses.map(f => f.id));
                
                const toDelete = localFixed.filter(lf => lf.store_id === storeId && !serverIds.has(lf.id));
                if (toDelete.length > 0) {
                    await offlineDB.deleteBulk(OfflineStore.FIXED_EXPENSES, toDelete.map(item => item.id));
                }

                if (fixedExpenses.length > 0) {
                    await offlineDB.putBulk(OfflineStore.FIXED_EXPENSES, fixedExpenses);
                }
                console.log(`📌 ${fixedExpenses.length} gastos fijos sincronizados`);
            }

            // Sincronizar deudas con proveedores (supplier_debts)
            let supplierDebtsQuery = supabase
                .from('supplier_debts' as any)
                .select('*')
                .abortSignal(signal || null);

            if (storeId) {
                supplierDebtsQuery = supplierDebtsQuery.eq('store_id', storeId);
            }

            const { data: supplierDebts, error: supplierDebtsError } = await supplierDebtsQuery;

            if (!supplierDebtsError && supplierDebts) {
                const localDebts = await offlineDB.getAll<any>(OfflineStore.SUPPLIER_DEBTS);
                const serverIds = new Set(supplierDebts.map(d => d.id));
                
                const toDelete = localDebts.filter(ld => ld.store_id === storeId && !serverIds.has(ld.id));
                if (toDelete.length > 0) {
                    await offlineDB.deleteBulk(OfflineStore.SUPPLIER_DEBTS, toDelete.map(item => item.id));
                }

                if (supplierDebts.length > 0) {
                    await offlineDB.putBulk(OfflineStore.SUPPLIER_DEBTS, supplierDebts);
                }
                console.log(`📌 ${supplierDebts.length} deudas con proveedores sincronizadas`);
            }

        } catch (error: any) {
            if (!navigator.onLine || error?.message?.includes('Failed to fetch')) {
                console.warn('Network error syncing from Supabase (offline/unstable):', error?.message);
            } else {
                console.error('Error sincronizando desde Supabase:', error);
            }
            throw error;
        }
    }

    // Enviar operaciones pendientes a Supabase
    private async syncToSupabase(signal?: AbortSignal): Promise<void> {
        await offlineDB.cleanOldSyncedItems();
        const pendingItems = await offlineDB.getPendingSyncItems();

        if (pendingItems.length === 0) {
            return;
        }

        console.log(`⬆️ Sincronizando ${pendingItems.length} operaciones pendientes`);

        for (const item of pendingItems) {
            try {
                await this.processSyncItem(item, signal);
                if (item.id) {
                    await offlineDB.markAsSynced(item.id);
                }
            } catch (error: any) {
                if (!navigator.onLine || error?.message?.includes('Failed to fetch')) {
                    console.warn('Network error pushing item (offline/unstable):', error?.message);
                } else {
                    console.error('Error procesando item de sincronización:', error);
                }
                if (item.id) {
                    await offlineDB.markAsError(item.id, error.message || 'Error desconocido');
                }
            }
        }
    }

    // Procesar un item de la cola de sincronización
    private async processSyncItem(item: SyncQueueItem, signal?: AbortSignal): Promise<void> {
        const { store, operation, data } = item;

        switch (store) {
            case OfflineStore.SALES:
                await this.syncSale(operation, data, signal);
                break;
            case OfflineStore.PRODUCTS:
                await this.syncProduct(operation, data, signal);
                break;
            case OfflineStore.CUSTOMERS:
                await this.syncCustomer(operation, data, signal);
                break;
            case OfflineStore.EXPENSES:
                await this.syncExpense(operation, data, signal);
                break;
            case OfflineStore.CASH_SESSIONS:
                await this.syncCashSession(operation, data, signal);
                break;
            case OfflineStore.INVENTORY_MOVEMENTS:
                await this.syncInventoryMovement(operation, data, signal);
                break;
            case OfflineStore.FIXED_EXPENSES:
                await this.syncFixedExpense(operation, data, signal);
                break;
            case OfflineStore.SUPPLIER_DEBTS:
                await this.syncSupplierDebt(operation, data, signal);
                break;
            default:
                console.warn('Store no soportado para sincronización:', store);
        }
    }

    // Sincronizar venta
    private async syncSale(operation: string, data: any, signal?: AbortSignal): Promise<void> {
        if (operation === 'CREATE') {
            // CRÍTICO: Asegurar que existe store_id y profile_id. Las ventas offline pueden no tenerlos.
            // CRÍTICO: Asegurar que existe store_id y profile_id. Las ventas offline pueden no tenerlos.
            if (!data.store_id || !data.profile_id) {
                // Intentar obtener usuario de sesión local primero (más rápido y robusto)
                const { data: { session } } = await supabase.auth.getSession();
                let user = session?.user;

                // Si no hay sesión, intentar fetch del servidor
                if (!user) {
                    const { data: { user: dbUser } } = await supabase.auth.getUser();
                    user = dbUser;
                }

                if (user) {
                    if (!data.store_id) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('store_id')
                            .eq('id', user.id)
                            .maybeSingle()
                            .abortSignal(signal || null);

                        if (profile?.store_id) {
                            data.store_id = profile.store_id;
                            console.log('🔧 store_id parcheado para venta offline:', data.id);
                        }
                    }

                    if (!data.profile_id) {
                        data.profile_id = user.id;
                        console.log('👤 profile_id parcheado para venta offline:', data.id);
                    }
                }
            }

            // Si aún no tenemos store_id o profile_id, intentamos con el de la sesión actual como última opción
            // o insertamos y dejamos que falle si es obligatorio (mejor que fallar silenciosamente aquí)

            // CLEANUP: Remove 'items', 'synced' and other virtual fields before insert into 'sales' table
            const { items, synced, ...salePayload } = data;

            const { error } = await supabase
                .from('sales')
                .insert(salePayload)
                .abortSignal(signal || null);

            if (error) {
                // Manejo inteligente de duplicados
                const isDuplicate = error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint');

                if (isDuplicate) {
                    // Caso 1: La venta YA existe por ID (idéntica). Esto es bueno, ya se sincronizó.
                    if (error.message?.includes('sales_pkey') || error.message?.includes('primary key')) {
                        console.log(`✅ Venta ${data.id} ya sincronizada previamente.`);
                        return;
                    }

                    // Caso 2: Conflicto de Número de Factura (invoice_number). CRÍTICO.
                    // Alguien más usó este número mientras estábamos offline. Debemos obtener uno nuevo.
                    if (error.message?.includes('invoice_number') || error.message?.includes('sales_invoice_number_key')) {
                        console.log(`⚠️ Conflicto de Factura ${data.invoice_number}. Iniciando bucle de reintento...`);

                        const storeId = salePayload.store_id;
                        const invoiceTypeId = salePayload.invoice_type_id;

                        if (storeId && invoiceTypeId) {
                            let retryCount = 0;
                            const MAX_RETRIES = 30; // More retries in case of big gaps
                            let success = false;
                            let lastError = error;

                            // CRITICAL FIX: Instead of relying on invoice_sequences (which may be stale),
                            // query the ACTUAL max invoice_number from the sales table.
                            // This is the self-healing approach that works even when sequences are far behind.
                            const typePrefix = data.invoice_number.match(/^(.+?)-?(\d+)$/);
                            const prefixPart = typePrefix ? typePrefix[1] : null;

                            // Query real max from sales table
                            let baseNumber = 0;
                            try {
                                // CRITICAL: Order by invoice_number DESC (not created_at) to find the
                                // true maximum number. Zero-padded numbers (B02-00000246) sort correctly
                                // alphabetically, so this reliably returns the single highest NCF.
                                const { data: maxSaleData } = await supabase
                                    .from('sales')
                                    .select('invoice_number')
                                    .eq('store_id', storeId)
                                    .eq('invoice_type_id', invoiceTypeId)
                                    .order('invoice_number', { ascending: false })
                                    .limit(1) // Only need the single highest
                                    .abortSignal(signal || null);

                                if (maxSaleData && maxSaleData.length > 0) {
                                    const m = maxSaleData[0].invoice_number?.match(/-(\d+)$/);
                                    if (m) baseNumber = parseInt(m[1], 10);
                                }
                            } catch (maxErr) {
                                console.warn('Could not query max sale number, falling back to sequence table');
                                // Fallback to sequence table
                                const { data: seqData } = await supabase
                                    .from('invoice_sequences')
                                    .select('current_number')
                                    .eq('invoice_type_id', invoiceTypeId)
                                    .eq('store_id', storeId)
                                    .maybeSingle();
                                baseNumber = seqData?.current_number || 0;
                            }

                            console.log(`🔍 Base real detectada para ${invoiceTypeId}: ${baseNumber}`);

                            while (retryCount < MAX_RETRIES && !success) {
                                retryCount++;

                                const nextNum = baseNumber + retryCount;

                                // Rebuild the invoice number with the same prefix format
                                let newInvoiceNumber = `${invoiceTypeId}-${String(nextNum).padStart(8, '0')}`;
                                if (prefixPart) {
                                    newInvoiceNumber = `${prefixPart}-${String(nextNum).padStart(8, '0')}`;
                                }

                                console.log(`🔄 Reintento Sync ${retryCount}: Probando ${newInvoiceNumber}...`);

                                // Retry insert
                                const { error: retryError } = await supabase
                                    .from('sales')
                                    .insert({
                                        ...salePayload,
                                        invoice_number: newInvoiceNumber
                                    })
                                    .abortSignal(signal || null);

                                if (!retryError) {
                                    success = true;
                                    console.log(`✅ Recuperado con éxito. Nuevo número asignado: ${newInvoiceNumber}`);
                                    data.invoice_number = newInvoiceNumber;

                                    // Update sequence to this number
                                    await supabase.rpc('update_invoice_sequence_max', {
                                        p_invoice_type_id: invoiceTypeId,
                                        p_store_id: storeId,
                                        p_new_sequence_number: nextNum
                                    }, { abortSignal: signal });
                                } else {
                                    lastError = retryError;
                                    const isRetryDuplicate = retryError.code === '23505' || retryError.message?.includes('unique constraint');

                                    if (isRetryDuplicate) {
                                        console.warn(`Conflicto con ${newInvoiceNumber}. Probando siguiente...`);
                                        // No need to increment separately - retryCount handles this
                                        await new Promise(r => setTimeout(r, 50));
                                    } else {
                                        throw retryError;
                                    }
                                }
                            }

                            if (!success) {
                                console.error(`❌ Fallaron todos los ${MAX_RETRIES} intentos de búsqueda.`);
                                throw lastError;
                            }
                        } else {
                            // Sin datos suficientes para regenerar
                            throw error;
                        }
                    } else {
                        // Otro tipo de duplicado no manejado
                        throw error;
                    }
                } else {
                    // Error no relacionado con duplicados
                    throw error;
                }
            }

            // CRÍTICO: Si la venta se insertó correctamente, debemos intentar actualizar la secuencia
            // para que la próxima venta online no reutilice este número.
            if (data.invoice_number && data.store_id && data.invoice_type_id) {
                try {
                    // Extraer número de la factura (ej: B02-00001739 -> 1739)
                    const match = data.invoice_number.match(/-(\d+)$/);
                    if (match && match[1]) {
                        const sequenceNumber = parseInt(match[1], 10);

                        await supabase.rpc('update_invoice_sequence_max' as any, {
                            p_invoice_type_id: data.invoice_type_id,
                            p_store_id: data.store_id,
                            p_new_sequence_number: sequenceNumber
                        }, { abortSignal: signal });

                        console.log(`🔢 Secuencia actualizada a ${sequenceNumber} para ${data.invoice_type_id}`);
                    }
                } catch (seqError) {
                    console.error('⚠️ Error actualizando secuencia post-sync (no crítico):', seqError);
                    // No lanzamos el error porque la venta sí se guardó
                }
            }

            // También sincronizar items de venta si existen
            if (items && Array.isArray(items)) {
                const saleId = data.id;
                for (const item of items) {
                    await supabase
                        .from('sale_items')
                        .insert({
                            sale_id: saleId,
                            product_id: item.id || item.product_id,
                            quantity: item.quantity,
                            unit_price: item.price,
                            discount_percentage: item.discount || 0,
                            tax_percentage: (item.tax || 0) * 100,
                            subtotal: item.price * item.quantity,
                            discount_amount: ((item.discount || 0) / 100) * (item.price * item.quantity),
                            tax_amount: (item.tax || 0) * item.price * item.quantity,
                            total: item.price * item.quantity * (1 + (item.tax || 0)),
                        })
                        .abortSignal(signal || null);
                }
            }

            // INTEGRACIÓN CON ALANUBE (e-NCF) PARA VENTAS DE COLAS OFFLINE
            if (data.store_id) {
                try {
                    const { data: alanubeConfig } = await supabase
                        .from('alanube_config')
                        .select('is_active')
                        .eq('store_id', data.store_id)
                        .maybeSingle()
                        .abortSignal(signal || null);

                    if (alanubeConfig?.is_active) {
                        console.log('🔌 [OfflineSync] Alanube e-NCF está activo. Emitiendo comprobante electrónico para venta offline:', data.id);
                        const { AlanubeService } = await import('@/services/alanube/AlanubeService');
                        await AlanubeService.emitirFacturaElectronica(data.id);
                    }
                } catch (alanubeErr) {
                    console.error('⚠️ [OfflineSync] Error al integrar con Alanube:', alanubeErr);
                }
            }
        }
    }

    // Sincronizar producto
    private async syncProduct(operation: string, data: any, signal?: AbortSignal): Promise<void> {
        switch (operation) {
            case 'CREATE':
                const { error: createError } = await supabase
                    .from('products')
                    .insert(data)
                    .abortSignal(signal || null);
                if (createError) throw createError;
                break;

            case 'UPDATE':
                const { id, ...updateData } = data;
                const { error: updateError } = await supabase
                    .from('products')
                    .update(updateData)
                    .eq('id', id)
                    .abortSignal(signal || null);
                if (updateError) throw updateError;
                break;

            case 'DELETE':
                const { error: deleteError } = await supabase
                    .from('products')
                    .delete()
                    .eq('id', data.id)
                    .abortSignal(signal || null);
                if (deleteError) throw deleteError;
                break;
        }
    }

    // Sincronizar cliente
    private async syncCustomer(operation: string, data: any, signal?: AbortSignal): Promise<void> {
        switch (operation) {
            case 'CREATE':
                const { error: createError } = await supabase
                    .from('customers')
                    .insert(data)
                    .abortSignal(signal || null);
                if (createError) throw createError;
                break;

            case 'UPDATE':
                const { id, ...updateData } = data;
                const { error: updateError } = await supabase
                    .from('customers')
                    .update(updateData)
                    .eq('id', id)
                    .abortSignal(signal || null);
                if (updateError) throw updateError;
                break;

            case 'DELETE':
                const { error: deleteError } = await supabase
                    .from('customers')
                    .delete()
                    .eq('id', data.id)
                    .abortSignal(signal || null);
                if (deleteError) throw deleteError;
                break;
        }
    }

    // Sincronizar sesión de caja
    private async syncCashSession(operation: string, data: any, signal?: AbortSignal): Promise<void> {
        switch (operation) {
            case 'CREATE': {
                // Check if session already exists (idempotencia)
                const { data: existing } = await supabase
                    .from('cash_sessions' as any)
                    .select('id')
                    .eq('id', data.id)
                    .maybeSingle();

                if (existing) {
                    console.log('✅ Sesión de caja ya existe en servidor:', data.id);
                    return;
                }

                const { error } = await supabase
                    .from('cash_sessions' as any)
                    .insert(data)
                    .abortSignal(signal || null);

                if (error && error.code !== '23505') throw error;
                break;
            }

            case 'UPDATE': {
                const { id, ...updateData } = data;
                const { error } = await supabase
                    .from('cash_sessions' as any)
                    .update(updateData)
                    .eq('id', id)
                    .abortSignal(signal || null);

                if (error) throw error;
                break;
            }
        }
    }

    // Sincronizar gasto
    private async syncExpense(operation: string, data: any, signal?: AbortSignal): Promise<void> {
        switch (operation) {
            case 'CREATE':
                // Check store_id similar to Sales
                if (!data.store_id) {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('store_id')
                            .eq('id', user.id)
                            .maybeSingle();

                        if (profile?.store_id) {
                            data.store_id = profile.store_id;
                        }
                    }
                }

                // Remove fields that are not in DB schema but might be in local object
                const { synced, supplier_name, ...insertData } = data;

                const { error: createError } = await supabase
                    .from('expenses')
                    .insert(insertData)
                    .abortSignal(signal || null);

                if (createError) {
                    if (createError.code === '23505' || createError.message?.includes('duplicate')) {
                        console.warn(`Expense already exists, ignoring duplicate.`);
                        return;
                    }
                    throw createError;
                }
                break;

            case 'DELETE':
                const { error: deleteError } = await supabase
                    .from('expenses')
                    .delete()
                    .eq('id', data.id);
                if (deleteError) throw deleteError;
                break;
        }
    }

    // Sincronizar gasto fijo
    private async syncFixedExpense(operation: string, data: any, signal?: AbortSignal): Promise<void> {
        switch (operation) {
            case 'CREATE':
                if (!data.store_id) {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('store_id')
                            .eq('id', user.id)
                            .maybeSingle();

                        if (profile?.store_id) {
                            data.store_id = profile.store_id;
                        }
                    }
                }
                const { synced, ...insertData } = data;
                const { error: createError } = await supabase
                    .from('fixed_expenses')
                    .insert(insertData)
                    .abortSignal(signal || null);

                if (createError) {
                    if (createError.code === '23505' || createError.message?.includes('duplicate')) {
                        console.warn(`Fixed expense already exists, ignoring duplicate.`);
                        return;
                    }
                    throw createError;
                }
                break;

            case 'UPDATE':
                const { id, ...updateData } = data;
                const { error: updateError } = await supabase
                    .from('fixed_expenses')
                    .update(updateData)
                    .eq('id', id)
                    .abortSignal(signal || null);
                if (updateError) throw updateError;
                break;

            case 'DELETE':
                const { error: deleteError } = await supabase
                    .from('fixed_expenses')
                    .delete()
                    .eq('id', data.id);
                if (deleteError) throw deleteError;
                break;
        }
    }

    // Sincronizar movimiento de inventario
    private async syncInventoryMovement(operation: string, data: any, signal?: AbortSignal): Promise<void> {
        if (operation === 'CREATE') {
            const { error } = await supabase
                .from('inventory_movements' as any)
                .insert(data)
                .abortSignal(signal || null);
            if (error && error.code !== '23505') throw error;
        }
    }

    // Sincronizar deuda con proveedor
    private async syncSupplierDebt(operation: string, data: any, signal?: AbortSignal): Promise<void> {
        switch (operation) {
            case 'CREATE':
                if (!data.store_id) {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('store_id')
                            .eq('id', user.id)
                            .maybeSingle();

                        if (profile?.store_id) {
                            data.store_id = profile.store_id;
                        }
                    }
                }
                const { synced, ...insertData } = data;
                const { error: createError } = await supabase
                    .from('supplier_debts')
                    .insert(insertData)
                    .abortSignal(signal || null);

                if (createError) {
                    if (createError.code === '23505' || createError.message?.includes('duplicate')) {
                        console.warn(`Supplier debt already exists, ignoring duplicate.`);
                        return;
                    }
                    throw createError;
                }
                break;

            case 'UPDATE':
                const { id, ...updateData } = data;
                const { error: updateError } = await supabase
                    .from('supplier_debts')
                    .update(updateData)
                    .eq('id', id)
                    .abortSignal(signal || null);
                if (updateError) throw updateError;
                break;

            case 'DELETE':
                const { error: deleteError } = await supabase
                    .from('supplier_debts')
                    .delete()
                    .eq('id', data.id);
                if (deleteError) throw deleteError;
                break;
        }
    }
}

// Singleton instance
export const offlineSyncManager = new OfflineSyncManager();
