
import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/hooks/useUserStore';
import { useToast } from '@/hooks/use-toast';
import {
    ChefHat,
    Clock,
    CheckCircle2,
    Bell,
    BellOff,
    Package,
    User,
    AlertTriangle,
    History as HistoryIcon,
    Timer,
    UtensilsCrossed,
    Loader2,
    Maximize,
    Minimize,
    Settings,
    ArrowLeft,
    Check,
    LogOut,
    BarChart2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import KitchenPerformanceDashboard from '@/components/kitchen/KitchenPerformanceDashboard';

import { useWebOrderNotifications } from '@/hooks/useWebOrderNotifications';
import { formatDistanceToNow, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { es } from 'date-fns/locale';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OrderItem {
    id: string;
    product_id?: string;
    product_name: string;
    quantity: number;
    comment?: string;
}

interface KitchenOrder {
    id: string;
    order_number: string;
    customer_name: string;
    created_at: string;
    notes?: string;
    order_status: string;
    payment_status: string;
    updated_at: string;
    open_order_items: OrderItem[];
}

const KitchenDisplay: React.FC = () => {
    const { data: userStore } = useUserStore();
    const { settings, updateSettings } = useStoreSettings();
    const [originalOrderModal, setOriginalOrderModal] = useState<{
        orderNumber: string;
        order: KitchenOrder | null;
        loading: boolean;
    } | null>(null);

    const [recipeModal, setRecipeModal] = useState<{
        productName: string;
        quantity: number;
        note?: string;
        loading: boolean;
        recipes: Array<{
            id: string;
            quantity: number;
            ingredient?: {
                id: string;
                name: string;
                unit: string;
            };
        }>;
    } | null>(null);

    const handleOpenRecipeModal = async (productName: string, quantity: number, note?: string, productId?: string) => {
        const rawName = productName.trim();
        const cleanName = productName.replace(/\s*\(.*?\)\s*/g, '').trim();
        setRecipeModal({
            productName: rawName || cleanName,
            quantity,
            note,
            loading: true,
            recipes: [],
        });

        try {
            let targetProductId = productId;

            // Strategy 1: Check exact raw name (e.g. "Carne Salada (Frito)")
            if (!targetProductId) {
                const { data: exactProd } = await supabase
                    .from('products')
                    .select('id, name')
                    .eq('name', rawName)
                    .maybeSingle();

                targetProductId = exactProd?.id;
            }

            // Strategy 2: Check clean name (e.g. "Carne Salada")
            if (!targetProductId) {
                const { data: cleanProd } = await supabase
                    .from('products')
                    .select('id, name')
                    .eq('name', cleanName)
                    .maybeSingle();

                targetProductId = cleanProd?.id;
            }

            // Strategy 3: Partial ilike match
            if (!targetProductId) {
                const { data: altProd } = await supabase
                    .from('products')
                    .select('id, name')
                    .ilike('name', `%${cleanName}%`)
                    .limit(1)
                    .maybeSingle();

                targetProductId = altProd?.id;
            }

            if (targetProductId) {
                const { data: recipesData } = await supabase
                    .from('product_recipes')
                    .select(`
                        id,
                        quantity,
                        ingredient:restaurant_ingredients(id, name, unit)
                    `)
                    .eq('product_id', targetProductId);

                setRecipeModal(prev => prev ? {
                    ...prev,
                    loading: false,
                    recipes: (recipesData as any) || [],
                } : null);
            } else {
                setRecipeModal(prev => prev ? { ...prev, loading: false, recipes: [] } : null);
            }
        } catch (err) {
            console.error('Error fetching product recipe:', err);
            setRecipeModal(prev => prev ? { ...prev, loading: false, recipes: [] } : null);
        }
    };
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [soundEnabled, setSoundEnabled] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showDashboard, setShowDashboard] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [now, setNow] = useState(new Date());
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await supabase.auth.signOut();
        queryClient.clear();
        window.location.href = '/auth'; // Redirect to login
    };

    // Thresholds from settings or defaults
    const yellowThreshold = settings.kitchen_yellow_threshold || 5;
    const redThreshold = settings.kitchen_red_threshold || 10;
    const alertThreshold = settings.kitchen_alert_threshold || 15;

    const [tempThresholds, setTempThresholds] = useState({
        yellow: yellowThreshold,
        red: redThreshold,
        alert: alertThreshold
    });

    const lastOrderCount = useRef(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const criticalAudioRef = useRef<HTMLAudioElement | null>(null);

    // Live Clock for seconds
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Real-time notifications for web orders (POS notifications)
    useWebOrderNotifications({
        storeId: userStore?.id,
        enabled: true,
    });

    // ⚡ Real-time subscription directly for kitchen orders
    // This is what makes new 'preparing' orders appear instantly
    useEffect(() => {
        if (!userStore?.id) return;

        console.log('🍳 Kitchen: subscribing to real-time order updates');

        const channel = supabase
            .channel(`kitchen-orders-${userStore.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'open_orders',
                    filter: `store_id=eq.${userStore.id}`,
                },
                (payload) => {
                    console.log('🔥 Kitchen order change detected:', payload);
                    // Immediately refresh kitchen orders without waiting for polling
                    queryClient.invalidateQueries({ queryKey: ['kitchen-orders', userStore.id] });
                }
            )
            .subscribe((status) => {
                console.log('🍳 Kitchen realtime status:', status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userStore?.id, queryClient]);

    // Refetch active orders when the screen wakes up or the tab becomes visible again.
    // Without this, completed orders can reappear because the realtime channel
    // re-syncs stale data from the server on reconnect.
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Force a fresh DB fetch — ignore any optimistic cache
                queryClient.invalidateQueries({ queryKey: ['kitchen-orders', userStore?.id, 'active'] });
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [userStore?.id, queryClient]);

    const { data: activeOrders = [], isLoading: loadingActive } = useQuery({
        queryKey: ['kitchen-orders', userStore?.id, 'active'],
        queryFn: async () => {
            if (!userStore?.id) return [];
            const { data, error } = await supabase
                .from('open_orders')
                .select(`
                  *,
                  open_order_items (*)
                `)
                .eq('store_id', userStore.id)
                .eq('order_status', 'preparing')
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data as KitchenOrder[];
        },
        enabled: !!userStore?.id,
        refetchInterval: 3000, // Safety net: poll every 3s in case realtime misses something
    });

    const { data: completedOrders = [], isLoading: loadingHistory } = useQuery({
        queryKey: ['kitchen-orders', userStore?.id, 'history'],
        queryFn: async () => {
            if (!userStore?.id) return [];
            const { data, error } = await supabase
                .from('open_orders')
                .select(`
                  *,
                  open_order_items (*)
                `)
                .eq('store_id', userStore.id)
                .neq('order_status', 'preparing')
                .order('updated_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            return data as KitchenOrder[];
        },
        enabled: !!userStore?.id && showHistory,
    });

    const orders = showHistory ? completedOrders : activeOrders;
    const isLoading = showHistory ? loadingHistory : loadingActive;

    // Sound logic for new orders
    useEffect(() => {
        if (activeOrders.length > lastOrderCount.current) {
            if (soundEnabled && lastOrderCount.current !== 0) {
                audioRef.current?.play().catch(e => console.log('Audio error:', e));
            }
        }
        lastOrderCount.current = activeOrders.length;
    }, [activeOrders.length, soundEnabled]);

    // Critical alert sound logic
    useEffect(() => {
        if (!soundEnabled || showHistory || !activeOrders.length) return;

        const hasCritical = activeOrders.some(order =>
            differenceInMinutes(now, new Date(order.created_at)) >= alertThreshold
        );

        if (hasCritical) {
            // Play every 30 seconds if still critical
            const criticalInterval = setInterval(() => {
                criticalAudioRef.current?.play().catch(e => console.log('Critical audio error:', e));
            }, 30000);

            // Play immediately once
            criticalAudioRef.current?.play().catch(e => console.log('Critical audio error:', e));

            return () => clearInterval(criticalInterval);
        }
    }, [activeOrders, alertThreshold, now, soundEnabled, showHistory]);

    const updateStatusMutation = useMutation({
        mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
            const { error } = await supabase
                .from('open_orders')
                .update({ order_status: status, updated_at: new Date().toISOString() })
                .eq('id', orderId);

            if (error) throw error;
        },
        onMutate: async ({ orderId }) => {
            // Cancel any in-flight refetches so they don't overwrite our optimistic update
            await queryClient.cancelQueries({ queryKey: ['kitchen-orders', userStore?.id, 'active'] });

            // Snapshot the current data for rollback on error
            const previousOrders = queryClient.getQueryData(['kitchen-orders', userStore?.id, 'active']);

            // Optimistically remove the order from the active list immediately.
            // This prevents the "ghost order" effect where a completed order
            // reappears when the screen wakes up or the page is revisited.
            queryClient.setQueryData(['kitchen-orders', userStore?.id, 'active'], (old: KitchenOrder[] | undefined) =>
                (old ?? []).filter(o => o.id !== orderId)
            );

            return { previousOrders };
        },
        onError: (_err, _vars, context) => {
            // Roll back on error so the order reappears
            if (context?.previousOrders) {
                queryClient.setQueryData(['kitchen-orders', userStore?.id, 'active'], context.previousOrders);
            }
            toast({ title: "Error", description: "No se pudo actualizar el estado. Intenta de nuevo.", variant: "destructive" });
        },
        onSuccess: () => {
            // Invalidate both active and history so everything stays in sync
            queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
            toast({ title: "¡Orden lista!", description: "La orden fue marcada como completada." });
        }
    });

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const handleSaveThresholds = async () => {
        await updateSettings({
            ...settings,
            kitchen_yellow_threshold: tempThresholds.yellow,
            kitchen_red_threshold: tempThresholds.red,
            kitchen_alert_threshold: tempThresholds.alert
        } as any);
        setShowSettings(false);
        toast({ title: "Configuración guardada", description: "Los umbrales de tiempo han sido actualizados." });
    };

    const [filterType, setFilterType] = useState<'all' | 'dineIn' | 'takeout' | 'delivery'>('all');

    const displayedOrders = orders.filter(order => {
        if (filterType === 'all') return true;
        const notes = order.notes || '';
        if (filterType === 'dineIn') return !notes.includes('[PARA LLEVAR]') && !notes.includes('[DELIVERY]');
        if (filterType === 'takeout') return notes.includes('[PARA LLEVAR]');
        if (filterType === 'delivery') return notes.includes('[DELIVERY]');
        return true;
    });

    const formatElapsed = (order: KitchenOrder) => {
        const endTime = (showHistory && order.order_status !== 'preparing')
            ? new Date(order.updated_at)
            : now;
        const totalSeconds = differenceInSeconds(endTime, new Date(order.created_at));
        const mm = Math.floor(totalSeconds / 60);
        const ss = totalSeconds % 60;
        return `${mm}:${ss.toString().padStart(2, '0')}`;
    };

    const getTimeStatus = (createdAt: string) => {
        if (showHistory) return "bg-zinc-800 text-zinc-400 border-zinc-700";
        const minutes = differenceInMinutes(now, new Date(createdAt));
        if (minutes >= alertThreshold) return "bg-red-500 text-white font-mono font-black animate-pulse shadow-md";
        if (minutes >= redThreshold) return "bg-red-600 text-white font-mono font-black shadow-md";
        if (minutes >= yellowThreshold) return "bg-amber-500 text-amber-950 font-mono font-black shadow-md";
        return "bg-zinc-800 text-zinc-200 border border-zinc-700 font-mono font-black";
    };

    const getTimeBg = (createdAt: string) => {
        if (showHistory) return "bg-white border border-zinc-200 opacity-90 shadow-lg";

        const minutes = differenceInMinutes(now, new Date(createdAt));
        if (minutes >= alertThreshold) return "bg-white border-2 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.3)] animate-[blink-red_1.2s_ease-in-out_infinite]";
        if (minutes >= redThreshold) return "bg-white border-2 border-red-500/80 shadow-xl shadow-red-950/20";
        if (minutes >= yellowThreshold) return "bg-white border-2 border-amber-400 shadow-xl shadow-amber-950/20";
        return "bg-white border border-zinc-200/80 shadow-xl hover:shadow-2xl hover:border-zinc-400 transition-all";
    };

    if (!userStore) return <div className="flex items-center justify-center min-h-[60vh] bg-zinc-950 text-white"><Loader2 className="animate-spin h-8 w-8 text-emerald-500" /></div>;

    return (
        <div className="fixed inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 flex flex-col overflow-hidden text-white font-sans selection:bg-emerald-500/30">
            <audio ref={audioRef} src="https://assets.mixkit.com/active_storage/sfx/2568/2568-preview.mp3" preload="auto" />
            <audio ref={criticalAudioRef} src="https://assets.mixkit.com/active_storage/sfx/1003/1003-preview.mp3" preload="auto" />

            {/* ── Ultra-Professional Header ── */}
            <div className="flex flex-wrap items-center justify-between px-6 py-3.5 bg-zinc-900/95 border-b border-zinc-800/90 backdrop-blur-xl shrink-0 gap-3 shadow-xl">
                {/* Branding & Status */}
                <div className="flex items-center gap-3.5">
                    <div className={`p-3 rounded-2xl border ${showDashboard ? 'bg-purple-500/20 border-purple-500/30 text-purple-400' : showHistory ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'}`}>
                        {showDashboard
                            ? <BarChart2 className="h-6 w-6" />
                            : showHistory
                                ? <HistoryIcon className="h-6 w-6" />
                                : <ChefHat className="h-6 w-6" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-lg font-black tracking-wider uppercase text-white leading-none">
                                {showDashboard ? 'Rendimiento Cocina' : showHistory ? 'Historial de Pedidos' : 'Pantalla de Cocina (KDS)'}
                            </h1>
                            {!showHistory && !showDashboard && (
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1.5 shadow-sm">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                    LIVE
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            {!showHistory && !showDashboard && (
                                <span className="text-xs font-bold text-zinc-300">
                                    {activeOrders.length} {activeOrders.length === 1 ? 'Pedido Pendiente' : 'Pedidos Pendientes'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filter Tabs (Dine-in, Takeout, Delivery) */}
                {!showHistory && !showDashboard && (
                    <div className="flex items-center bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800/90 gap-1.5 shadow-inner">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${filterType === 'all' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50' : 'text-zinc-400 hover:text-white'}`}
                        >
                            Todos ({orders.length})
                        </button>
                        <button
                            onClick={() => setFilterType('dineIn')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${filterType === 'dineIn' ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/50' : 'text-zinc-400 hover:text-white'}`}
                        >
                            🍽️ Aquí
                        </button>
                        <button
                            onClick={() => setFilterType('takeout')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${filterType === 'takeout' ? 'bg-orange-600 text-white shadow-lg shadow-orange-950/50' : 'text-zinc-400 hover:text-white'}`}
                        >
                            🛍️ Llevar
                        </button>
                        <button
                            onClick={() => setFilterType('delivery')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${filterType === 'delivery' ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/50' : 'text-zinc-400 hover:text-white'}`}
                        >
                            🛵 Delivery
                        </button>
                    </div>
                )}

                {/* Right Action Controls */}
                <div className="flex items-center gap-2">
                    {(showHistory || showDashboard) && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 rounded-xl font-black px-4 gap-2 text-xs bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white"
                            onClick={() => { setShowHistory(false); setShowDashboard(false); }}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Volver a Cocina
                        </Button>
                    )}
                    {!showHistory && !showDashboard && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 rounded-xl font-black px-4 gap-2 text-xs bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-200"
                            onClick={() => setShowHistory(true)}
                        >
                            <HistoryIcon className="h-4 w-4 text-zinc-400" />
                            Historial
                        </Button>
                    )}
                    {!showDashboard && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-10 rounded-xl font-black px-4 gap-2 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 border border-purple-500/20"
                            onClick={() => { setShowDashboard(true); setShowHistory(false); }}
                        >
                            <BarChart2 className="h-4 w-4" />
                            Stats
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800"
                        onClick={() => { setTempThresholds({ yellow: yellowThreshold, red: redThreshold, alert: alertThreshold }); setShowSettings(true); }} title="Configuración de tiempos">
                        <Settings className="h-4.5 w-4.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800"
                        onClick={() => setSoundEnabled(!soundEnabled)} title={soundEnabled ? "Sonido activado" : "Sonido desactivado"}>
                        {soundEnabled ? <Bell className="h-4.5 w-4.5 text-emerald-400" /> : <BellOff className="h-4.5 w-4.5 text-zinc-600" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800"
                        onClick={toggleFullscreen} title="Pantalla completa">
                        {isFullscreen ? <Minimize className="h-4.5 w-4.5" /> : <Maximize className="h-4.5 w-4.5" />}
                    </Button>
                    <Button variant="destructive" size="sm" className="h-10 rounded-xl font-black px-3.5 gap-2 text-xs bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-950/50"
                        onClick={handleLogout} disabled={isLoggingOut}>
                        {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {/* ── Dashboard de Rendimiento ── */}
            {showDashboard && <KitchenPerformanceDashboard />}

            {/* ── Grid de órdenes ── */}
            {!showDashboard && <div className="flex-1 overflow-y-auto p-6 md:p-8">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 text-zinc-500">
                        <Loader2 className="animate-spin h-12 w-12 text-emerald-500" />
                        <p className="font-black text-sm uppercase tracking-widest text-zinc-400">Cargando pedidos de cocina...</p>
                    </div>
                ) : displayedOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-28 text-center bg-zinc-900/30 border border-zinc-800/60 rounded-3xl max-w-xl mx-auto my-12 p-8 shadow-2xl backdrop-blur-md">
                        <div className="p-4 rounded-2xl bg-zinc-800/80 border border-zinc-700/80 mb-4 text-emerald-400 shadow-inner">
                            <ChefHat className="h-14 w-14" />
                        </div>
                        <h2 className="text-2xl font-black uppercase text-white tracking-tight">{showHistory ? 'Sin Historial' : '¡Cocina al día!'}</h2>
                        <p className="text-sm font-bold text-zinc-400 mt-2 max-w-md">
                            {showHistory ? 'No hay pedidos completados recientemente.' : 'No hay pedidos pendientes en la cola. Los nuevos pedidos aparecerán automáticamente aquí.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 460px))', gap: '24px', justifyContent: 'start' }}>
                        {displayedOrders.map((order) => (
                            <div
                                key={order.id}
                                className={`rounded-3xl border overflow-hidden flex flex-col transition-all duration-300 relative ${getTimeBg(order.created_at)}`}
                            >
                                {/* 🍎 Apple Receipt Header (Dark Charcoal Banner) */}
                                <div className="bg-zinc-900 text-white px-5 py-4 flex items-center justify-between border-b border-zinc-800">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white shadow-inner">
                                            <ChefHat className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-mono font-black bg-black text-white px-2.5 py-0.5 rounded-md border border-zinc-700 shrink-0">
                                                    #{order.order_number.split('-').pop()}
                                                </span>
                                                {order.notes && (order.notes.includes('[PARA LLEVAR]') || order.notes.includes('[DELIVERY]')) ? (
                                                    <span className="text-[10px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/40 px-2 py-0.5 rounded-md uppercase">
                                                        🛍️ {order.notes.includes('[DELIVERY]') ? 'DELIVERY' : 'LLEVAR'}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/40 px-2 py-0.5 rounded-md uppercase">
                                                        {order.notes && order.notes.includes('[COMPRA AQUÍ]') ? '🏷️ COMPRA' : '🍽️ AQUÍ'}
                                                    </span>
                                                )}
                                                {order.notes && order.notes.includes('[ACTUALIZADO]') && (
                                                    <span className="text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded uppercase animate-pulse shadow-md">
                                                        🔄 ACTUALIZADO
                                                    </span>
                                                )}
                                                {showHistory && <span className="text-[10px] font-black text-emerald-400 uppercase bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">✓ LISTO</span>}
                                            </div>
                                            <p className="text-base font-black uppercase tracking-tight text-white truncate max-w-[190px] leading-tight mt-1">
                                                {order.customer_name}
                                            </p>
                                        </div>
                                    </div>

                                    <div className={`px-3 py-1.5 rounded-xl border font-mono font-black text-sm flex items-center gap-1.5 shrink-0 ${getTimeStatus(order.created_at)}`}>
                                        <Timer className="h-4 w-4" />
                                        {formatElapsed(order)}
                                    </div>
                                </div>

                                {/* 🧾 Receipt Main Body (Pure White) */}
                                <div className="flex-1 p-5 bg-white text-zinc-900">
                                    <table className="w-full">
                                        <tbody className="divide-y divide-zinc-200">
                                            {order.open_order_items.map((item) => {
                                                let displayTitle = item.product_name;
                                                let extractedNote = item.comment;
                                                if (!extractedNote) {
                                                    const match = displayTitle.match(/^(.*?)\s\((.*?)\)$/);
                                                    if (match) { displayTitle = match[1].trim(); extractedNote = match[2].trim(); }
                                                }
                                                return (
                                                    <tr
                                                        key={item.id}
                                                        className="hover:bg-zinc-50 cursor-pointer transition-all active:scale-[0.98] group rounded-xl"
                                                        onClick={() => handleOpenRecipeModal(item.product_name, item.quantity, extractedNote, item.product_id)}
                                                        title="Haz clic para ver la receta e ingredientes"
                                                    >
                                                        <td className="py-3 pl-1 pr-3 align-top w-12">
                                                            <div className="h-9 w-9 rounded-xl bg-zinc-900 text-white font-mono font-black text-lg flex items-center justify-center shadow-sm shrink-0">
                                                                {item.quantity}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 pr-1">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="font-black text-base uppercase tracking-tight text-zinc-900 group-hover:text-emerald-700 transition-colors leading-snug">
                                                                    {displayTitle}
                                                                </div>
                                                                <span className="px-2.5 py-1 rounded-xl bg-zinc-100 border border-zinc-300 text-zinc-700 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 text-xs font-bold flex items-center gap-1 shrink-0 transition-all shadow-sm">
                                                                    <UtensilsCrossed className="h-3.5 w-3.5" />
                                                                    Receta
                                                                </span>
                                                            </div>
                                                            {extractedNote && (
                                                                <div className="mt-2.5 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-950">
                                                                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                                                                    <p className="font-black text-xs uppercase leading-tight">
                                                                        {extractedNote}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>

                                    {order.notes && order.notes.replace(/\[PARA LLEVAR\]/g, '').replace(/\[COMER AQUÍ\]/g, '').replace(/\[COMPRA AQUÍ\]/g, '').replace(/\[DELIVERY\]/g, '').replace(/\[ACTUALIZADO\]/g, '').trim() !== '' && (() => {
                                        const cleanNote = order.notes.replace(/\[PARA LLEVAR\]/g, '').replace(/\[COMER AQUÍ\]/g, '').replace(/\[COMPRA AQUÍ\]/g, '').replace(/\[DELIVERY\]/g, '').replace(/\[ACTUALIZADO\]/g, '').trim();
                                        const isUpdateNote = cleanNote.startsWith('Pedido actualizado de:');
                                        const refMatch = cleanNote.match(/#([A-Z0-9-]+)/);
                                        const refOrderNumber = refMatch ? refMatch[1] : null;

                                        const handleNoteClick = async () => {
                                            if (!isUpdateNote || !refOrderNumber) return;
                                            setOriginalOrderModal({ orderNumber: refOrderNumber, order: null, loading: true });
                                            const { data } = await supabase
                                                .from('open_orders')
                                                .select('*, open_order_items(*)')
                                                .eq('order_number', refOrderNumber)
                                                .single();
                                            setOriginalOrderModal(prev => prev ? { ...prev, order: data as KitchenOrder, loading: false } : null);
                                        };

                                        return (
                                            <div
                                                className={`mx-1 my-3 p-3 rounded-xl border ${isUpdateNote ? 'bg-red-50 border-red-300 cursor-pointer hover:bg-red-100 active:scale-[0.98] transition-all' : 'bg-orange-50 border-orange-300'}`}
                                                onClick={isUpdateNote ? handleNoteClick : undefined}
                                            >
                                                <p className={`text-xs font-black uppercase mb-1 flex items-center gap-1.5 ${isUpdateNote ? 'text-red-700' : 'text-orange-800'}`}>
                                                    <AlertTriangle className="h-4 w-4" />
                                                    {isUpdateNote ? '🔄 VER PEDIDO ORIGINAL' : 'NOTA DEL PEDIDO'}
                                                </p>
                                                <p className={`text-xs font-bold whitespace-pre-line ${isUpdateNote ? 'text-red-950' : 'text-orange-950'}`}>
                                                    {cleanNote}
                                                </p>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* 🎫 Paper Receipt Ticket Side Cutout Notches */}
                                <div className="relative bg-white h-4 w-full flex items-center justify-between border-t border-dashed border-zinc-300">
                                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-950 border-r border-zinc-300"></div>
                                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-950 border-l border-zinc-300"></div>
                                </div>

                                {/* 🧾 Receipt Bottom Section & Barcode Action Button */}
                                {!showHistory && (
                                    <div className="p-4 bg-white">
                                        <Button
                                            className="w-full h-12 rounded-xl bg-zinc-900 hover:bg-emerald-600 text-white font-black text-xs tracking-widest uppercase shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                                            onClick={() => updateStatusMutation.mutate({
                                                orderId: order.id,
                                                status: (order.notes?.includes('[PARA LLEVAR]') || order.notes?.includes('[DELIVERY]')) ? 'shipped' : 'completed'
                                            })}
                                            disabled={updateStatusMutation.isPending}
                                        >
                                            {updateStatusMutation.isPending
                                                ? <Loader2 className="animate-spin h-5 w-5" />
                                                : <>
                                                    <Check className="h-5 w-5 text-emerald-400 group-hover:text-white" />
                                                    MARCAR COMO LISTO
                                                </>
                                            }
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>}

            {/* Configuración de Umbrales */}
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Configuración de Tiempos
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="flex justify-between">
                                <span>Umbral AMARILLO (Advertencia)</span>
                                <span className="text-primary font-bold">{tempThresholds.yellow} min</span>
                            </Label>
                            <Input
                                type="number"
                                value={tempThresholds.yellow}
                                onChange={(e) => setTempThresholds({ ...tempThresholds, yellow: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="flex justify-between">
                                <span>Umbral ROJO (Peligro)</span>
                                <span className="text-red-500 font-bold">{tempThresholds.red} min</span>
                            </Label>
                            <Input
                                type="number"
                                value={tempThresholds.red}
                                onChange={(e) => setTempThresholds({ ...tempThresholds, red: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="flex justify-between">
                                <span>Umbral SUPER ALERTA (Parpadeo)</span>
                                <span className="text-red-600 font-bold animate-pulse">{tempThresholds.alert} min</span>
                            </Label>
                            <Input
                                type="number"
                                value={tempThresholds.alert}
                                onChange={(e) => setTempThresholds({ ...tempThresholds, alert: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSettings(false)}>Cancelar</Button>
                        <Button onClick={handleSaveThresholds} className="gap-2">
                            <Check className="h-4 w-4" /> Guardar Cambios
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal: Pedido Original Completo */}
            <Dialog open={!!originalOrderModal} onOpenChange={() => setOriginalOrderModal(null)}>
                <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-white flex flex-col" style={{ maxHeight: '85vh' }}>
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <span className="text-[10px] font-black bg-zinc-800 px-2 py-0.5 rounded uppercase">
                                #{originalOrderModal?.orderNumber?.split('-').pop()}
                            </span>
                            <span>Pedido Original Completo</span>
                        </DialogTitle>
                    </DialogHeader>

                    {originalOrderModal?.loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                        </div>
                    ) : originalOrderModal?.order ? (
                        <div className="flex flex-col gap-3 min-h-0 flex-1">
                            {/* Cliente + Estado — estático */}
                            <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 rounded-lg shrink-0">
                                <span className="text-sm font-black text-white">{originalOrderModal.order.customer_name}</span>
                                <span className={`text-xs font-black px-2 py-0.5 rounded uppercase ${originalOrderModal.order.order_status === 'completed' ? 'bg-emerald-600 text-white' :
                                        originalOrderModal.order.order_status === 'preparing' ? 'bg-amber-500 text-white' :
                                            'bg-zinc-700 text-zinc-300'
                                    }`}>
                                    {originalOrderModal.order.order_status === 'completed' ? '✓ Listo' :
                                        originalOrderModal.order.order_status === 'preparing' ? '🔄 En cocina' :
                                            originalOrderModal.order.order_status}
                                </span>
                            </div>

                            {/* Lista de ítems — con scroll */}
                            <div className="overflow-y-auto rounded-lg border border-zinc-800" style={{ maxHeight: '280px' }}>
                                <table className="w-full">
                                    <tbody>
                                        {originalOrderModal.order.open_order_items.map((item, idx) => {
                                            let displayTitle = item.product_name;
                                            let extractedNote = item.comment;
                                            if (!extractedNote) {
                                                const match = displayTitle.match(/^(.*?)\s\((.*?)\)$/);
                                                if (match) { displayTitle = match[1].trim(); extractedNote = match[2].trim(); }
                                            }
                                            return (
                                                <tr key={item.id || idx} className="border-b border-zinc-800">
                                                    <td className="py-2 pl-3 pr-2 w-10">
                                                        <div className="h-7 w-7 rounded-md bg-zinc-800 flex items-center justify-center font-black text-sm text-white">
                                                            {item.quantity}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 pr-3">
                                                        <div className="font-black text-sm uppercase tracking-tight text-white">{displayTitle}</div>
                                                        {extractedNote && (
                                                            <div className="mt-0.5 text-[10px] text-amber-400 font-bold">⚠️ {extractedNote}</div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Notas — estático */}
                            {originalOrderModal.order.notes && originalOrderModal.order.notes
                                .replace(/\[PARA LLEVAR\]/g, '')
                                .replace(/\[COMER AQUÍ\]/g, '')
                                .replace(/\[COMPRA AQUÍ\]/g, '')
                                .replace(/\[DELIVERY\]/g, '')
                                .replace(/\[ACTUALIZADO\]/g, '')
                                .trim() !== '' && (
                                    <div className="px-3 py-2 bg-zinc-900 rounded-lg shrink-0">
                                        <p className="text-[10px] font-black uppercase text-zinc-500 mb-1">Notas</p>
                                        <p className="text-xs text-zinc-300 whitespace-pre-line">
                                            {originalOrderModal.order.notes
                                                .replace(/\[PARA LLEVAR\]/g, '')
                                                .replace(/\[COMER AQUÍ\]/g, '')
                                                .replace(/\[COMPRA AQUÍ\]/g, '')
                                                .replace(/\[DELIVERY\]/g, '')
                                                .replace(/\[ACTUALIZADO\]/g, '')
                                                .trim()}
                                        </p>
                                    </div>
                                )}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-zinc-500">
                            <p className="font-bold">No se encontró el pedido original</p>
                        </div>
                    )}

                    {/* Botón Cerrar — siempre estático abajo */}
                    <DialogFooter className="shrink-0 pt-2">
                        <Button variant="outline" onClick={() => setOriginalOrderModal(null)} className="border-zinc-700 text-zinc-300">
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>

            </Dialog>

            {/* Modal: Receta e Ingredientes del Producto */}
            <Dialog open={!!recipeModal} onOpenChange={() => setRecipeModal(null)}>
                <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-white flex flex-col rounded-2xl shadow-2xl p-5" style={{ maxHeight: '85vh' }}>
                    <DialogHeader className="shrink-0 pb-2 border-b border-zinc-800">
                        <DialogTitle className="flex items-center gap-2 text-white font-black text-base">
                            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                <UtensilsCrossed className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                                <span className="uppercase tracking-tight text-white font-black">{recipeModal?.productName}</span>
                                <span className="text-xs text-zinc-400 font-bold">Receta e Ingredientes del Pedido</span>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    {recipeModal?.loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                            <p className="text-xs text-zinc-400 font-bold">Consultando receta del producto...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 py-2 overflow-y-auto">
                            {/* Cantidad ordenada y Nota */}
                            <div className="flex items-center justify-between p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-zinc-400">Cantidad en Pedido</p>
                                    <p className="text-lg font-black text-emerald-400">{recipeModal?.quantity} {recipeModal?.quantity === 1 ? 'Unidad' : 'Unidades'}</p>
                                </div>
                                {recipeModal?.note && (
                                    <div className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300">
                                        <p className="text-[9px] font-black uppercase flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            {recipeModal.note}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Lista de ingredientes */}
                            {recipeModal?.recipes && recipeModal.recipes.length > 0 ? (
                                <div className="space-y-2">
                                    <p className="text-xs font-black uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
                                        <Package className="h-4 w-4 text-emerald-400" />
                                        Ingredientes requeridos para este pedido
                                    </p>
                                    <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/50">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b border-zinc-800 bg-zinc-900/80 text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                                                    <th className="py-2.5 px-3">Ingrediente</th>
                                                    <th className="py-2.5 px-2 text-center">Porción (1u)</th>
                                                    <th className="py-2.5 px-3 text-right">Total Pedido</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-800/60 text-xs">
                                                {recipeModal.recipes.map((r) => {
                                                    const ingName = r.ingredient?.name || 'Ingrediente';
                                                    const ingUnit = r.ingredient?.unit || '';
                                                    const portion = r.quantity || 0;
                                                    const totalQty = portion * (recipeModal.quantity || 1);

                                                    return (
                                                        <tr key={r.id} className="hover:bg-zinc-800/40">
                                                            <td className="py-2.5 px-3 font-black text-white">{ingName}</td>
                                                            <td className="py-2.5 px-2 text-center font-bold text-zinc-400">{portion} {ingUnit}</td>
                                                            <td className="py-2.5 px-3 text-right">
                                                                <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono font-black text-xs border border-emerald-500/30">
                                                                    {totalQty.toLocaleString('es-DO')} {ingUnit}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-6 text-center bg-zinc-900/50 border border-zinc-800 rounded-xl gap-2">
                                    <UtensilsCrossed className="h-10 w-10 text-zinc-600 mb-1" />
                                    <p className="font-black text-sm text-zinc-200">Sin receta/ingredientes vinculados</p>
                                    <p className="text-xs text-zinc-400 max-w-xs">
                                        Este producto no tiene ingredientes asignados en el módulo de Inventario.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter className="shrink-0 pt-2 border-t border-zinc-800">
                        <Button className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black text-xs tracking-wider uppercase rounded-xl h-10" onClick={() => setRecipeModal(null)}>
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );

};

export default KitchenDisplay;
