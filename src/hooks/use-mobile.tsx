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
