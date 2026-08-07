
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
        <div className="mt-6 w-full">
            {/* Progress Bar Container */}
            <div className="relative mb-8 px-2">
                {/* Background Line */}
                <div className="absolute top-4 left-6 right-6 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full" />

                {/* Animated Progress Line with Gradient */}
                <motion.div
                    className="absolute top-4 left-6 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full z-10 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                    initial={{ width: '0%' }}
                    animate={{ width: `calc(${(currentIndex / (statusSteps.length - 1)) * 100}%)` }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                />

                {/* Steps */}
                <div className="relative flex justify-between items-start">
                    {statusSteps.map((step, index) => {
                        const Icon = step.icon;
                        const isCompleted = index < currentIndex;
                        const isActive = index === currentIndex;

                        return (
                            <div key={step.id} className="flex flex-col items-center w-14 sm:w-16 min-w-0">
                                <motion.div
                                    initial={false}
                                    animate={{
                                        scale: isActive ? 1.15 : 1,
                                        backgroundColor: isActive || isCompleted ? 'hsl(var(--primary))' : 'hsl(var(--card))',
                                        borderColor: isActive || isCompleted ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                                        color: isActive || isCompleted ? '#ffffff' : 'hsl(var(--muted-foreground))'
                                    }}
                                    className={cn(
                                        "h-9 w-9 rounded-xl border-2 flex items-center justify-center relative z-20 transition-all duration-300 shadow-sm shrink-0",
                                        isActive && "shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-500/20 border-emerald-400",
                                    )}
                                >
                                    {isActive ? (
                                        <motion.div
                                            animate={{
                                                rotate: step.id === 'preparing' ? [0, 10, -10, 0] : 0,
                                                y: step.id === 'shipped' ? [0, -2, 0] : 0
                                            }}
                                            transition={{ repeat: Infinity, duration: 2 }}
                                        >
                                            <Icon className="h-4 w-4 animate-pulse text-white" />
                                        </motion.div>
                                    ) : (
                                        <Icon className="h-4 w-4" />
                                    )}

                                    {/* Success checkmark Overlay */}
                                    {isCompleted && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-background"
                                        >
                                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                                        </motion.div>
                                    )}
                                </motion.div>

                                <div className="mt-2 text-center w-full min-w-0 px-0">
                                    <p className={cn(
                                        "text-[9.5px] sm:text-[10px] leading-tight font-bold transition-colors text-center [word-break:keep-all]",
                                        isActive ? "text-primary font-black" : isCompleted ? "text-emerald-500 font-semibold" : "text-muted-foreground/60"
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
                className="relative p-4 rounded-2xl overflow-hidden border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/30 backdrop-blur-sm shadow-sm"
            >
                {/* Decorative Background Accent */}
                <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 blur-2xl rounded-full -mr-10 -mt-10 pointer-events-none" />

                <div className="relative flex items-center gap-3.5">
                    <div className="h-11 w-11 rounded-xl bg-background shadow-md border border-emerald-500/20 flex items-center justify-center text-primary shrink-0">
                        {status === 'pending' && <Loader2 className="h-5 w-5 animate-spin text-amber-500" />}
                        {status === 'confirmed' && <CheckCircle2 className="h-5 w-5 text-blue-500" />}
                        {status === 'preparing' && (
                            isMarket
                                ? <PackageCheck className="h-5 w-5 text-emerald-500 animate-bounce" />
                                : <Flame className="h-5 w-5 text-orange-500 animate-bounce" />
                        )}
                        {status === 'shipped' && <Bike className="h-5 w-5 text-indigo-500" />}
                        {status === 'delivered' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                        {(!['pending', 'confirmed', 'preparing', 'shipped', 'delivered'].includes(status)) && <Clock className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs sm:text-sm text-foreground tracking-tight leading-tight mb-0.5">
                            {status === 'pending' ? 'Pedido Recibido' :
                                status === 'confirmed' ? '¡Orden Confirmada!' :
                                    status === 'preparing' ? (isMarket ? 'Preparando tu Pedido' : 'En el Fogón') :
                                        status === 'shipped' ? '¡Va en camino!' :
                                            status === 'delivered' ? 'Entregado' : 'Estado Actualizado'}
                        </h4>
                        <p className="text-[11px] text-muted-foreground font-medium leading-snug">
                            {status === 'pending' ? 'La tienda está por confirmar tu pedido.' :
                                status === 'confirmed' ? '¡Genial! Tu pedido ha sido aceptado.' :
                                    status === 'preparing' ? (isMarket ? 'Tu pedido está siendo preparado con cuidado.' : 'Nuestros cocineros están manos a la obra.') :
                                        status === 'shipped' ? 'El repartidor ya tiene tu pedido.' :
                                            status === 'delivered' ? '¡Muchas gracias por pedir con nosotros!' : 'Sincronizando actualizaciones en tiempo real.'}
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
