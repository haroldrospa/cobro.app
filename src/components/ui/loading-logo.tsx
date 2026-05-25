import React from 'react';
import logo from '@/assets/cobro-logo.png';
import { cn } from '@/lib/utils';

interface LoadingLogoProps {
    text?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const LoadingLogo: React.FC<LoadingLogoProps> = ({
    text = 'Cargando...',
    size = 'md',
    className = ''
}) => {
    const sizeClasses = {
        sm: 'w-20 h-20',
        md: 'w-28 h-28',
        lg: 'w-36 h-36',
    };

    return (
        <div className={cn("flex flex-col items-center justify-center gap-8 w-full max-w-sm mx-auto p-8", className)}>
            
            {/* Logo Container con Glow Premium */}
            <div className="relative flex items-center justify-center">
                {/* Anillo exterior animado */}
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 blur-[2px] animate-[spin_4s_linear_infinite]" style={{ margin: '-20px' }}></div>
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-500/30 animate-[spin_6s_linear_infinite_reverse]" style={{ margin: '-10px' }}></div>
                
                {/* Resplandor pulsante detrás del logo */}
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" style={{ margin: '-15px' }}></div>
                
                {/* Logo principal con escala suave */}
                <div className="relative z-10 animate-in zoom-in duration-700 ease-out">
                    <img
                        src={logo}
                        alt="Cobro Logo"
                        className={cn(sizeClasses[size], "object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]")}
                        style={{
                            animation: 'logo-subtle-pulse 3s ease-in-out infinite'
                        }}
                    />
                </div>
            </div>

            {/* Texto y progreso */}
            {text && (
                <div className="flex flex-col items-center gap-5 w-full mt-4">
                    {/* Texto con gradiente y espaciado premium */}
                    <div className="flex flex-col items-center gap-1">
                        <h2 
                            className="text-lg font-black uppercase tracking-[0.2em] bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-200 to-emerald-400 text-center"
                            style={{
                                backgroundSize: '200% auto',
                                animation: 'logo-gradient 3s linear infinite'
                            }}
                        >
                            {text.replace('...', '')}
                        </h2>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-medium opacity-70">
                            Por favor espera
                        </span>
                    </div>

                    {/* Línea de progreso minimalista (Expande desde el centro) */}
                    <div className="relative w-48 h-[2px] bg-emerald-500/20 rounded-full overflow-hidden">
                        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 bg-emerald-500 rounded-full"
                            style={{
                                animation: 'logo-expand-progress 2s ease-in-out infinite',
                            }} 
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
