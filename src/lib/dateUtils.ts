import { format as dateFnsFormat, formatDistanceToNow as dateFnsFormatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Parsea cualquier entrada a un objeto Date válido.
 * Si es null, undefined, cadena vacía, "undefined", "null" o una fecha inválida, retorna null.
 */
export function parseSafeDate(input: any): Date | null {
  if (input === null || input === undefined || input === '' || input === 'undefined' || input === 'null') {
    return null;
  }
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  try {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Formatea una fecha de forma segura con date-fns.
 * NUNCA lanza "Invalid time value" (RangeError).
 */
export function formatSafe(
  date: any,
  formatStr: string = 'dd/MM/yyyy',
  options?: { locale?: any; fallback?: string }
): string {
  const d = parseSafeDate(date);
  if (!d) return options?.fallback ?? '';
  try {
    return dateFnsFormat(d, formatStr, { locale: options?.locale || es });
  } catch (err) {
    console.warn('[dateUtils] formatSafe error:', err);
    return options?.fallback ?? '';
  }
}

/**
 * Formatea una fecha relativa (ej: "hace 5 minutos") de forma segura.
 * NUNCA lanza "Invalid time value".
 */
export function formatDistanceToNowSafe(
  date: any,
  options?: { addSuffix?: boolean; locale?: any; fallback?: string }
): string {
  const d = parseSafeDate(date);
  if (!d) return options?.fallback ?? 'hace un momento';
  try {
    return dateFnsFormatDistanceToNow(d, {
      addSuffix: options?.addSuffix ?? true,
      locale: options?.locale ?? es,
    });
  } catch (err) {
    console.warn('[dateUtils] formatDistanceToNowSafe error:', err);
    return options?.fallback ?? 'hace un momento';
  }
}

/**
 * toLocaleDateString seguro sin riesgo de RangeError.
 */
export function formatDateLocaleSafe(
  date: any,
  locale: string = 'es-DO',
  options?: Intl.DateTimeFormatOptions,
  fallback: string = ''
): string {
  const d = parseSafeDate(date);
  if (!d) return fallback;
  try {
    return d.toLocaleDateString(locale, options);
  } catch {
    return fallback;
  }
}

/**
 * toLocaleTimeString seguro sin riesgo de RangeError.
 */
export function formatTimeLocaleSafe(
  date: any,
  locale: string = 'es-DO',
  options?: Intl.DateTimeFormatOptions,
  fallback: string = ''
): string {
  const d = parseSafeDate(date);
  if (!d) return fallback;
  try {
    return d.toLocaleTimeString(locale, options);
  } catch {
    return fallback;
  }
}

/**
 * toLocaleString seguro sin riesgo de RangeError.
 */
export function formatDateTimeLocaleSafe(
  date: any,
  locale: string = 'es-DO',
  options?: Intl.DateTimeFormatOptions,
  fallback: string = ''
): string {
  const d = parseSafeDate(date);
  if (!d) return fallback;
  try {
    return d.toLocaleString(locale, options);
  } catch {
    return fallback;
  }
}
