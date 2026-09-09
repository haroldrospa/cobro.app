import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

interface POSResizableSplitterProps {
  onResize: (width: number) => void;
  onReset?: () => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  className?: string;
}

export const POSResizableSplitter: React.FC<POSResizableSplitterProps> = ({
  onResize,
  onReset,
  isDragging,
  setIsDragging,
  className,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const splitterRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch (err) {
      // ignore
    }
    setIsDragging(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const clientX = moveEvent.clientX;
      const windowWidth = window.innerWidth;
      
      // El panel derecho se mide desde el borde derecho
      const newWidth = Math.round(windowWidth - clientX);
      onResize(newWidth);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      try {
        (e.target as HTMLElement).releasePointerCapture?.(upEvent.pointerId);
      } catch (err) {
        // ignore
      }
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [onResize, setIsDragging]);

  return (
    <div
      ref={splitterRef}
      role="separator"
      aria-orientation="vertical"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onDoubleClick={onReset}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title="Arrastra para ajustar el tamaño de los paneles (Doble clic para restablecer)"
      className={cn(
        "relative flex items-center justify-center flex-shrink-0 select-none cursor-col-resize touch-none",
        "w-3 -mx-1 z-30 group transition-colors duration-150",
        // Zona táctil expandida para agarrar fácilmente con el dedo en pantallas táctiles
        "before:absolute before:inset-y-0 before:-left-2 before:-right-2 before:z-10",
        className
      )}
    >
      {/* Línea divisoria visual */}
      <div
        className={cn(
          "w-1 h-full rounded-full transition-all duration-200 pointer-events-none",
          isDragging
            ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] w-1.5"
            : isHovered
            ? "bg-emerald-500/60 shadow-[0_0_4px_rgba(16,185,129,0.4)]"
            : "bg-border/60 group-hover:bg-emerald-500/40"
        )}
      />

      {/* Botón / Pastilla con el icono de resize "⇹" centrado verticalmente */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-20",
          "flex items-center justify-center",
          "w-5 h-8 rounded-full border shadow-md transition-all duration-150",
          isDragging
            ? "bg-emerald-600 border-emerald-400 text-white scale-110 shadow-lg shadow-emerald-500/30"
            : isHovered
            ? "bg-card border-emerald-500/40 text-emerald-500 scale-105"
            : "bg-card/95 border-border/80 text-muted-foreground hover:text-foreground"
        )}
      >
        <svg
          className="w-3.5 h-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Flecha izquierda */}
          <path d="m8 8-4 4 4 4" />
          {/* Barra vertical central */}
          <path d="M12 5v14" />
          {/* Flecha derecha */}
          <path d="m16 8 4 4-4 4" />
        </svg>
      </div>
    </div>
  );
};

export default POSResizableSplitter;
