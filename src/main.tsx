import 'regenerator-runtime/runtime';
// Polyfill Promise.allSettled for older ES-module-capable browsers (like Chrome 61-75)
if (typeof Promise.allSettled !== 'function') {
  Promise.allSettled = function (promises: any) {
    return Promise.all(
      Array.from(promises).map((p: any) =>
        Promise.resolve(p).then(
          value => ({ status: 'fulfilled', value }),
          reason => ({ status: 'rejected', reason })
        )
      )
    );
  } as any;
}
import './lib/offlineErrorHandler'; // DEBE SER PRIMERO - Suprimir errores de red offline
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/date-range-picker.css'
import { registerSW } from 'virtual:pwa-register';
import { initGlobalKeyboardAvoid } from './hooks/useKeyboardAvoid';
import { initGlobalAudio } from './utils/audio';

// Activar manejo de teclado virtual (oculta barras inferiores)
initGlobalKeyboardAvoid();

// Activar sonidos globales interactivos
initGlobalAudio();


// Register PWA Service Worker
const updateSW = registerSW({
    onNeedRefresh() {
        if (confirm('Nueva versión disponible. ¿Recargar?')) {
            updateSW(true);
        }
    },
    onOfflineReady() {
        console.log('App lista para trabajar offline');
    },
});

// Auto-reload si falla la carga de un chunk (ocurre cuando se sube una nueva versión y el cliente tiene la antigua en caché).
//
// OJO: un location.reload() simple NO alcanza cuando el causante es el propio
// Service Worker — con navigateFallback: '/index.html' (ver vite.config.ts),
// el SW puede seguir sirviendo el index.html VIEJO desde su propio caché en
// CADA recarga (nunca llega a pedirle uno nuevo a la red), y ese index.html
// viejo apunta a chunks con hash viejo que el deploy actual ya no tiene →
// mismo preloadError otra vez → bucle silencioso que se ve como "quedó
// pegado cargando". Por eso primero desregistramos el SW (fuerza que la
// siguiente carga vaya directo a la red) y solo reintentamos una vez por
// pestaña para no quedar dando vueltas si el problema fuera otro.
window.addEventListener('vite:preloadError', async () => {
    console.warn('Detectado error de carga de módulo (chunk obsoleto). Recargando para obtener la nueva versión...');

    if (sessionStorage.getItem('cobro_chunk_reload_retry')) {
        console.error('El recargado automático ya se intentó una vez y volvió a fallar — no reintento en bucle.');
        return;
    }
    sessionStorage.setItem('cobro_chunk_reload_retry', '1');

    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(r => r.unregister()));
        }
    } catch (e) {
        console.error('Error al desregistrar el Service Worker antes de recargar:', e);
    }

    window.location.reload();
});

// Una vez que la app carga bien, limpiar la bandera para que un fallo futuro
// (otro deploy más adelante) también pueda reintentar su propia vez.
window.addEventListener('load', () => {
    sessionStorage.removeItem('cobro_chunk_reload_retry');
});


import { ThemeProvider } from './components/ThemeProvider';
import { AppErrorBoundary } from './components/AppErrorBoundary';

createRoot(document.getElementById("root")!).render(
    <AppErrorBoundary>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <App />
        </ThemeProvider>
    </AppErrorBoundary>
);
