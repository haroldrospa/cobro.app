/**
 * useKeyboardAvoid.ts
 *
 * Detecta cuando el teclado virtual aparece en móvil y hace scroll
 * para que el input enfocado quede visible por encima del teclado.
 *
 * Funciona usando la VisualViewport API (soportada en iOS 13+ y Android 5+).
 */
import { useEffect, useRef, useCallback } from 'react';

/**
 * Retorna una función `onFocus` que, al ser llamada, hace scroll
 * para que el elemento enfocado quede visible cuando el teclado aparece.
 *
 * Uso:
 *   const { onFocusScroll } = useKeyboardAvoid();
 *   <input onFocus={onFocusScroll} />
 */
export function useKeyboardAvoid() {
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onFocusScroll = useCallback((e: React.FocusEvent<HTMLElement>) => {
    const target = e.currentTarget;

    // Pequeño delay para que el teclado tenga tiempo de abrirse
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  return { onFocusScroll };
}

/**
 * Aplica el comportamiento de scroll-into-view a TODOS los inputs
 * y textareas del documento de forma global.
 *
 * Llamar UNA sola vez desde App.tsx o main.tsx.
 */
export function initGlobalKeyboardAvoid() {
  if (typeof window === 'undefined') return;

  // Solo activar en dispositivos táctiles
  const isTouchDevice =
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches;

  if (!isTouchDevice) return;

  const handleFocus = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    const tag = target.tagName.toLowerCase();
    const isInput =
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      target.isContentEditable;

    if (!isInput) return;

    // Si la VisualViewport API está disponible, usarla para detectar teclado
    const scrollIntoViewSafe = () => {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    };

    if (window.visualViewport) {
      // Esperamos a que el viewport se reduzca (teclado aparece)
      const initialHeight = window.visualViewport.height;

      const onViewportResize = () => {
        if (!window.visualViewport) return;
        const newHeight = window.visualViewport.height;
        // Si el viewport se redujo más de 150px, es el teclado
        if (initialHeight - newHeight > 150) {
          scrollIntoViewSafe();
          window.visualViewport?.removeEventListener('resize', onViewportResize);
        }
      };

      window.visualViewport.addEventListener('resize', onViewportResize);

      // Cleanup si el teclado no aparece en 1s
      setTimeout(() => {
        window.visualViewport?.removeEventListener('resize', onViewportResize);
      }, 1000);
    } else {
      // Fallback: scroll directo con delay
      setTimeout(scrollIntoViewSafe, 350);
    }
  };

  document.addEventListener('focusin', handleFocus, { passive: true });

  // Cleanup function (para llamar si se necesita)
  return () => {
    document.removeEventListener('focusin', handleFocus);
  };
}
