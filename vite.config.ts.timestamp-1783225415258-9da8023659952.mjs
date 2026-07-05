// vite.config.ts
import { defineConfig } from "file:///C:/Users/Harold/Documents/Proyectos/Cobro%20App/Cobro%20App/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Harold/Documents/Proyectos/Cobro%20App/Cobro%20App/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///C:/Users/Harold/Documents/Proyectos/Cobro%20App/Cobro%20App/node_modules/lovable-tagger/dist/index.js";
import { VitePWA } from "file:///C:/Users/Harold/Documents/Proyectos/Cobro%20App/Cobro%20App/node_modules/vite-plugin-pwa/dist/index.js";
import legacy from "file:///C:/Users/Harold/Documents/Proyectos/Cobro%20App/Cobro%20App/node_modules/@vitejs/plugin-legacy/dist/index.mjs";
import viteCompression from "file:///C:/Users/Harold/Documents/Proyectos/Cobro%20App/Cobro%20App/node_modules/vite-plugin-compression/dist/index.mjs";
var __vite_injected_original_dirname = "C:\\Users\\Harold\\Documents\\Proyectos\\Cobro App\\Cobro App";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api-alanube-sandbox": {
        target: "https://sandbox.alanube.co",
        changeOrigin: true,
        headers: {
          "Origin": "https://sandbox.alanube.co",
          "Referer": "https://sandbox.alanube.co"
        },
        rewrite: (path2) => path2.replace(/^\/api-alanube-sandbox/, "")
      },
      "/api-alanube-prod": {
        target: "https://api.alanube.co",
        changeOrigin: true,
        headers: {
          "Origin": "https://api.alanube.co",
          "Referer": "https://api.alanube.co"
        },
        rewrite: (path2) => path2.replace(/^\/api-alanube-prod/, "")
      }
    }
  },
  plugins: [
    react(),
    legacy({
      targets: ["defaults", "not IE 11", "chrome >= 49", "firefox >= 45", "safari >= 10", "edge >= 15"]
    }),
    viteCompression({
      algorithm: "brotliCompress",
      ext: ".br",
      threshold: 1024
    }),
    viteCompression({
      algorithm: "gzip",
      ext: ".gz",
      threshold: 1024
    }),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "placeholder.svg", "icon-192.png", "icon-512.png", "cobro-logo.png", "offline.html"],
      manifest: {
        name: "Cobro POS",
        short_name: "Cobro POS",
        description: "Sistema completo de facturaci\xF3n y punto de venta para Rep\xFAblica Dominicana",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          // ✅ Cache Supabase REST API calls — instant repeat loads
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-rest-cache",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 15 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ✅ Cache product & store images aggressively
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  build: {
    sourcemap: false,
    // ✅ No source maps in prod = ~35% smaller bundle
    target: ["es2015", "chrome58", "firefox57", "safari11", "edge16"],
    // ✅ Modern browsers only = smaller, faster output
    cssCodeSplit: true,
    // ✅ Only load CSS for current route
    chunkSizeWarningLimit: 1e3,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-core": ["react", "react-dom"],
          "router": ["react-router-dom"],
          "supabase": ["@supabase/supabase-js"],
          "react-query": ["@tanstack/react-query"],
          "recharts": ["recharts"],
          // heavy – dashboard only
          "framer-motion": ["framer-motion"],
          // heavy – load on demand
          "radix-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-slot",
            "@radix-ui/react-toast",
            "@radix-ui/react-tabs",
            "@radix-ui/react-select",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-label",
            "@radix-ui/react-switch",
            "@radix-ui/react-tooltip"
          ],
          "date-fns": ["date-fns"],
          // ✅ separate – only needed where dates shown
          "icons": ["lucide-react"],
          // ✅ separate – large icon set
          "utils": ["clsx", "tailwind-merge"]
        }
      }
    },
    minify: "esbuild"
    // ✅ Fastest minifier
  },
  esbuild: {
    // ✅ Strip all console.log and debugger calls in production
    drop: mode === "production" ? ["console", "debugger"] : []
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxIYXJvbGRcXFxcRG9jdW1lbnRzXFxcXFByb3llY3Rvc1xcXFxDb2JybyBBcHBcXFxcQ29icm8gQXBwXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxIYXJvbGRcXFxcRG9jdW1lbnRzXFxcXFByb3llY3Rvc1xcXFxDb2JybyBBcHBcXFxcQ29icm8gQXBwXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9IYXJvbGQvRG9jdW1lbnRzL1Byb3llY3Rvcy9Db2JybyUyMEFwcC9Db2JybyUyMEFwcC92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCB7IGNvbXBvbmVudFRhZ2dlciB9IGZyb20gXCJsb3ZhYmxlLXRhZ2dlclwiO1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJztcclxuaW1wb3J0IGxlZ2FjeSBmcm9tICdAdml0ZWpzL3BsdWdpbi1sZWdhY3knO1xyXG5pbXBvcnQgdml0ZUNvbXByZXNzaW9uIGZyb20gJ3ZpdGUtcGx1Z2luLWNvbXByZXNzaW9uJztcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiBcIjo6XCIsXHJcbiAgICBwb3J0OiA4MDgwLFxyXG4gICAgcHJveHk6IHtcclxuICAgICAgJy9hcGktYWxhbnViZS1zYW5kYm94Jzoge1xyXG4gICAgICAgIHRhcmdldDogJ2h0dHBzOi8vc2FuZGJveC5hbGFudWJlLmNvJyxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgJ09yaWdpbic6ICdodHRwczovL3NhbmRib3guYWxhbnViZS5jbycsXHJcbiAgICAgICAgICAnUmVmZXJlcic6ICdodHRwczovL3NhbmRib3guYWxhbnViZS5jbydcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hcGktYWxhbnViZS1zYW5kYm94LywgJycpXHJcbiAgICAgIH0sXHJcbiAgICAgICcvYXBpLWFsYW51YmUtcHJvZCc6IHtcclxuICAgICAgICB0YXJnZXQ6ICdodHRwczovL2FwaS5hbGFudWJlLmNvJyxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgJ09yaWdpbic6ICdodHRwczovL2FwaS5hbGFudWJlLmNvJyxcclxuICAgICAgICAgICdSZWZlcmVyJzogJ2h0dHBzOi8vYXBpLmFsYW51YmUuY28nXHJcbiAgICAgICAgfSxcclxuICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpLWFsYW51YmUtcHJvZC8sICcnKVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgbGVnYWN5KHtcclxuICAgICAgdGFyZ2V0czogW1wiZGVmYXVsdHNcIiwgXCJub3QgSUUgMTFcIiwgXCJjaHJvbWUgPj0gNDlcIiwgXCJmaXJlZm94ID49IDQ1XCIsIFwic2FmYXJpID49IDEwXCIsIFwiZWRnZSA+PSAxNVwiXSxcclxuICAgIH0pLFxyXG4gICAgdml0ZUNvbXByZXNzaW9uKHtcclxuICAgICAgYWxnb3JpdGhtOiAnYnJvdGxpQ29tcHJlc3MnLFxyXG4gICAgICBleHQ6ICcuYnInLFxyXG4gICAgICB0aHJlc2hvbGQ6IDEwMjQsXHJcbiAgICB9KSxcclxuICAgIHZpdGVDb21wcmVzc2lvbih7XHJcbiAgICAgIGFsZ29yaXRobTogJ2d6aXAnLFxyXG4gICAgICBleHQ6ICcuZ3onLFxyXG4gICAgICB0aHJlc2hvbGQ6IDEwMjQsXHJcbiAgICB9KSxcclxuICAgIG1vZGUgPT09ICdkZXZlbG9wbWVudCcgJiYgY29tcG9uZW50VGFnZ2VyKCksXHJcbiAgICBWaXRlUFdBKHtcclxuICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXHJcbiAgICAgIGluY2x1ZGVBc3NldHM6IFsnZmF2aWNvbi5pY28nLCAncGxhY2Vob2xkZXIuc3ZnJywgJ2ljb24tMTkyLnBuZycsICdpY29uLTUxMi5wbmcnLCAnY29icm8tbG9nby5wbmcnLCAnb2ZmbGluZS5odG1sJ10sXHJcbiAgICAgIG1hbmlmZXN0OiB7XHJcbiAgICAgICAgbmFtZTogJ0NvYnJvIFBPUycsXHJcbiAgICAgICAgc2hvcnRfbmFtZTogJ0NvYnJvIFBPUycsXHJcbiAgICAgICAgZGVzY3JpcHRpb246ICdTaXN0ZW1hIGNvbXBsZXRvIGRlIGZhY3R1cmFjaVx1MDBGM24geSBwdW50byBkZSB2ZW50YSBwYXJhIFJlcFx1MDBGQWJsaWNhIERvbWluaWNhbmEnLFxyXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnIzAwMDAwMCcsXHJcbiAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogJyMwMDAwMDAnLFxyXG4gICAgICAgIGRpc3BsYXk6ICdzdGFuZGFsb25lJyxcclxuICAgICAgICBvcmllbnRhdGlvbjogJ2FueScsXHJcbiAgICAgICAgc3RhcnRfdXJsOiAnLycsXHJcbiAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgIHsgc3JjOiAnL2ljb24tMTkyLnBuZycsIHNpemVzOiAnMTkyeDE5MicsIHR5cGU6ICdpbWFnZS9wbmcnLCBwdXJwb3NlOiAnYW55JyB9LFxyXG4gICAgICAgICAgeyBzcmM6ICcvaWNvbi01MTIucG5nJywgc2l6ZXM6ICc1MTJ4NTEyJywgdHlwZTogJ2ltYWdlL3BuZycsIHB1cnBvc2U6ICdhbnknIH0sXHJcbiAgICAgICAgICB7IHNyYzogJy9pY29uLTUxMi5wbmcnLCBzaXplczogJzUxMng1MTInLCB0eXBlOiAnaW1hZ2UvcG5nJywgcHVycG9zZTogJ21hc2thYmxlJyB9XHJcbiAgICAgICAgXVxyXG4gICAgICB9LFxyXG4gICAgICB3b3JrYm94OiB7XHJcbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbJyoqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnLHdvZmYsd29mZjJ9J10sXHJcbiAgICAgICAgbmF2aWdhdGVGYWxsYmFjazogJy9pbmRleC5odG1sJyxcclxuICAgICAgICBydW50aW1lQ2FjaGluZzogW1xyXG4gICAgICAgICAgLy8gXHUyNzA1IENhY2hlIFN1cGFiYXNlIFJFU1QgQVBJIGNhbGxzIFx1MjAxNCBpbnN0YW50IHJlcGVhdCBsb2Fkc1xyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcLy4qXFwuc3VwYWJhc2VcXC5jb1xcL3Jlc3RcXC8uKi9pLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiAnTmV0d29ya0ZpcnN0JyxcclxuICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogJ3N1cGFiYXNlLXJlc3QtY2FjaGUnLFxyXG4gICAgICAgICAgICAgIG5ldHdvcmtUaW1lb3V0U2Vjb25kczogNCxcclxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7IG1heEVudHJpZXM6IDEwMCwgbWF4QWdlU2Vjb25kczogNjAgKiAxNSB9LFxyXG4gICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7IHN0YXR1c2VzOiBbMCwgMjAwXSB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICAvLyBcdTI3MDUgQ2FjaGUgcHJvZHVjdCAmIHN0b3JlIGltYWdlcyBhZ2dyZXNzaXZlbHlcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC8uKlxcLnN1cGFiYXNlXFwuY29cXC9zdG9yYWdlXFwvLiovaSxcclxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnc3VwYWJhc2Utc3RvcmFnZS1jYWNoZScsXHJcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjogeyBtYXhFbnRyaWVzOiAyMDAsIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDcgfSxcclxuICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZTogeyBzdGF0dXNlczogWzAsIDIwMF0gfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL2ltYWdlc1xcLnVuc3BsYXNoXFwuY29tXFwvLiovaSxcclxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnaW1hZ2UtY2FjaGUnLFxyXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHsgbWF4RW50cmllczogNTAsIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDMwIH0sXHJcbiAgICAgICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHsgc3RhdHVzZXM6IFswLCAyMDBdIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIF1cclxuICAgICAgfVxyXG4gICAgfSlcclxuICBdLmZpbHRlcihCb29sZWFuKSxcclxuICBidWlsZDoge1xyXG4gICAgc291cmNlbWFwOiBmYWxzZSwgICAgICAgICAgLy8gXHUyNzA1IE5vIHNvdXJjZSBtYXBzIGluIHByb2QgPSB+MzUlIHNtYWxsZXIgYnVuZGxlXHJcbiAgICB0YXJnZXQ6IFsnZXMyMDE1JywgJ2Nocm9tZTU4JywgJ2ZpcmVmb3g1NycsICdzYWZhcmkxMScsICdlZGdlMTYnXSwgICAgICAgICAgLy8gXHUyNzA1IE1vZGVybiBicm93c2VycyBvbmx5ID0gc21hbGxlciwgZmFzdGVyIG91dHB1dFxyXG4gICAgY3NzQ29kZVNwbGl0OiB0cnVlLCAgICAgICAgLy8gXHUyNzA1IE9ubHkgbG9hZCBDU1MgZm9yIGN1cnJlbnQgcm91dGVcclxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMCxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAncmVhY3QtY29yZSc6IFsncmVhY3QnLCAncmVhY3QtZG9tJ10sXHJcbiAgICAgICAgICAncm91dGVyJzogWydyZWFjdC1yb3V0ZXItZG9tJ10sXHJcbiAgICAgICAgICAnc3VwYWJhc2UnOiBbJ0BzdXBhYmFzZS9zdXBhYmFzZS1qcyddLFxyXG4gICAgICAgICAgJ3JlYWN0LXF1ZXJ5JzogWydAdGFuc3RhY2svcmVhY3QtcXVlcnknXSxcclxuICAgICAgICAgICdyZWNoYXJ0cyc6IFsncmVjaGFydHMnXSwgICAgICAgICAgICAvLyBoZWF2eSBcdTIwMTMgZGFzaGJvYXJkIG9ubHlcclxuICAgICAgICAgICdmcmFtZXItbW90aW9uJzogWydmcmFtZXItbW90aW9uJ10sICAvLyBoZWF2eSBcdTIwMTMgbG9hZCBvbiBkZW1hbmRcclxuICAgICAgICAgICdyYWRpeC11aSc6IFtcclxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1kaWFsb2cnLFxyXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXNsb3QnLFxyXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXRvYXN0JyxcclxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC10YWJzJyxcclxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1zZWxlY3QnLFxyXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWRyb3Bkb3duLW1lbnUnLFxyXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXBvcG92ZXInLFxyXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWNoZWNrYm94JyxcclxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1sYWJlbCcsXHJcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3Qtc3dpdGNoJyxcclxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC10b29sdGlwJyxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgICAnZGF0ZS1mbnMnOiBbJ2RhdGUtZm5zJ10sICAgICAgICAgICAgLy8gXHUyNzA1IHNlcGFyYXRlIFx1MjAxMyBvbmx5IG5lZWRlZCB3aGVyZSBkYXRlcyBzaG93blxyXG4gICAgICAgICAgJ2ljb25zJzogWydsdWNpZGUtcmVhY3QnXSwgICAgICAgICAgIC8vIFx1MjcwNSBzZXBhcmF0ZSBcdTIwMTMgbGFyZ2UgaWNvbiBzZXRcclxuICAgICAgICAgICd1dGlscyc6IFsnY2xzeCcsICd0YWlsd2luZC1tZXJnZSddLFxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIG1pbmlmeTogJ2VzYnVpbGQnLCAgICAgICAgIC8vIFx1MjcwNSBGYXN0ZXN0IG1pbmlmaWVyXHJcbiAgfSxcclxuICBlc2J1aWxkOiB7XHJcbiAgICAvLyBcdTI3MDUgU3RyaXAgYWxsIGNvbnNvbGUubG9nIGFuZCBkZWJ1Z2dlciBjYWxscyBpbiBwcm9kdWN0aW9uXHJcbiAgICBkcm9wOiBtb2RlID09PSAncHJvZHVjdGlvbicgPyBbJ2NvbnNvbGUnLCAnZGVidWdnZXInXSA6IFtdLFxyXG4gIH0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXHJcbiAgICB9LFxyXG4gIH0sXHJcbn0pKTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5VyxTQUFTLG9CQUFvQjtBQUN0WSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZUFBZTtBQUN4QixPQUFPLFlBQVk7QUFDbkIsT0FBTyxxQkFBcUI7QUFONUIsSUFBTSxtQ0FBbUM7QUFTekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCx3QkFBd0I7QUFBQSxRQUN0QixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxTQUFTO0FBQUEsVUFDUCxVQUFVO0FBQUEsVUFDVixXQUFXO0FBQUEsUUFDYjtBQUFBLFFBQ0EsU0FBUyxDQUFDQSxVQUFTQSxNQUFLLFFBQVEsMEJBQTBCLEVBQUU7QUFBQSxNQUM5RDtBQUFBLE1BQ0EscUJBQXFCO0FBQUEsUUFDbkIsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsU0FBUztBQUFBLFVBQ1AsVUFBVTtBQUFBLFVBQ1YsV0FBVztBQUFBLFFBQ2I7QUFBQSxRQUNBLFNBQVMsQ0FBQ0EsVUFBU0EsTUFBSyxRQUFRLHVCQUF1QixFQUFFO0FBQUEsTUFDM0Q7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsU0FBUyxDQUFDLFlBQVksYUFBYSxnQkFBZ0IsaUJBQWlCLGdCQUFnQixZQUFZO0FBQUEsSUFDbEcsQ0FBQztBQUFBLElBQ0QsZ0JBQWdCO0FBQUEsTUFDZCxXQUFXO0FBQUEsTUFDWCxLQUFLO0FBQUEsTUFDTCxX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
