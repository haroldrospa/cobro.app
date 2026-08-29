/**
 * Indicador de estado offline/online
 * Muestra al usuario si está conectado o no, y si hay datos pendientes de sincronizar
 */

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, CloudUpload, CheckCircle2, AlertCircle, X, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { offlineDB } from '@/lib/offlineDB';
import { offlineSyncManager } from '@/lib/offlineSync';
import { useOnlineStatus } from '@/hooks/useProductsOffline';
import { useUserStore } from '@/hooks/useUserStore';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useWebOrdersCount } from '@/hooks/useWebOrdersCount';
import { playNotificationSound } from '@/utils/notificationSounds';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'react-router-dom';

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
    const { toast } = useToast();


    const { data: store } = useUserStore();
    const { settings: storeSettings } = useStoreSettings();
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showOfflineBanner, setShowOfflineBanner] = useState(false);

    // Web Order Count - Monitor changes
    const { data: webOrdersCount = 0 } = useWebOrdersCount();
    const [previousCount, setPreviousCount] = useState<number>(0);

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

            // Play notification sound (sin toast/tarjeta emergente — solo el sonido; el
            // contador de pedidos web en el botón "Web" del POS ya avisa visualmente)
            const soundEnabled = storeSettings?.web_order_sound_enabled ?? true;
            const soundType = (storeSettings?.web_order_sound_type as any) ?? 'chime';
            const soundVolume = storeSettings?.web_order_sound_volume ?? 0.7;
            playNotificationSound(soundType, soundEnabled, soundVolume);
        }

        // Update previous count
        setPreviousCount(webOrdersCount);
    }, [webOrdersCount, previousCount, storeSettings]);

    useEffect(() => {
        if (isPublicPage) {
            return;
        }

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
    }, [isPublicPage]);

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



        </>
    );
};
