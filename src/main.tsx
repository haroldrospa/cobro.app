import 'regenerator-runtime/runtime';
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

// Auto-reload si falla la carga de un chunk (ocurre cuando se sube una nueva versión y el cliente tiene la antigua en caché)
window.addEventListener('vite:preloadError', () => {
    console.warn('Detectado error de carga de módulo (chunk obsoleto). Recargando para obtener la nueva versión...');
    window.location.reload();
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
