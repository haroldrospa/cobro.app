
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/hooks/useUserStore';
import { useToast } from '@/hooks/use-toast';
import {
    Bike,
    MapPin,
    Phone,
    CheckCircle2,
    ExternalLink,
    Clock,
    Package,
    DollarSign,
    Search,
    ChevronRight,
    Loader2,
    Navigation,
    User,
    Wallet,
    CreditCard,
    LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useWebOrderNotifications } from '@/hooks/useWebOrderNotifications';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Order {
    id: string;
    order_number: string;
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    payment_method: string;
    total: number;
    order_status: string;
    created_at: string;
    notes?: string;
}

const Delivery: React.FC = () => {
    const { data: userStore } = useUserStore();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await supabase.auth.signOut();
        queryClient.clear();
        window.location.href = '/auth'; // Redirect to login
    };

    // Real-time notifications to refresh the list
    useWebOrderNotifications({
        storeId: userStore?.id,
        enabled: true,
    });

    const { data: orders = [], isLoading, refetch } = useQuery({
        queryKey: ['delivery-orders', userStore?.id],
        queryFn: async () => {
            if (!userStore?.id) return [];
            const { data, error } = await supabase
                .from('open_orders')
                .select('*')
                .eq('store_id', userStore.id)
                .eq('order_status', 'shipped')
                // Only show "Para Llevar" orders in Delivery page
                .or('notes.ilike.%[PARA LLEVAR]%,notes.ilike.%[DELIVERY]%')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Order[];
        },
        enabled: !!userStore?.id,
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
            const { error } = await supabase
                .from('open_orders')
                .update({ order_status: status })
                .eq('id', orderId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
            queryClient.invalidateQueries({ queryKey: ['web-orders'] });
            toast({
                title: "¡Pedido Entregado!",
                description: "Buen trabajo, el estado ha sido actualizado.",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: "No se pudo actualizar el estado.",
                variant: "destructive",
            });
        }
    });

    const openInGoogleMaps = (address: string) => {
        const gpsMatch = address.match(/\[GPS: (.*?)\]/);
        let query = '';

        if (gpsMatch && gpsMatch[1]) {
            if (gpsMatch[1].includes('maps.google.com') || gpsMatch[1].includes('goo.gl')) {
                window.open(gpsMatch[1], '_blank');
                return;
            }
            query = gpsMatch[1];
        } else {
            query = (address || '').split('\n')[0];
        }

        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        window.open(url, '_blank');
    };

    const filteredOrders = orders.filter(order =>
        (order.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.order_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.customer_phone && order.customer_phone.includes(searchTerm)) ||
        (order.customer_address || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!userStore) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
                <div className="relative h-16 w-16">
                    <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-muted-foreground font-medium animate-pulse">Iniciando panel...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-zinc-950 -m-4 p-4 md:m-0 md:p-0">
            <div className="max-w-xl mx-auto space-y-6">
                {/* Mobile Header Interface */}
                <div className="sticky top-0 z-40 pt-2 pb-4 bg-slate-50/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-b-3xl mb-2 px-2">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary/10 rounded-2xl">
                                <Bike className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black tracking-tight text-foreground">Entregas</h1>
                                <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70">Panel Activo</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="h-8 border-primary/20 bg-primary/5 text-primary font-bold px-3">
                                {orders.length} Pedidos
                            </Badge>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 rounded-lg font-bold px-3 gap-2"
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                            >
                                {isLoggingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                                <span className="hidden sm:inline">Salir</span>
                            </Button>
                        </div>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Nombre, teléfono o pedido..."
                            className="pl-11 h-12 bg-white dark:bg-zinc-900 border-none shadow-sm rounded-2xl focus-visible:ring-2 focus-visible:ring-primary/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="space-y-4 px-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-56 rounded-3xl bg-muted/20 animate-pulse border border-muted/30" />
                        ))}
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full"></div>
                            <Package className="h-20 w-20 text-primary/30 relative" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground">¡Todo al día!</h3>
                        <p className="text-sm text-muted-foreground mt-2 max-w-[240px] mx-auto">
                            {searchTerm ? "No encontramos pedidos con ese filtro." : "No hay pedidos en camino en este momento."}
                        </p>
                        {searchTerm && (
                            <Button variant="link" className="mt-2 text-primary h-auto p-0 font-bold" onClick={() => setSearchTerm('')}>
                                Ver todos
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-5 pb-24 px-2">
                        {filteredOrders.map((order) => (
                            <div
                                key={order.id}
                                className="group relative bg-white dark:bg-zinc-900 rounded-[2rem] border border-border/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden animate-in slide-in-from-bottom-4 duration-500"
                            >
                                {/* Order Header */}
                                <div className="px-6 py-4 flex items-center justify-between border-b border-border/40">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-500 uppercase">
                                            #{order.order_number ? order.order_number.split('-').pop() : '---'}
                                        </span>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold">
                                            <Clock className="h-3 w-3" />
                                            {formatDistanceToNow(new Date(order.created_at), { locale: es })}
                                        </div>
                                    </div>
                                    <Badge className="bg-orange-500 text-white border-none shadow-sm shadow-orange-500/20 text-[10px] font-black uppercase px-2.5 py-0.5 animate-pulse">
                                        En camino
                                    </Badge>
                                </div>

                                <div className="p-6">
                                    {/* Customer Info */}
                                    <div className="flex items-start justify-between mb-5">
                                        <div className="space-y-1">
                                            <h3 className="text-xl font-extrabold text-foreground tracking-tight">{order.customer_name}</h3>
                                            <div className="flex items-center gap-1 text-primary">
                                                <DollarSign className="h-4 w-4" />
                                                <span className="text-lg font-black tracking-tighter">${order.total.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-border/50">
                                            {order.payment_method === 'cash' ? <Wallet className="h-5 w-5 text-zinc-500" /> : <CreditCard className="h-5 w-5 text-zinc-500" />}
                                        </div>
                                    </div>

                                    {/* Address Card */}
                                    <div className="relative mb-5 p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-border/50 group/address transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800">
                                        <div className="flex gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-white dark:bg-zinc-900 border border-border/50 flex items-center justify-center shadow-sm shrink-0">
                                                <MapPin className="h-5 w-5 text-red-500" />
                                            </div>
                                            <div className="flex-1 min-w-0 pr-6">
                                                <p className="text-sm font-bold text-foreground leading-snug line-clamp-2">
                                                    {(order.customer_address || 'Sin dirección').split('\n')[0]}
                                                </p>
                                                {order.customer_address && order.customer_address.includes('[GPS:') && (
                                                    <div className="flex items-center gap-1 mt-1 text-emerald-600 dark:text-emerald-400 font-black text-[9px] uppercase tracking-wider">
                                                        <Navigation className="h-2.5 w-2.5 fill-current" />
                                                        GPS Preciso Disponible
                                                    </div>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-primary"
                                                onClick={() => openInGoogleMaps(order.customer_address || '')}
                                            >
                                                <ExternalLink className="h-5 w-5" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Notes if any */}
                                    {order.notes && order.notes.replace(/\[PARA LLEVAR\]/g, '').replace(/\[DELIVERY\]/g, '').replace(/\[COMER AQUÍ\]/g, '').replace(/\[COMPRA AQUÍ\]/g, '').trim() !== '' && (
                                        <div className="mb-6 p-4 rounded-2xl bg-orange-500/5 border border-orange-200/30">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <Package className="h-3.5 w-3.5 text-orange-600" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">Instrucciones</span>
                                            </div>
                                            <p className="text-xs text-orange-900 dark:text-orange-200/70 font-medium leading-relaxed italic">
                                                "{order.notes.replace(/\[PARA LLEVAR\]/g, '').replace(/\[DELIVERY\]/g, '').replace(/\[COMER AQUÍ\]/g, '').replace(/\[COMPRA AQUÍ\]/g, '').trim()}"
                                            </p>
                                        </div>
                                    )}

                                    {/* Large Action Buttons */}
                                    <div className="space-y-3 pt-2">
                                        {order.customer_phone && (
                                            <Button
                                                className="w-full h-14 rounded-2xl font-black text-sm bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 active:scale-[0.98] transition-all shadow-xl shadow-zinc-950/10 dark:shadow-white/5"
                                                onClick={() => window.open(`tel:${order.customer_phone}`, '_self')}
                                            >
                                                <div className="flex items-center justify-center w-full relative">
                                                    <div className="absolute left-0 p-2 bg-white/10 dark:bg-zinc-950/20 rounded-xl">
                                                        <Phone className="h-5 w-5" />
                                                    </div>
                                                    Contactar Cliente
                                                </div>
                                            </Button>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <Button
                                                variant="outline"
                                                className="h-14 rounded-2xl font-black text-xs border-2 border-border/80 hover:bg-muted active:scale-[0.98] transition-all"
                                                onClick={() => openInGoogleMaps(order.customer_address || '')}
                                            >
                                                <Navigation className="h-4 w-4 mr-2" />
                                                Ver Ruta
                                            </Button>
                                            <Button
                                                className="h-14 rounded-2xl font-black text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all"
                                                onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: 'completed' })}
                                                disabled={updateStatusMutation.isPending}
                                            >
                                                {updateStatusMutation.isPending ? (
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                ) : (
                                                    <><CheckCircle2 className="h-4 w-4 mr-2" /> Finalizar</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Delivery;
