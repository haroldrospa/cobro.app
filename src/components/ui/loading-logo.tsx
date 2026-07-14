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

            {/* Sleek animated loading bar */}
            <div className="w-32 h-1 bg-emerald-950/40 rounded-full overflow-hidden relative mt-2">
                <style>{`
                    @keyframes loading-slide {
                        0% { left: -50%; width: 30%; }
                        50% { left: 30%; width: 40%; }
                        100% { left: 100%; width: 30%; }
                    }
                `}</style>
                <div 
                    className="absolute top-0 bottom-0 bg-emerald-500 rounded-full" 
                    style={{ animation: 'loading-slide 1.5s infinite ease-in-out' }}
                ></div>
            </div>
        </div>
    );
};
