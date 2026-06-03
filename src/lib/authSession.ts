/**
 * authSession.ts
 * 
 * Singleton helper para manejar supabase.auth.getSession() de forma segura.
 * 
 * PROBLEMA: Múltiples llamadas concurrentes a getSession() al cargar la app
 * pueden generar AbortErrors internos en el cliente de Supabase, dejando la
 * sesión sin establecer y todas las queries de BD deshabilitadas.
 *
 * SOLUCIÓN: Deduplicamos las llamadas (una sola petición en vuelo) y reintentamos
 * automáticamente ante AbortErrors transitorios.
 */

import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

let _pendingSessionPromise: Promise<Session | null> | null = null;
let _lastSessionResult: Session | null = null;
let _lastSessionTs = 0;
const SESSION_CACHE_TTL = 1000 * 60 * 5; // 5 minutos

/**
 * Obtiene la sesión de Supabase de forma segura:
 * - Deduplica llamadas concurrentes (sólo una petición en vuelo)
 * - Reintenta automáticamente ante AbortError (máx. 3 intentos)
 * - Cachea el resultado 5 minutos para evitar llamadas innecesarias
 */
export async function getSessionSafe(): Promise<Session | null> {
  // Usar cache si está fresco
  const now = Date.now();
  if (_lastSessionResult && (now - _lastSessionTs) < SESSION_CACHE_TTL) {
    return _lastSessionResult;
  }

  // Si ya hay una petición en vuelo, esperarla en lugar de lanzar otra
  if (_pendingSessionPromise) {
    try {
      return await _pendingSessionPromise;
    } catch {
      // Si la petición en vuelo falló, intentar de nuevo abajo
    }
  }

  _pendingSessionPromise = (async () => {
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[authSession] getSession error:', error.message);
          break;
        }
        _lastSessionResult = data.session;
        _lastSessionTs = Date.now();
        return data.session;
      } catch (e: any) {
        const isAbort = e?.name === 'AbortError' || e?.message?.includes('aborted');
        if (isAbort && attempt < MAX_RETRIES) {
          const delay = 300 * attempt;
          console.warn(`[authSession] AbortError en intento ${attempt}/${MAX_RETRIES}. Reintentando en ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        // No es AbortError, o se agotaron los intentos
        console.warn('[authSession] getSession falló definitivamente:', e?.message);
        break;
      }
    }
    // Si todo falla, intentar con refreshSession una última vez
    try {
      const { data } = await supabase.auth.refreshSession();
      if (data?.session) {
        _lastSessionResult = data.session;
        _lastSessionTs = Date.now();
        return data.session;
      }
    } catch { /* ignore */ }

    return _lastSessionResult; // retornar último resultado cacheado si existe
  })().finally(() => {
    _pendingSessionPromise = null;
  });

  return _pendingSessionPromise;
}

/**
 * Invalida el cache de sesión para forzar una nueva consulta en la próxima llamada.
 */
export function invalidateSessionCache(): void {
  _lastSessionResult = null;
  _lastSessionTs = 0;
}
