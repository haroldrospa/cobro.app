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
 * Aplica una clase global `keyboard-open` al body cuando se detecta que el teclado virtual
 * está abierto, para ocultar barras inferiores y maximizar el espacio de búsqueda.
 */
export function initGlobalKeyboardAvoid() {
  if (typeof window === 'undefined') return;

  // Solo activar en dispositivos táctiles
  const isTouchDevice =
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches;

  if (!isTouchDevice) return;

  let keyboardOpen = false;

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

    // Add class on focus initially
    document.body.classList.add('keyboard-open');
    keyboardOpen = true;
    
    // Verify with visualViewport if supported
    if (window.visualViewport) {
      const initialHeight = window.visualViewport.height;

      const onViewportResize = () => {
        if (!window.visualViewport) return;
        const newHeight = window.visualViewport.height;
        // Si el viewport se redujo más de 150px, es el teclado
        if (initialHeight - newHeight > 150) {
          document.body.classList.add('keyboard-open');
          keyboardOpen = true;
        } else if (newHeight >= initialHeight - 50) {
          // Teclado cerrado
          document.body.classList.remove('keyboard-open');
          keyboardOpen = false;
        }
      };

      window.visualViewport.addEventListener('resize', onViewportResize);

      // Limpiar al perder el foco
      const handleBlur = () => {
        setTimeout(() => {
          if (!document.activeElement || !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            document.body.classList.remove('keyboard-open');
            keyboardOpen = false;
          }
        }, 100);
        target.removeEventListener('blur', handleBlur);
        window.visualViewport?.removeEventListener('resize', onViewportResize);
      };
      
      target.addEventListener('blur', handleBlur, { once: true });
    } else {
      // Fallback si no hay visualViewport
      const handleBlur = () => {
        setTimeout(() => {
          if (!document.activeElement || !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            document.body.classList.remove('keyboard-open');
          }
        }, 100);
      };
      target.addEventListener('blur', handleBlur, { once: true });
    }
  };

  document.addEventListener('focusin', handleFocus, { passive: true });

  return () => {
    document.removeEventListener('focusin', handleFocus);
    document.body.classList.remove('keyboard-open');
  };
}
