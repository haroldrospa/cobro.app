import * as React from "react"

const MOBILE_BREAKPOINT = 1100

export function useIsMobile() {
  // Inicializador perezoso: mide el ancho real YA en el primer render, en
  // vez de arrancar en undefined (=> false => "escritorio") y recién
  // corregir dentro de un useEffect un instante después. Ese primer render
  // erróneo era justo lo que causaba el fogonazo al entrar al POS: se
  // montaba la versión de escritorio completa (buscador que se
  // auto-enfoca y abre el teclado, resumen de pago al costado) antes de
  // "corregirse" sola al layout mobile correcto. Esta app es un SPA
  // renderizado 100% en cliente (sin SSR), así que window siempre está
  // disponible desde el primer render — no hace falta diferir esta lectura.
  const [isMobile, setIsMobile] = React.useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}

function checkIsLandscape(): boolean {
  if (typeof window === "undefined") return false;

  const isTouch = typeof navigator !== "undefined" && (
    navigator.maxTouchPoints > 0 ||
    (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches)
  );

  // En dispositivos táctiles (móviles y tablets), usar SIEMPRE la orientación física del dispositivo.
  // Esto previene que la apertura del teclado virtual (que reduce innerHeight en un 50%)
  // haga creer a la app erróneamente que la tablet giró a horizontal.
  if (isTouch) {
    if (window.screen?.orientation?.type) {
      return window.screen.orientation.type.startsWith("landscape");
    }
    if (typeof (window as any).orientation === "number") {
      return Math.abs((window as any).orientation) === 90;
    }
    if (window.screen?.width && window.screen?.height) {
      return window.screen.width > window.screen.height;
    }
  }

  // En PC / navegadores de escritorio sin pantalla táctil: basarse en la proporción de la ventana
  return window.innerWidth > window.innerHeight;
}

export function useIsLandscape() {
  const [isLandscape, setIsLandscape] = React.useState<boolean>(() => checkIsLandscape());

  React.useEffect(() => {
    const update = () => {
      setIsLandscape(checkIsLandscape());
    };

    // Escuchar cambio físico de orientación de pantalla
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener("change", update);
    }
    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);

    return () => {
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener("change", update);
      }
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return isLandscape;
}

export function useIsMobilePortrait() {
  const isMobile = useIsMobile();
  const isLandscape = useIsLandscape();
  return isMobile && !isLandscape;
}

