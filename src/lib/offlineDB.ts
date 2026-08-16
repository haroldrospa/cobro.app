/**
 * Sistema de Base de Datos Offline usando IndexedDB
 * Permite trabajar sin conexión a internet y sincronizar cuando vuelve la conexión
 */

const DB_NAME = 'CobroAppOfflineDB';
const DB_VERSION = 9; // v9: Agregar deudas con proveedores

// Tipos de tiendas (stores) en IndexedDB
export enum OfflineStore {
    PRODUCTS = 'products',
    SALES = 'sales',
    CUSTOMERS = 'customers',
    CATEGORIES = 'categories',
    SETTINGS = 'settings',
    SYNC_QUEUE = 'sync_queue', // Cola de sincronización para operaciones pendientes
    INVOICE_TYPES = 'invoice_types', // Cache de tipos de facturas
    EXPENSES = 'expenses',
    CASH_SESSIONS = 'cash_sessions',
    INVENTORY_MOVEMENTS = 'inventory_movements',
    FIXED_EXPENSES = 'fixed_expenses',
    SUPPLIER_DEBTS = 'supplier_debts',
}

export interface SyncQueueItem {
    id?: string;
    store: OfflineStore;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    data: any;
    timestamp: number;
    synced: number; // 0: false, 1: true, 2: failed_permanently
    error?: string;
    retry_count?: number;
}

class OfflineDatabase {
    private db: IDBDatabase | null = null;
    private isClosing = false;

    /** Ensures the DB connection is open, re-opening it if it was closed. */
    private async ensureOpen(): Promise<void> {
        if (!this.db || this.isClosing) {
            this.db = null;
            this.isClosing = false;
            await this.init();
        }
    }

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                this.isClosing = false;

                // If another tab upgrades the DB, close gracefully so we can re-open
                this.db.onversionchange = () => {
                    this.isClosing = true;
                    this.db?.close();
                    this.db = null;
                    console.warn('[OfflineDB] Version change detected — connection closed for upgrade.');
                };

                // Handle unexpected close
                this.db.onclose = () => {
                    console.warn('[OfflineDB] Connection closed unexpectedly.');
                    this.db = null;
                    this.isClosing = false;
                };

                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Crear stores si no existen
                if (!db.objectStoreNames.contains(OfflineStore.PRODUCTS)) {
                    const productStore = db.createObjectStore(OfflineStore.PRODUCTS, { keyPath: 'id' });
                    productStore.createIndex('barcode', 'barcode', { unique: false });
                    productStore.createIndex('name', 'name', { unique: false });
                    productStore.createIndex('category_id', 'category_id', { unique: false });
                }

                if (!db.objectStoreNames.contains(OfflineStore.SALES)) {
                    const salesStore = db.createObjectStore(OfflineStore.SALES, { keyPath: 'id' });
                    salesStore.createIndex('invoice_number', 'invoice_number', { unique: false });
                    salesStore.createIndex('created_at', 'created_at', { unique: false });
                    salesStore.createIndex('synced', 'synced', { unique: false });
                }

                if (!db.objectStoreNames.contains(OfflineStore.CUSTOMERS)) {
                    const customerStore = db.createObjectStore(OfflineStore.CUSTOMERS, { keyPath: 'id' });
                    customerStore.createIndex('name', 'name', { unique: false });
                    customerStore.createIndex('rnc', 'rnc', { unique: false });
                }

