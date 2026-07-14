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
    return (
        <div className={cn("flex flex-col items-center justify-center gap-4 w-full max-w-sm mx-auto p-6 relative", className)}>
            
            {/* Logo & Brand Name Container */}
            <div className="flex flex-col items-center gap-3">
                <div className="flex items-center justify-center gap-3">
                    <img 
                        src={cobroLogo} 
                        alt="Cobroapp Logo" 
                        className={cn(
                            "object-contain rounded-xl shadow-md",
                            size === 'sm' ? 'h-8 w-8' : size === 'md' ? 'h-14 w-14' : 'h-20 w-20'
                        )}
                    />
                    <div className={cn(
                        "font-black tracking-tight select-none flex items-center",
                        size === 'sm' ? 'text-lg' : size === 'md' ? 'text-3xl' : 'text-4xl'
                    )}>
                        <span className="text-white">Cobro</span>
                        <span className="text-emerald-500">app</span>
                    </div>
                </div>
                
                {/* Brand Tagline */}
                <p className={cn(
                    "text-zinc-400 font-medium text-center",
                    size === 'sm' ? 'text-[9px]' : size === 'md' ? 'text-[11px]' : 'text-xs'
                )}>
                    Tu negocio en control, en cualquier lugar
                </p>
            </div>

            {/* Subtle Loading Indicator (elegant emerald bar or pulse) */}
            <div className="mt-2 flex flex-col items-center gap-2">
                <div className="flex gap-1 items-center justify-center h-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"></span>
                </div>

                {/* Optional Status Subtext */}
                {text && (
                    <span className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase animate-pulse">
                        {text}
                    </span>
                )}
            </div>
        </div>
    );
};
