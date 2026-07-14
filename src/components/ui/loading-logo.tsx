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
    const logoSize = size === 'sm' ? 'h-8' : size === 'md' ? 'h-14' : 'h-20';
    const textSize = size === 'sm' ? 'text-xl' : size === 'md' ? 'text-3xl' : 'text-4xl';
    
    return (
        <div className={cn("flex flex-col items-center justify-center gap-4 w-full p-6", className)}>
            {/* Logo and Brand Name row */}
            <div className="flex items-center justify-center gap-3">
                <img 
                    src={cobroLogo} 
                    alt="Cobroapp Logo" 
                    className={cn("object-contain rounded-xl", logoSize)}
                    loading="eager"
                />
                <div className={cn("font-black tracking-tight select-none flex items-center", textSize)}>
                    <span className="text-white">Cobro</span>
                    <span className="text-emerald-500">app</span>
                </div>
            </div>

            {/* Bouncing dots loading indicator */}
            <div className="flex gap-1.5 items-center justify-center h-2 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"></span>
            </div>
        </div>
    );
};
