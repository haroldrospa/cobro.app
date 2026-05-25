/**
 * Indicador de estado offline/online
 * Muestra al usuario si está conectado o no, y si hay datos pendientes de sincronizar
 */

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, CloudUpload, CheckCircle2, AlertCircle, ShoppingCart, X, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { offlineDB } from '@/lib/offlineDB';
import { offlineSyncManager } from '@/lib/offlineSync';
import { useOnlineStatus } from '@/hooks/useProductsOffline';
import { useUserStore } from '@/hooks/useUserStore';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useWebOrdersCount } from '@/hooks/useWebOrdersCount';
import { playNotificationSound } from '@/utils/notificationSounds';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useLocation } from 'react-router-dom';

export const OfflineIndicator: React.FC = () => {
    const location = useLocation();

    // Check for public pages FIRST, before calling any hooks that depend on authentication
    // This prevents AuthSessionMissingError when user is not logged in
    const isPublicPage = location.pathname.startsWith('/tienda/') ||
        location.pathname.startsWith('/buscar-tienda') ||
        location.pathname === '/auth' ||
        location.pathname === '/';

    // NOTE: Don't show indicators on public pages, checked at render time to satisfy Rule of Hooks

    const isOnline = useOnlineStatus();
    const navigate = useNavigate();
    const { toast } = useToast();


    const { data: store } = useUserStore();
    const { settings: storeSettings } = useStoreSettings();
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showOfflineBanner, setShowOfflineBanner] = useState(false);

    // Web Order Count - Monitor changes
    const { data: webOrdersCount = 0 } = useWebOrdersCount();
    const [previousCount, setPreviousCount] = useState<number>(0);
    const [lastWebOrder, setLastWebOrder] = useState<any>(null);

    // Show offline banner when connection drops, hide when restored
    useEffect(() => {
        if (!isOnline) {
            setShowOfflineBanner(true);
        } else {
            // Keep banner visible briefly when reconnecting so user sees the sync
            const timer = setTimeout(() => setShowOfflineBanner(false), 4000);
            return () => clearTimeout(timer);
        }
    }, [isOnline]);

    // Monitor web orders count changes
    useEffect(() => {
        // Only notify if count increased (new order arrived)
        if (webOrdersCount > previousCount && previousCount > 0) {
            console.log('🆕 New web order detected! Count changed from', previousCount, 'to', webOrdersCount);

            // Play notification sound
            const soundEnabled = storeSettings?.web_order_sound_enabled ?? true;
            const soundType = (storeSettings?.web_order_sound_type as any) ?? 'chime';
            const soundVolume = storeSettings?.web_order_sound_volume ?? 0.7;
            playNotificationSound(soundType, soundEnabled, soundVolume);

            // Show toast notification
            toast({
                title: "🛒 ¡Nuevo Pedido Web!",
                description: `Tienes ${webOrdersCount} pedido${webOrdersCount > 1 ? 's' : ''} pendiente${webOrdersCount > 1 ? 's' : ''} por revisar`,
                duration: 10000,
            });

            // Show visual notification
            setLastWebOrder({
                customer_name: 'Pedido Web',
                total: 0,
                order_number: `${webOrdersCount} pedido${webOrdersCount > 1 ? 's' : ''}`
            });

            // Auto hide after 10 seconds
            setTimeout(() => {
                setLastWebOrder(null);
            }, 10000);
        }

        // Update previous count
        setPreviousCount(webOrdersCount);
    }, [webOrdersCount, previousCount, storeSettings, toast]);

    useEffect(() => {
        // Inicializar el sistema offline al montar (async, no bloquear render)
        const initOffline = async () => {
            await offlineDB.init();
            offlineSyncManager.start();
            // Check pending items after init
            const pending = await offlineDB.getPendingSyncItems();
            setPendingCount(pending.filter((i: any) => !i.error).length);
        };
        initOffline();

        // Poll for pending items every 30s (was 5s — too aggressive on mobile)
        const updatePendingCount = async () => {
            const pending = await offlineDB.getPendingSyncItems();
            setPendingCount(pending.length);
        };

        const interval = setInterval(updatePendingCount, 30000);

        return () => {
            clearInterval(interval);
            offlineSyncManager.stop();
        };
    }, []);

    // Intentar sincronizar manualmente
    const handleSync = async () => {
        if (!isOnline || isSyncing) return;

        setIsSyncing(true);
        try {
            await offlineSyncManager.sync();
            const pending = await offlineDB.getPendingSyncItems();
            setPendingCount(pending.length);
            if (pending.length === 0) {
                toast({ title: '✅ Sincronizado', description: 'Todos los datos se han sincronizado correctamente.' });
            }
        } catch (error) {
            console.error('Error sincronizando:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    if (isPublicPage) {
        return null;
    }

    return (
        <>
            {/* OFFLINE BANNER - Top of screen */}
            {showOfflineBanner && (
                <div
                    className={cn(
                        "fixed top-0 left-0 right-0 z-[10000] flex items-center justify-between px-4 py-2.5 text-sm font-semibold transition-all duration-500",
                        isOnline
                            ? "bg-emerald-500 text-white"
                            : "bg-amber-500 text-white"
                    )}
                >
                    <div className="flex items-center gap-2">
                        {isOnline ? (
                            <>
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span>Conexión restaurada</span>
                                {pendingCount > 0 && (
                                    <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                                        Sincronizando {pendingCount} operaciones...
                                    </span>
                                )}
                            </>
                        ) : (
                            <>
                                <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
                                <span>Sin internet — Modo offline activo</span>
                                <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                                    Puedes seguir facturando normalmente
                                </span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {isOnline && pendingCount > 0 && (
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-full text-xs transition-colors"
                            >
                                <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
                                {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                            </button>
                        )}
                        {!isOnline && (
                            <div className="flex items-center gap-1 text-xs opacity-80">
                                <CloudUpload className="w-3 h-3" />
                                <span>{pendingCount > 0 ? `${pendingCount} pendiente${pendingCount > 1 ? 's' : ''}` : 'Todo guardado localmente'}</span>
                            </div>
                        )}
                        <button
                            onClick={() => setShowOfflineBanner(false)}
                            className="p-1 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Notifications Container - Independent from Indicator to prevent layout issues */}
            <div className="fixed bottom-20 left-4 z-[9999] flex flex-col gap-2 pointer-events-none">

                {lastWebOrder && (
                    <div
                        className="pointer-events-auto flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-blue-500/30 animate-in slide-in-from-left-4 fade-in duration-300 max-w-sm cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => {
                            navigate('/pos');
                            setLastWebOrder(null);
                        }}
                    >
                        <div className="bg-blue-500/10 p-2.5 rounded-full ring-2 ring-blue-500/20 animate-pulse">
                            <ShoppingCart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0 mr-4">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-none mb-1">¡Nuevo Pedido Web!</h4>
                            <p className="text-xs text-muted-foreground truncate font-medium">
                                {lastWebOrder.order_number}
                            </p>
                            <p className="text-sm font-black text-primary mt-0.5">
                                Haz clic para revisar
                            </p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setLastWebOrder(null);
                            }}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>


        </>
    );
};
