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
      registerType: "prompt",
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxIYXJvbGRcXFxcRG9jdW1lbnRzXFxcXFByb3llY3Rvc1xcXFxDb2JybyBBcHBcXFxcQ29icm8gQXBwXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxIYXJvbGRcXFxcRG9jdW1lbnRzXFxcXFByb3llY3Rvc1xcXFxDb2JybyBBcHBcXFxcQ29icm8gQXBwXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9IYXJvbGQvRG9jdW1lbnRzL1Byb3llY3Rvcy9Db2JybyUyMEFwcC9Db2JybyUyMEFwcC92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCB7IGNvbXBvbmVudFRhZ2dlciB9IGZyb20gXCJsb3ZhYmxlLXRhZ2dlclwiO1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJztcclxuaW1wb3J0IGxlZ2FjeSBmcm9tICdAdml0ZWpzL3BsdWdpbi1sZWdhY3knO1xyXG5pbXBvcnQgdml0ZUNvbXByZXNzaW9uIGZyb20gJ3ZpdGUtcGx1Z2luLWNvbXByZXNzaW9uJztcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiBcIjo6XCIsXHJcbiAgICBwb3J0OiA4MDgwLFxyXG4gICAgcHJveHk6IHtcclxuICAgICAgJy9hcGktYWxhbnViZS1zYW5kYm94Jzoge1xyXG4gICAgICAgIHRhcmdldDogJ2h0dHBzOi8vc2FuZGJveC5hbGFudWJlLmNvJyxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgJ09yaWdpbic6ICdodHRwczovL3NhbmRib3guYWxhbnViZS5jbycsXHJcbiAgICAgICAgICAnUmVmZXJlcic6ICdodHRwczovL3NhbmRib3guYWxhbnViZS5jbydcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hcGktYWxhbnViZS1zYW5kYm94LywgJycpXHJcbiAgICAgIH0sXHJcbiAgICAgICcvYXBpLWFsYW51YmUtcHJvZCc6IHtcclxuICAgICAgICB0YXJnZXQ6ICdodHRwczovL2FwaS5hbGFudWJlLmNvJyxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgJ09yaWdpbic6ICdodHRwczovL2FwaS5hbGFudWJlLmNvJyxcclxuICAgICAgICAgICdSZWZlcmVyJzogJ2h0dHBzOi8vYXBpLmFsYW51YmUuY28nXHJcbiAgICAgICAgfSxcclxuICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpLWFsYW51YmUtcHJvZC8sICcnKVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgbGVnYWN5KHtcclxuICAgICAgdGFyZ2V0czogW1wiZGVmYXVsdHNcIiwgXCJub3QgSUUgMTFcIiwgXCJjaHJvbWUgPj0gNDlcIiwgXCJmaXJlZm94ID49IDQ1XCIsIFwic2FmYXJpID49IDEwXCIsIFwiZWRnZSA+PSAxNVwiXSxcclxuICAgIH0pLFxyXG4gICAgdml0ZUNvbXByZXNzaW9uKHtcclxuICAgICAgYWxnb3JpdGhtOiAnYnJvdGxpQ29tcHJlc3MnLFxyXG4gICAgICBleHQ6ICcuYnInLFxyXG4gICAgICB0aHJlc2hvbGQ6IDEwMjQsXHJcbiAgICB9KSxcclxuICAgIHZpdGVDb21wcmVzc2lvbih7XHJcbiAgICAgIGFsZ29yaXRobTogJ2d6aXAnLFxyXG4gICAgICBleHQ6ICcuZ3onLFxyXG4gICAgICB0aHJlc2hvbGQ6IDEwMjQsXHJcbiAgICB9KSxcclxuICAgIG1vZGUgPT09ICdkZXZlbG9wbWVudCcgJiYgY29tcG9uZW50VGFnZ2VyKCksXHJcbiAgICBWaXRlUFdBKHtcclxuICAgICAgcmVnaXN0ZXJUeXBlOiAncHJvbXB0JyxcclxuICAgICAgaW5jbHVkZUFzc2V0czogWydmYXZpY29uLmljbycsICdwbGFjZWhvbGRlci5zdmcnLCAnaWNvbi0xOTIucG5nJywgJ2ljb24tNTEyLnBuZycsICdjb2Jyby1sb2dvLnBuZycsICdvZmZsaW5lLmh0bWwnXSxcclxuICAgICAgbWFuaWZlc3Q6IHtcclxuICAgICAgICBuYW1lOiAnQ29icm8gUE9TJyxcclxuICAgICAgICBzaG9ydF9uYW1lOiAnQ29icm8gUE9TJyxcclxuICAgICAgICBkZXNjcmlwdGlvbjogJ1Npc3RlbWEgY29tcGxldG8gZGUgZmFjdHVyYWNpXHUwMEYzbiB5IHB1bnRvIGRlIHZlbnRhIHBhcmEgUmVwXHUwMEZBYmxpY2EgRG9taW5pY2FuYScsXHJcbiAgICAgICAgdGhlbWVfY29sb3I6ICcjMDAwMDAwJyxcclxuICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiAnIzAwMDAwMCcsXHJcbiAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxyXG4gICAgICAgIG9yaWVudGF0aW9uOiAnYW55JyxcclxuICAgICAgICBzdGFydF91cmw6ICcvJyxcclxuICAgICAgICBpY29uczogW1xyXG4gICAgICAgICAgeyBzcmM6ICcvaWNvbi0xOTIucG5nJywgc2l6ZXM6ICcxOTJ4MTkyJywgdHlwZTogJ2ltYWdlL3BuZycsIHB1cnBvc2U6ICdhbnknIH0sXHJcbiAgICAgICAgICB7IHNyYzogJy9pY29uLTUxMi5wbmcnLCBzaXplczogJzUxMng1MTInLCB0eXBlOiAnaW1hZ2UvcG5nJywgcHVycG9zZTogJ2FueScgfSxcclxuICAgICAgICAgIHsgc3JjOiAnL2ljb24tNTEyLnBuZycsIHNpemVzOiAnNTEyeDUxMicsIHR5cGU6ICdpbWFnZS9wbmcnLCBwdXJwb3NlOiAnbWFza2FibGUnIH1cclxuICAgICAgICBdXHJcbiAgICAgIH0sXHJcbiAgICAgIHdvcmtib3g6IHtcclxuICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsd29mZix3b2ZmMn0nXSxcclxuICAgICAgICBuYXZpZ2F0ZUZhbGxiYWNrOiAnL2luZGV4Lmh0bWwnLFxyXG4gICAgICAgIHJ1bnRpbWVDYWNoaW5nOiBbXHJcbiAgICAgICAgICAvLyBcdTI3MDUgQ2FjaGUgU3VwYWJhc2UgUkVTVCBBUEkgY2FsbHMgXHUyMDE0IGluc3RhbnQgcmVwZWF0IGxvYWRzXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvLipcXC5zdXBhYmFzZVxcLmNvXFwvcmVzdFxcLy4qL2ksXHJcbiAgICAgICAgICAgIGhhbmRsZXI6ICdOZXR3b3JrRmlyc3QnLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnc3VwYWJhc2UtcmVzdC1jYWNoZScsXHJcbiAgICAgICAgICAgICAgbmV0d29ya1RpbWVvdXRTZWNvbmRzOiA0LFxyXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHsgbWF4RW50cmllczogMTAwLCBtYXhBZ2VTZWNvbmRzOiA2MCAqIDE1IH0sXHJcbiAgICAgICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHsgc3RhdHVzZXM6IFswLCAyMDBdIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIC8vIFx1MjcwNSBDYWNoZSBwcm9kdWN0ICYgc3RvcmUgaW1hZ2VzIGFnZ3Jlc3NpdmVseVxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcLy4qXFwuc3VwYWJhc2VcXC5jb1xcL3N0b3JhZ2VcXC8uKi9pLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiAnQ2FjaGVGaXJzdCcsXHJcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdzdXBhYmFzZS1zdG9yYWdlLWNhY2hlJyxcclxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7IG1heEVudHJpZXM6IDIwMCwgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogNyB9LFxyXG4gICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7IHN0YXR1c2VzOiBbMCwgMjAwXSB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvaW1hZ2VzXFwudW5zcGxhc2hcXC5jb21cXC8uKi9pLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiAnQ2FjaGVGaXJzdCcsXHJcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdpbWFnZS1jYWNoZScsXHJcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjogeyBtYXhFbnRyaWVzOiA1MCwgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzAgfSxcclxuICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZTogeyBzdGF0dXNlczogWzAsIDIwMF0gfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgXVxyXG4gICAgICB9XHJcbiAgICB9KVxyXG4gIF0uZmlsdGVyKEJvb2xlYW4pLFxyXG4gIGJ1aWxkOiB7XHJcbiAgICBzb3VyY2VtYXA6IGZhbHNlLCAgICAgICAgICAvLyBcdTI3MDUgTm8gc291cmNlIG1hcHMgaW4gcHJvZCA9IH4zNSUgc21hbGxlciBidW5kbGVcclxuICAgIHRhcmdldDogWydlczIwMTUnLCAnY2hyb21lNTgnLCAnZmlyZWZveDU3JywgJ3NhZmFyaTExJywgJ2VkZ2UxNiddLCAgICAgICAgICAvLyBcdTI3MDUgTW9kZXJuIGJyb3dzZXJzIG9ubHkgPSBzbWFsbGVyLCBmYXN0ZXIgb3V0cHV0XHJcbiAgICBjc3NDb2RlU3BsaXQ6IHRydWUsICAgICAgICAvLyBcdTI3MDUgT25seSBsb2FkIENTUyBmb3IgY3VycmVudCByb3V0ZVxyXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwLFxyXG4gICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICBtYW51YWxDaHVua3M6IHtcclxuICAgICAgICAgICdyZWFjdC1jb3JlJzogWydyZWFjdCcsICdyZWFjdC1kb20nXSxcclxuICAgICAgICAgICdyb3V0ZXInOiBbJ3JlYWN0LXJvdXRlci1kb20nXSxcclxuICAgICAgICAgICdzdXBhYmFzZSc6IFsnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJ10sXHJcbiAgICAgICAgICAncmVhY3QtcXVlcnknOiBbJ0B0YW5zdGFjay9yZWFjdC1xdWVyeSddLFxyXG4gICAgICAgICAgJ3JlY2hhcnRzJzogWydyZWNoYXJ0cyddLCAgICAgICAgICAgIC8vIGhlYXZ5IFx1MjAxMyBkYXNoYm9hcmQgb25seVxyXG4gICAgICAgICAgJ2ZyYW1lci1tb3Rpb24nOiBbJ2ZyYW1lci1tb3Rpb24nXSwgIC8vIGhlYXZ5IFx1MjAxMyBsb2FkIG9uIGRlbWFuZFxyXG4gICAgICAgICAgJ3JhZGl4LXVpJzogW1xyXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWRpYWxvZycsXHJcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3Qtc2xvdCcsXHJcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtdG9hc3QnLFxyXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXRhYnMnLFxyXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXNlbGVjdCcsXHJcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtZHJvcGRvd24tbWVudScsXHJcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtcG9wb3ZlcicsXHJcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtY2hlY2tib3gnLFxyXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWxhYmVsJyxcclxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1zd2l0Y2gnLFxyXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXRvb2x0aXAnLFxyXG4gICAgICAgICAgXSxcclxuICAgICAgICAgICdkYXRlLWZucyc6IFsnZGF0ZS1mbnMnXSwgICAgICAgICAgICAvLyBcdTI3MDUgc2VwYXJhdGUgXHUyMDEzIG9ubHkgbmVlZGVkIHdoZXJlIGRhdGVzIHNob3duXHJcbiAgICAgICAgICAnaWNvbnMnOiBbJ2x1Y2lkZS1yZWFjdCddLCAgICAgICAgICAgLy8gXHUyNzA1IHNlcGFyYXRlIFx1MjAxMyBsYXJnZSBpY29uIHNldFxyXG4gICAgICAgICAgJ3V0aWxzJzogWydjbHN4JywgJ3RhaWx3aW5kLW1lcmdlJ10sXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gICAgbWluaWZ5OiAnZXNidWlsZCcsICAgICAgICAgLy8gXHUyNzA1IEZhc3Rlc3QgbWluaWZpZXJcclxuICB9LFxyXG4gIGVzYnVpbGQ6IHtcclxuICAgIC8vIFx1MjcwNSBTdHJpcCBhbGwgY29uc29sZS5sb2cgYW5kIGRlYnVnZ2VyIGNhbGxzIGluIHByb2R1Y3Rpb25cclxuICAgIGRyb3A6IG1vZGUgPT09ICdwcm9kdWN0aW9uJyA/IFsnY29uc29sZScsICdkZWJ1Z2dlciddIDogW10sXHJcbiAgfSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcclxuICAgIH0sXHJcbiAgfSxcclxufSkpO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlXLFNBQVMsb0JBQW9CO0FBQ3RZLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxlQUFlO0FBQ3hCLE9BQU8sWUFBWTtBQUNuQixPQUFPLHFCQUFxQjtBQU41QixJQUFNLG1DQUFtQztBQVN6QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBLEVBQ3pDLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLHdCQUF3QjtBQUFBLFFBQ3RCLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFNBQVM7QUFBQSxVQUNQLFVBQVU7QUFBQSxVQUNWLFdBQVc7QUFBQSxRQUNiO0FBQUEsUUFDQSxTQUFTLENBQUNBLFVBQVNBLE1BQUssUUFBUSwwQkFBMEIsRUFBRTtBQUFBLE1BQzlEO0FBQUEsTUFDQSxxQkFBcUI7QUFBQSxRQUNuQixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxTQUFTO0FBQUEsVUFDUCxVQUFVO0FBQUEsVUFDVixXQUFXO0FBQUEsUUFDYjtBQUFBLFFBQ0EsU0FBUyxDQUFDQSxVQUFTQSxNQUFLLFFBQVEsdUJBQXVCLEVBQUU7QUFBQSxNQUMzRDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxTQUFTLENBQUMsWUFBWSxhQUFhLGdCQUFnQixpQkFBaUIsZ0JBQWdCLFlBQVk7QUFBQSxJQUNsRyxDQUFDO0FBQUEsSUFDRCxnQkFBZ0I7QUFBQSxNQUNkLFdBQVc7QUFBQSxNQUNYLEtBQUs7QUFBQSxNQUNMLFdBQVc7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
