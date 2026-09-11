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

  if (window.visualViewport) {
    let initialHeight = window.visualViewport.height;

    const onResize = () => {
      if (!window.visualViewport) return;
      const currentHeight = window.visualViewport.height;
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      if (!isInputFocused && currentHeight > initialHeight) {
        initialHeight = currentHeight;
      }

      const isKeyboardOpen = isInputFocused && (initialHeight - currentHeight > 150);

      if (isKeyboardOpen) {
        if (!document.body.classList.contains('keyboard-open')) {
          document.body.classList.add('keyboard-open');
        }
      } else {
        if (document.body.classList.contains('keyboard-open')) {
          document.body.classList.remove('keyboard-open');
        }
      }
    };

    window.visualViewport.addEventListener('resize', onResize);

    const handleFocusOut = () => {
      setTimeout(() => {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';
        if (!isInput) {
          document.body.classList.remove('keyboard-open');
        }
      }, 100);
    };

    document.addEventListener('focusout', handleFocusOut, { passive: true });

    return () => {
      window.visualViewport?.removeEventListener('resize', onResize);
      document.removeEventListener('focusout', handleFocusOut);
      document.body.classList.remove('keyboard-open');
    };
  }
}
