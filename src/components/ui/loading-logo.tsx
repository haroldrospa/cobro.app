import React from 'react';
import { cn } from '@/lib/utils';
import cobroLogo from '@/assets/cobro-logo-dark.png';

interface LoadingLogoProps {
    text?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const LoadingLogo: React.FC<LoadingLogoProps> = ({
    text,
    size = 'md',
    className = ''
}) => {
    const ringSize = size === 'sm' ? 'w-16 h-16' : size === 'md' ? 'w-24 h-24' : 'w-32 h-32';
    const logoSize = size === 'sm' ? 'h-9' : size === 'md' ? 'h-14' : 'h-18';
    
    return (
        <div className={cn("flex flex-col items-center justify-center gap-6 w-full max-w-sm mx-auto p-6 relative", className)}>
            
            {/* Glowing Rotating Rings with Logo */}
            <div className={cn("relative flex items-center justify-center", ringSize)}>
                {/* Outer rotating dashed ring */}
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-500/30 animate-[spin_15s_linear_infinite]" />
                {/* Inner rotating dashed ring (reverse direction) */}
                <div className="absolute inset-2 rounded-full border border-dashed border-emerald-500/20 animate-[spin_20s_linear_infinite_reverse]" />
                {/* Ambient backdrop glow */}
                <div className="absolute inset-0 rounded-full bg-emerald-500/[0.04] blur-md" />
                
                {/* Logo Image */}
                <img 
                    src={cobroLogo} 
                    alt="Cobroapp" 
                    className={cn("relative object-contain rounded-xl z-10 shadow-lg transition-transform duration-300", logoSize)}
                    loading="eager"
                />
            </div>

            {/* Brand Text & Tagline */}
            <div className="flex flex-col items-center gap-1.5 z-10 text-center">
                <div className={cn(
                    "font-black tracking-tight select-none flex items-center justify-center",
                    size === 'sm' ? 'text-lg' : size === 'md' ? 'text-2xl' : 'text-3xl'
                )}>
                    <span className="text-white">Cobro</span>
                    <span className="text-emerald-500">app</span>
                </div>
                
                <p className={cn(
                    "text-zinc-400 font-medium tracking-wide",
                    size === 'sm' ? 'text-[9px]' : size === 'md' ? 'text-[11px]' : 'text-xs'
                )}>
                    Tu negocio en control, en cualquier lugar
                </p>
            </div>

            {/* Bouncing Dots and Status Text */}
            <div className="flex flex-col items-center gap-2.5 mt-2">
                <div className="flex gap-1.5 items-center justify-center h-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"></span>
                </div>

                {text && (
                    <span className="text-[9px] text-zinc-500 font-black tracking-[0.2em] uppercase animate-pulse">
                        {text}
                    </span>
                )}
            </div>
        </div>
    );
};
