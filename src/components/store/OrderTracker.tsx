
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock,
    Flame,
    Bike,
    CheckCircle2,
    Check,
    Sparkles,
    Ban,
    ChevronRight,
    Loader2,
    PackageCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderTrackerProps {
    status: string;
    shopType?: string;
}



const getStatusIndex = (status: string) => {
    switch (status) {
        case 'pending': return 0;
        case 'confirmed': return 1;
        case 'preparing': return 2;
        case 'shipped': return 3;
        case 'delivered': return 4;
        case 'completed': return 4;
        case 'cancelled': return -1;
        default: return 0;
    }
};

export const OrderTracker: React.FC<OrderTrackerProps> = ({ status, shopType }) => {
    const currentIndex = getStatusIndex(status);
    const isCancelled = status === 'cancelled';

    const isMarket = shopType === 'store' || shopType === 'supermarket';

    const statusSteps = [
        { id: 'pending', label: 'Orden', icon: Clock },
        { id: 'confirmed', label: 'Confirmado', icon: Check },
        { id: 'preparing', label: isMarket ? 'Preparando' : 'Cocinando', icon: isMarket ? PackageCheck : Flame },
        { id: 'shipped', label: 'En camino', icon: Bike },
        { id: 'delivered', label: 'Entregado', icon: CheckCircle2 },
    ];

    if (isCancelled) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-4 rounded-[1.5rem] bg-red-500/5 border border-red-500/20 flex items-center gap-3 text-red-500"
            >
                <Ban className="h-5 w-5" />
                <span className="font-black text-xs uppercase tracking-widest">Pedido Cancelado</span>
            </motion.div>
        );
    }

    return (
        <div className="mt-8 w-full">
            {/* Progress Bar Container */}
            <div className="relative mb-12 px-4">
                {/* Background Line */}
                <div className="absolute top-5 left-4 right-4 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full" />

                {/* Animated Progress Line with Gradient */}
                <motion.div
                    className="absolute top-5 left-4 h-1.5 bg-gradient-to-r from-primary via-emerald-500 to-emerald-400 rounded-full z-10 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                    initial={{ width: '0%' }}
                    animate={{ width: `calc(${(currentIndex / (statusSteps.length - 1)) * 100}% - 8px)` }}
                    transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                />

                {/* Steps */}
                <div className="relative flex justify-between">
                    {statusSteps.map((step, index) => {
                        const Icon = step.icon;
                        const isCompleted = index < currentIndex;
                        const isActive = index === currentIndex;

                        return (
                            <div key={step.id} className="flex flex-col items-center">
                                <motion.div
                                    initial={false}
                                    animate={{
                                        scale: isActive ? 1.3 : 1,
                                        backgroundColor: isActive || isCompleted ? 'hsl(var(--primary))' : 'hsl(var(--background))',
                                        borderColor: isActive || isCompleted ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                                        color: isActive || isCompleted ? '#fff' : 'hsl(var(--muted-foreground))'
                                    }}
                                    className={cn(
                                        "h-10 w-10 rounded-2xl border-2 flex items-center justify-center relative z-20 transition-all duration-500 shadow-sm",
                                        isActive && "shadow-xl shadow-primary/30 ring-4 ring-primary/10",
                                    )}
                                >
                                    {isActive ? (
                                        <motion.div
                                            animate={{
                                                rotate: step.id === 'preparing' ? [0, 15, -15, 0] : 0,
                                                y: step.id === 'shipped' ? [0, -3, 0] : 0
                                            }}
                                            transition={{ repeat: Infinity, duration: 2 }}
                                        >
                                            <Icon className={cn("h-5 w-5", isActive && "animate-pulse")} />
                                        </motion.div>
                                    ) : (
                                        <Icon className="h-5 w-5" />
                                    )}

                                    {/* Success checkmark Overlay */}
                                    {isCompleted && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-background"
                                        >
                                            <CheckCircle2 className="h-2 w-2" />
                                        </motion.div>
                                    )}

                                    {/* Active Pulse Ring */}
                                    {isActive && (
                                        <motion.div
                                            className="absolute inset-0 rounded-2xl bg-primary/30"
                                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                            transition={{ repeat: Infinity, duration: 2 }}
                                        />
                                    )}
                                </motion.div>

                                <div className="mt-4 text-center">
                                    <p className={cn(
                                        "text-[9px] font-black uppercase tracking-widest transition-colors duration-500",
                                        isActive ? "text-primary" : isCompleted ? "text-emerald-600/80" : "text-muted-foreground/40"
                                    )}>
                                        {step.label}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Current Status Message Display (Premium Glassmorphism) */}
            <motion.div
                layout
                whileHover={{ y: -2 }}
                className="relative p-5 rounded-[2rem] overflow-hidden border border-primary/20 bg-primary/5 group"
            >
                {/* Decorative Blur */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] rounded-full -mr-16 -mt-16 group-hover:bg-primary/20 transition-colors" />

                <div className="relative flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-white dark:bg-zinc-900 shadow-lg flex items-center justify-center text-primary ring-1 ring-primary/10">
                            {status === 'pending' && <Loader2 className="h-6 w-6 animate-spin text-amber-500" />}
                            {status === 'confirmed' && <CheckCircle2 className="h-6 w-6 text-blue-500" />}
                            {status === 'preparing' && (
                                isMarket
                                    ? <PackageCheck className="h-6 w-6 text-emerald-500 animate-bounce" />
                                    : <Flame className="h-6 w-6 text-orange-500 animate-bounce" />
                            )}
                            {status === 'shipped' && <Bike className="h-6 w-6 text-indigo-500" />}
                            {status === 'delivered' && <CheckCircle2 className="h-6 w-6 text-emerald-500" />}
                            {(!['pending', 'confirmed', 'preparing', 'shipped', 'delivered'].includes(status)) && <Clock className="h-6 w-6" />}
                        </div>
                        <div>
                            <h4 className="font-black text-sm text-foreground uppercase tracking-tight leading-none mb-1">
                                {status === 'pending' ? 'Pedido Recibido' :
                                    status === 'confirmed' ? '¡Orden Confirmada!' :
                                        status === 'preparing' ? (isMarket ? 'Preparando tu Pedido' : 'En el Fogon') :
                                            status === 'shipped' ? '¡Va en camino!' :
                                                status === 'delivered' ? 'Entregado' : 'Estado Actualizado'}
                            </h4>
                            <p className="text-[11px] text-muted-foreground font-bold opacity-70">
                                {status === 'pending' ? 'La tienda está por confirmar tu pedido.' :
                                    status === 'confirmed' ? '¡Genial! Tu pedido ha sido aceptado.' :
                                        status === 'preparing' ? (isMarket ? 'Tu pedido está siendo preparado con cuidado.' : 'Nuestros cocineros están manos a la obra.') :
                                            status === 'shipped' ? 'El repartidor ya tiene tu pedido.' :
                                                status === 'delivered' ? '¡Muchas gracias por pedir con nosotros!' : 'Sincronizando actualizaciones en tiempo real.'}
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
