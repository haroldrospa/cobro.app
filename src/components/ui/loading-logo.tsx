import React from 'react';
import logo from '@/assets/cobro-logo.png';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

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
    // Definimos el tamaño del logo interno según la prop "size"
    const sizeClasses = {
        sm: 'w-10 h-10',
        md: 'w-14 h-14',
        lg: 'w-20 h-20',
    };
    
    // Definimos el tamaño del SVG (anillo) y grosor de la línea
    const circleSizes = {
        sm: { size: 100, stroke: 4 },
        md: { size: 130, stroke: 5 },
        lg: { size: 170, stroke: 6 },
    };

    const { size: svgSize, stroke } = circleSizes[size];
    const center = svgSize / 2;
    const radius = center - stroke;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className={cn("flex flex-col items-center justify-center gap-10 w-full max-w-sm mx-auto p-8 relative", className)}>
            
            {/* Animación del círculo llenándose (Estilo CobroApp) */}
            <div className="relative flex items-center justify-center mt-2" style={{ width: svgSize, height: svgSize }}>
                
                {/* SVG Animado (Giro 360 constante) */}
                <motion.svg
                    width={svgSize}
                    height={svgSize}
                    viewBox={`0 0 ${svgSize} ${svgSize}`}
                    className="absolute inset-0 -rotate-90 drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]"
                    animate={{ rotate: 270 }} // De -90 a 270 es 360 grados
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                    {/* Anillo de fondo (Track) */}
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="transparent"
                        stroke="rgba(16,185,129,0.1)"
                        strokeWidth={stroke}
                    />
                    
                    {/* Anillo llenándose (Progress que crece y se encoge) */}
                    <motion.circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="transparent"
                        stroke="url(#emeraldGradient)"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={`${circumference} ${circumference}`}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ 
                            strokeDashoffset: [circumference, circumference * 0.1, circumference]
                        }}
                        transition={{ 
                            duration: 2, 
                            repeat: Infinity, 
                            ease: "easeInOut"
                        }}
                    />
                    
                    <defs>
                        <linearGradient id="emeraldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#6ee7b7" />   {/* emerald-300 */}
                            <stop offset="50%" stopColor="#10b981" />  {/* emerald-500 */}
                            <stop offset="100%" stopColor="#047857" /> {/* emerald-700 */}
                        </linearGradient>
                    </defs>
                </motion.svg>

                {/* Resplandor del núcleo (detrás del logo) */}
                <motion.div 
                    className="absolute bg-emerald-500/20 rounded-full blur-[20px]"
                    style={{ width: '85%', height: '85%' }}
                    animate={{
                        scale: [0.8, 1.1, 0.8],
                        opacity: [0.4, 0.8, 0.4]
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
                
                {/* Logo en el centro pulsando sutilmente */}
                <motion.div 
                    className="relative z-10 flex items-center justify-center rounded-full bg-slate-900/60 backdrop-blur-sm p-4 border border-emerald-500/10 shadow-inner"
                    animate={{ scale: [0.95, 1.05, 0.95] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                    <img
                        src={logo}
                        alt="Cobro Logo"
                        className={cn(sizeClasses[size], "object-contain drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]")}
                    />
                </motion.div>
            </div>

            {/* Texto */}
            {text && (
                <div className="flex flex-col items-center gap-3 w-full z-10 mt-2">
                    <motion.h2 
                        className="text-[14px] font-black uppercase tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-white to-emerald-300 text-center"
                        style={{ backgroundSize: '200% auto' }}
                        animate={{ backgroundPosition: ['0% center', '200% center'] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    >
                        {text.replace('...', '')}
                    </motion.h2>
                    
                    <div className="flex gap-2 items-center">
                        <span className="text-[9px] text-emerald-500/70 uppercase tracking-[0.4em] font-bold">
                            Por favor espera
                        </span>
                        <span className="flex gap-1.5">
                            {[0, 1, 2].map(i => (
                                <motion.span 
                                    key={i}
                                    className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,1)]"
                                    animate={{ y: [0, -3, 0], opacity: [0.3, 1, 0.3] }}
                                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                                />
                            ))}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