                if (!db.objectStoreNames.contains(OfflineStore.CATEGORIES)) {
                    db.createObjectStore(OfflineStore.CATEGORIES, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(OfflineStore.SETTINGS)) {
                    db.createObjectStore(OfflineStore.SETTINGS, { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains(OfflineStore.INVOICE_TYPES)) {
                    db.createObjectStore(OfflineStore.INVOICE_TYPES, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(OfflineStore.EXPENSES)) {
                    const expenseStore = db.createObjectStore(OfflineStore.EXPENSES, { keyPath: 'id' });
                    expenseStore.createIndex('date', 'date', { unique: false });
                    expenseStore.createIndex('synced', 'synced', { unique: false });
                }

                if (!db.objectStoreNames.contains(OfflineStore.CASH_SESSIONS)) {
                    const cashSessionStore = db.createObjectStore(OfflineStore.CASH_SESSIONS, { keyPath: 'id' });
                    cashSessionStore.createIndex('status', 'status', { unique: false });
                    cashSessionStore.createIndex('store_id', 'store_id', { unique: false });
                }

                if (!db.objectStoreNames.contains(OfflineStore.INVENTORY_MOVEMENTS)) {
                    const movementStore = db.createObjectStore(OfflineStore.INVENTORY_MOVEMENTS, { keyPath: 'id' });
                    movementStore.createIndex('store_id', 'store_id', { unique: false });
                    movementStore.createIndex('product_id', 'product_id', { unique: false });
                    movementStore.createIndex('created_at', 'created_at', { unique: false });
                }

                if (!db.objectStoreNames.contains(OfflineStore.SYNC_QUEUE)) {
                    const syncStore = db.createObjectStore(OfflineStore.SYNC_QUEUE, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    syncStore.createIndex('synced', 'synced', { unique: false });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains(OfflineStore.FIXED_EXPENSES)) {
                    const fixedExpenseStore = db.createObjectStore(OfflineStore.FIXED_EXPENSES, { keyPath: 'id' });
                    fixedExpenseStore.createIndex('store_id', 'store_id', { unique: false });
                }

                if (!db.objectStoreNames.contains(OfflineStore.SUPPLIER_DEBTS)) {
                    const supplierDebtsStore = db.createObjectStore(OfflineStore.SUPPLIER_DEBTS, { keyPath: 'id' });
                    supplierDebtsStore.createIndex('store_id', 'store_id', { unique: false });
                    supplierDebtsStore.createIndex('supplier_id', 'supplier_id', { unique: false });
                }
            };
        });
    }

    // Métodos CRUD genéricos
    async add<T>(storeName: OfflineStore, data: T): Promise<T> {
        await this.ensureOpen();
        // Guard: re-init if the store is missing (stale schema)
        if (!this.db!.objectStoreNames.contains(storeName)) await this.init();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db!.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.add(data);
                request.onsuccess = () => resolve(data);
                request.onerror = () => reject(request.error);
            } catch (e) {
                reject(e);
            }
        });
    }

    async put<T>(storeName: OfflineStore, data: T): Promise<T> {
        await this.ensureOpen();
        if (!this.db!.objectStoreNames.contains(storeName)) await this.init();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db!.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(data);
                request.onsuccess = () => resolve(data);
                request.onerror = () => reject(request.error);
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Put multiple items in a single transaction (High Performance)
     */
    async putBulk<T>(storeName: OfflineStore, items: T[]): Promise<void> {
        if (!items.length) return;
        await this.ensureOpen();
        if (!this.db!.objectStoreNames.contains(storeName)) await this.init();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db!.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);

                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);

                for (const item of items) {
                    store.put(item);
                }
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Delete multiple items in a single transaction (High Performance)
     */
    async deleteBulk(storeName: OfflineStore, keys: (string | number)[]): Promise<void> {
        if (!keys.length) return;
        await this.ensureOpen();
        if (!this.db!.objectStoreNames.contains(storeName)) await this.init();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db!.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);

                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);

                for (const key of keys) {
                    store.delete(key);
                }
            } catch (e) {
                reject(e);
            }
        });
    }

    async get<T>(storeName: OfflineStore, key: string | number): Promise<T | null> {
        await this.ensureOpen();
        if (!this.db!.objectStoreNames.contains(storeName)) await this.init();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db!.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            } catch (e) {
                reject(e);
            }
        });
    }

    async getAll<T>(storeName: OfflineStore): Promise<T[]> {
        await this.ensureOpen();
        if (!this.db!.objectStoreNames.contains(storeName)) await this.init();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db!.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            } catch (e) {
                reject(e);
            }
        });
    }

    async delete(storeName: OfflineStore, key: string | number): Promise<void> {
        await this.ensureOpen();
        if (!this.db!.objectStoreNames.contains(storeName)) await this.init();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db!.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(key);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            } catch (e) {
                reject(e);
            }
        });
    }

    async clear(storeName: OfflineStore): Promise<void> {
        await this.ensureOpen();
        if (!this.db!.objectStoreNames.contains(storeName)) await this.init();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db!.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            } catch (e) {
                reject(e);
            }
        });
    }

    // Buscar por índice
    async getByIndex<T>(
        storeName: OfflineStore,
        indexName: string,
        value: any
    ): Promise<T[]> {
        await this.ensureOpen();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    // Métodos para la cola de sincronización
    async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'synced' | 'retry_count'>): Promise<void> {
        const queueItem: Omit<SyncQueueItem, 'id'> = {
            ...item,
            timestamp: Date.now(),
            synced: 0,
            retry_count: 0, // Initialize retry count
        };
        await this.add(OfflineStore.SYNC_QUEUE, queueItem);
    }

    async getPendingSyncItems(): Promise<SyncQueueItem[]> {
        // Fallback to getAll and filter manually to avoid "DataError: The parameter is not a valid key"
        // when querying boolean indices on some browsers, and to handle legacy 'false' vs new '0' values.
        await this.ensureOpen();

        return new Promise((resolve, reject) => {
            try {
            const transaction = this.db!.transaction([OfflineStore.SYNC_QUEUE], 'readonly');
            const store = transaction.objectStore(OfflineStore.SYNC_QUEUE);
            // We get ALL items and filter in memory. The queue should be relatively small.
            const request = store.getAll();

            request.onsuccess = () => {
                const allItems = request.result as SyncQueueItem[];
                // Filter items where synced is false (legacy) or 0 (new)
                // Use strict check against 1 to identify synced
                // CRITICAL: Exclude synced === 2 (Permanent Failure) to prevent infinite loops
                const pending = allItems.filter(item =>
                    item.synced !== 1 &&
                    item.synced !== true as any &&
                    item.synced !== 2 // Permanently failed
                );
                resolve(pending);
            };
            request.onerror = () => reject(request.error);
            } catch (e) {
                reject(e);
            }
        });
    }

    async markAsSynced(id: string | number): Promise<void> {
        const item = await this.get<SyncQueueItem>(OfflineStore.SYNC_QUEUE, id);
        if (item) {
            item.synced = 1;
            item.error = undefined; // Clear error if successful
            await this.put(OfflineStore.SYNC_QUEUE, item);
        }
    }

    async markAsError(id: string | number, error: string): Promise<void> {
        const item = await this.get<SyncQueueItem>(OfflineStore.SYNC_QUEUE, id);
        if (item) {
            // Increment retry count (init to 0 if undefined)
            const currentRetries = item.retry_count || 0;
            const newRetries = currentRetries + 1;
            item.retry_count = newRetries;
            item.error = error;

            console.warn(`⚠️ Sync Item ${id} fallo (Intento ${newRetries}/5): ${error}`);

            // Max retries reached?
            if (newRetries >= 5) {
                console.error(`⛔️ Sync Item ${id} falló permanentemente tras 5 intentos. Se eliminará de la cola.`);
                await this.delete(OfflineStore.SYNC_QUEUE, id);
            } else {
                await this.put(OfflineStore.SYNC_QUEUE, item);
            }
        }
    }

    // Limpiar items sincronizados antiguos (más de 7 días) o fallidos
    async cleanOldSyncedItems(): Promise<void> {
        await this.ensureOpen();

        const allItems = await this.getAll<SyncQueueItem>(OfflineStore.SYNC_QUEUE);
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        for (const item of allItems) {
            if (!item.id) continue;
            
            // Delete permanently failed or maximum retries reached immediately
            if (item.synced === 2 || (item.retry_count && item.retry_count >= 5)) {
                await this.delete(OfflineStore.SYNC_QUEUE, item.id);
            }
            // Delete old synced items (older than 7 days)
            else if ((item.synced === 1 || item.synced === true as any) && item.timestamp < sevenDaysAgo) {
                await this.delete(OfflineStore.SYNC_QUEUE, item.id);
            }
        }
    }
}

// Singleton instance
export const offlineDB = new OfflineDatabase();
