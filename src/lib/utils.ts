import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInCalendarDays } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Días de calendario entre hoy y la fecha dada — a propósito NO usamos
// differenceInDays (cuenta periodos de 24h exactas). Como end_date no trae
// hora, esa cuenta depende de a qué hora del día se mire la pantalla y
// queda 1 día por debajo del conteo de calendario casi siempre (ej. hoy
// 30/ago y vence 4/sep son 5 días para cualquier persona contando en un
// calendario, sin importar la hora — differenceInDays podía dar 4 o 5
// según la hora exacta). differenceInCalendarDays compara solo la fecha,
// no la hora, así que el resultado es estable durante todo el día y
// coincide con lo que cuenta un humano mirando el calendario.
export function getDaysRemaining(dateString: string | null | undefined): number {
  if (!dateString) return 0;
  const days = differenceInCalendarDays(new Date(dateString), new Date());
  return days > 0 ? days : 0;
}
