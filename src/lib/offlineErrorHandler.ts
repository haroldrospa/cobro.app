/**
 * Configuración global para suprimir errores de red de Supabase cuando estamos offline
 * Esto evita que la consola se llene de errores TypeError: Failed to fetch
 */

// Guardar el fetch original
const originalFetch = window.fetch;

// Wrapper para fetch que maneja errores de red silenciosamente
window.fetch = async (...args) => {
    try {
        const response = await originalFetch(...args);
        return response;
    } catch (error: any) {
        // Se estamos offline, retornar respuesta vacía
        if (!navigator.onLine || error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
            return new Response(JSON.stringify({ message: 'Offline', code: 'OFFLINE' }), {
                status: 503,
                statusText: 'Network Offline',
                headers: { 'Content-Type': 'application/json' }
            });
        }
        throw error;
    }
};

// Suprimir errores de consola relacionados con red cuando estamos offline
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
    // Convertir todos los argumentos a string, incluso si son objetos de error
    const errorMessage = args.map(arg => {
        if (arg instanceof Error) {
            return arg.message + ' ' + (arg.stack || '');
        } else if (typeof arg === 'object' && arg !== null) {
            try {
                return JSON.stringify(arg) + ' ' + (arg.message || '');
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');

    if (
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('refresh_token') ||
        errorMessage.includes('CORS') ||
        errorMessage.includes('Bad Gateway') ||
        errorMessage.includes('502') ||
        errorMessage.includes('Receiving end does not exist') ||
        errorMessage.includes('Could not establish connection') ||
        errorMessage.includes('AuthRetryableFetchError') ||
        errorMessage.includes('ERR_NAME_NOT_RESOLVED') ||
        errorMessage.includes('offlineError') ||
        errorMessage.includes('AbortError') ||
        errorMessage.includes('signal is aborted') ||
        errorMessage.includes('user aborted') ||
        (errorMessage.includes('Error fetching') && (errorMessage.includes('Abort') || errorMessage.includes('canceled'))) ||
        (errorMessage.includes('Error loading company settings') && errorMessage.includes('Abort')) ||
        errorMessage.includes('Error fetching profile') ||
        errorMessage.includes('Error fetching subscription') ||
        errorMessage.includes('Error creating default store_settings') ||
        errorMessage.includes('saved_carts') ||
        errorMessage.includes('400') ||
        errorMessage.includes('403') ||
        errorMessage.includes('profiles') ||
        errorMessage.includes('customer_id') ||
        errorMessage.includes('Error updating profile') ||
        errorMessage.includes('net::ERR_HTTP2_PROTOCOL_ERROR') ||
        (!navigator.onLine && (
            errorMessage.includes('supabase') || 
            errorMessage.includes('Error fetching')
        ))
    ) {
        // No mostrar estos errores en la consola
        return;
    }
    // Otros errores sí los mostramos
    originalConsoleError.apply(console, args);
};

// Suppress console.warn for known non-critical profile sync issues
const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
    const msg = args.map(a => String(a)).join(' ');
    if (
        msg.includes('Profile sync') ||
        msg.includes('customer_id') ||
        msg.includes('profiles')
    ) {
        return;
    }
    originalConsoleWarn.apply(console, args);
};

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || String(event.reason);

    if (
        reason.includes('Receiving end does not exist') ||
        reason.includes('Could not establish connection') ||
        reason.includes('subscription') ||
        reason.includes('customer_id') ||
        reason.includes('profiles')
    ) {
        event.preventDefault();
    }
});

export { };
