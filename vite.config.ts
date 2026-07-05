import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';
import legacy from '@vitejs/plugin-legacy';
import viteCompression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api-alanube-sandbox': {
        target: 'https://sandbox.alanube.co',
        changeOrigin: true,
        headers: {
          'Origin': 'https://sandbox.alanube.co',
          'Referer': 'https://sandbox.alanube.co'
        },
        rewrite: (path) => path.replace(/^\/api-alanube-sandbox/, '')
      },
      '/api-alanube-prod': {
        target: 'https://api.alanube.co',
        changeOrigin: true,
        headers: {
          'Origin': 'https://api.alanube.co',
          'Referer': 'https://api.alanube.co'
        },
        rewrite: (path) => path.replace(/^\/api-alanube-prod/, '')
      }
    }
  },
  plugins: [
    react(),
    legacy({
      targets: ["defaults", "not IE 11", "chrome >= 49", "firefox >= 45", "safari >= 10", "edge >= 15"],
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
    }),
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
    }),
    mode === 'development' && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'placeholder.svg', 'icon-192.png', 'icon-512.png', 'cobro-logo.png', 'offline.html'],
      manifest: {
        name: 'Cobro POS',
        short_name: 'Cobro POS',
        description: 'Sistema completo de facturación y punto de venta para República Dominicana',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          // ✅ Cache Supabase REST API calls — instant repeat loads
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest-cache',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 15 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ✅ Cache product & store images aggressively
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  build: {
    sourcemap: false,          // ✅ No source maps in prod = ~35% smaller bundle
    target: ['es2015', 'chrome58', 'firefox57', 'safari11', 'edge16'],          // ✅ Modern browsers only = smaller, faster output
    cssCodeSplit: true,        // ✅ Only load CSS for current route
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-core': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'react-query': ['@tanstack/react-query'],
          'recharts': ['recharts'],            // heavy – dashboard only
          'framer-motion': ['framer-motion'],  // heavy – load on demand
          'radix-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-slot',
            '@radix-ui/react-toast',
            '@radix-ui/react-tabs',
            '@radix-ui/react-select',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-switch',
            '@radix-ui/react-tooltip',
          ],
          'date-fns': ['date-fns'],            // ✅ separate – only needed where dates shown
          'icons': ['lucide-react'],           // ✅ separate – large icon set
          'utils': ['clsx', 'tailwind-merge'],
        }
      }
    },
    minify: 'esbuild',         // ✅ Fastest minifier
  },
  esbuild: {
    // ✅ Strip all console.log and debugger calls in production
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
