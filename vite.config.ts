import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';
import legacy from '@vitejs/plugin-legacy';
import viteCompression from 'vite-plugin-compression';

function directThermalPrinterPlugin() {
  return {
    name: 'direct-thermal-printer-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/print-raw-tspl', (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end();
        }
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const { spawn } = await import('child_process');
            const fs = await import('fs');
            const path = await import('path');
            const os = await import('os');

            const tmpFile = path.join(os.tmpdir(), `label_${Date.now()}_${Math.random().toString(36).substring(7)}.tspl`);
            fs.writeFileSync(tmpFile, data.tspl, 'ascii');

            const scriptPath = path.resolve('scripts/printer/send-raw.ps1');
            const ps = spawn('powershell', [
              '-ExecutionPolicy', 'Bypass',
              '-File', scriptPath,
              '-File', tmpFile,
              '-Printer', data.printer || '4BARCODE 4B-2074B'
            ]);

            ps.on('close', (code: number) => {
              try { fs.unlinkSync(tmpFile); } catch (e) {}
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: code === 0 }));
            });
            ps.on('error', (err: any) => {
              try { fs.unlinkSync(tmpFile); } catch (e) {}
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message }));
            });
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      });
    }
  };
}

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
    directThermalPrinterPlugin(),
    react(),
    legacy({
      targets: ['defaults', 'not IE 11', 'chrome >= 49', 'android >= 7', 'safari >= 10'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
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
      includeAssets: ['favicon.ico', 'placeholder.svg', 'icon-192.png', 'icon-512.png', 'cobro-logo.png', 'logo-dark.png', 'offline.html'],
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
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
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
