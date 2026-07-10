import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cobro.app',
  appName: 'CobroApp',
  webDir: 'dist',
  server: {
    // Cargar la vista de ventas/catálogo del POS directamente.
    // Si no está autenticado, la web redirigirá a login y luego regresará aquí.
    url: 'https://cobroapp.app/pos',
    cleartext: false,
    androidScheme: 'https',
    // Permitir navegación dentro del dominio principal
    allowNavigation: [
      'cobroapp.app',
      '*.cobroapp.app',
      '*.supabase.co',
    ],
  },
  android: {
    // User agent personalizado para identificar la app nativa
    appendUserAgent: 'CobroApp-Android/2.0',
    // Habilitar acceso a archivos locales
    allowMixedContent: false,
    // WebView background (evita flash blanco)
    backgroundColor: '#0F0F1A',
    // Capturar Deep Links
    useLegacyBridge: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: '#0F0F1A',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    // Push Notifications (FCM)
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;