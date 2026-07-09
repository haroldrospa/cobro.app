import React from 'react';
import { cn } from '@/lib/utils';

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
        <div className={cn("flex flex-col items-center justify-center gap-5 w-full max-w-sm mx-auto p-6 relative", className)}>
            
            {/* Circular Spinner */}
            <div className="relative flex items-center justify-center">
                <div 
                    className={cn(
                        "animate-spin rounded-full border-solid",
                        size === 'sm' ? 'h-8 w-8 border-2' : size === 'md' ? 'h-12 w-12 border-[3px]' : 'h-16 w-16 border-4'
                    )} 
                    style={{ 
                        borderColor: 'rgba(16, 185, 129, 0.1)', 
                        borderTopColor: '#10b981' 
                    }}
                ></div>
            </div>

            {/* Brand Text: Cobroapp */}
            <div className="flex flex-col items-center gap-1.5 z-10 mt-1">
                <div className={cn(
                    "font-black tracking-tight flex items-center justify-center select-none",
                    size === 'sm' ? 'text-base' : size === 'md' ? 'text-xl' : 'text-2xl'
                )}>
                    <span className="text-white">Cobro</span>
                    <span className="text-emerald-500">app</span>
                </div>
                
                {/* Optional Status Subtext */}
                {text && (
                    <span className="text-[10px] text-zinc-500 font-medium tracking-widest uppercase animate-pulse mt-0.5">
                        {text.replace('...', '')}
                    </span>
                )}
            </div>
        </div>
    );
};
