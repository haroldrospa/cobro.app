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

export async function getSessionSafe(): Promise<Session | null> {
  const now = Date.now();
  if (_lastSessionResult && (now - _lastSessionTs) < SESSION_CACHE_TTL) {
    return _lastSessionResult;
  }

  if (!_pendingSessionPromise) {
    _pendingSessionPromise = (async () => {
      const MAX_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.warn('[authSession] getSession error:', error.message);
            _lastSessionResult = null;
            _lastSessionTs = 0;
            return null;
          }
          if (data.session) {
            _lastSessionResult = data.session;
            _lastSessionTs = Date.now();
          } else {
            _lastSessionResult = null;
            _lastSessionTs = 0;
          }
          return data.session;
        } catch (e: any) {
          const isAbort = e?.name === 'AbortError' || e?.message?.includes('aborted');
          if (isAbort && attempt < MAX_RETRIES) {
            const delay = 300 * attempt;
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          if (!isAbort) {
            console.warn('[authSession] getSession falló definitivamente:', e?.message);
            _lastSessionResult = null;
            _lastSessionTs = 0;
          }
          break;
        }
      }
      return null;
    })().finally(() => {
      _pendingSessionPromise = null;
    });
  }

  return _pendingSessionPromise;
}

/**
 * Invalida el cache de sesión para forzar una nueva consulta en la próxima llamada.
 */
export function invalidateSessionCache(): void {
  _lastSessionResult = null;
  _lastSessionTs = 0;
}
