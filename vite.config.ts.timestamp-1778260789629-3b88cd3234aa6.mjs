// vite.config.ts
import { defineConfig } from "file:///home/leo/Documents/projects/movie-maker-palette/node_modules/vite/dist/node/index.js";
import react from "file:///home/leo/Documents/projects/movie-maker-palette/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import fs from "fs";
import { componentTagger } from "file:///home/leo/Documents/projects/movie-maker-palette/node_modules/lovable-tagger/dist/index.js";
import { VitePWA } from "file:///home/leo/Documents/projects/movie-maker-palette/node_modules/vite-plugin-pwa/dist/index.js";
var __vite_injected_original_dirname = "/home/leo/Documents/projects/movie-maker-palette";
var spaHistoryFallbackPlugin = () => {
  return {
    name: "spa-history-fallback",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET") return next();
        const url = req.originalUrl ?? req.url ?? "";
        const pathname = url.split("?")[0] || "";
        if (pathname.startsWith("/@") || pathname.startsWith("/api/") || pathname.startsWith("/supabase/") || pathname.includes(".")) {
          return next();
        }
        const indexPath = path.resolve(__vite_injected_original_dirname, "index.html");
        const html = fs.readFileSync(indexPath, "utf-8");
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
      });
    }
  };
};
var vite_config_default = defineConfig(({ mode }) => ({
  appType: "spa",
  server: {
    host: "::",
    port: 8080,
    hmr: false
  },
  plugins: [
    react(),
    mode === "development" && spaHistoryFallbackPlugin(),
    mode === "development" && process.env.VITE_ENABLE_COMPONENT_TAGGER === "true" && componentTagger(),
    process.env.BUILDING_NATIVE !== "true" && VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "manifest.webmanifest",
        "offline.html",
        "pwa-icon.svg",
        "robots.txt",
        "signature-tv-logo.png"
      ],
      manifest: {
        name: "Signature TV",
        short_name: "Signature TV",
        description: "Home of quality entertainment - Stream movies and TV shows",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/pwa-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: [
          "**/*.{js,css,html,ico,woff2,txt,webmanifest}"
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tsfwlereofjlxhjsarap\.supabase\.co\/rest\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /^https:\/\/tsfwlereofjlxhjsarap\.supabase\.co\/storage\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-storage-cache",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 7
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(woff|woff2|ttf|eot)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "fonts-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/supabase\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      },
      devOptions: {
        enabled: false
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-select",
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-label",
            "@radix-ui/react-popover",
            "@radix-ui/react-progress",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-separator",
            "@radix-ui/react-slider",
            "@radix-ui/react-switch"
          ],
          "vendor-motion": ["framer-motion"],
          "vendor-video": ["video.js", "@videojs/http-streaming"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-charts": ["recharts"],
          "vendor-capacitor": [
            "@capacitor/core",
            "@capacitor/app",
            "@capacitor/preferences",
            "@capacitor/haptics",
            "@capacitor/splash-screen"
          ]
        }
      }
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9sZW8vRG9jdW1lbnRzL3Byb2plY3RzL21vdmllLW1ha2VyLXBhbGV0dGVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL2xlby9Eb2N1bWVudHMvcHJvamVjdHMvbW92aWUtbWFrZXItcGFsZXR0ZS92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS9sZW8vRG9jdW1lbnRzL3Byb2plY3RzL21vdmllLW1ha2VyLXBhbGV0dGUvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgZnMgZnJvbSBcImZzXCI7XHJcbmltcG9ydCB7IGNvbXBvbmVudFRhZ2dlciB9IGZyb20gXCJsb3ZhYmxlLXRhZ2dlclwiO1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSBcInZpdGUtcGx1Z2luLXB3YVwiO1xyXG5cclxuY29uc3Qgc3BhSGlzdG9yeUZhbGxiYWNrUGx1Z2luID0gKCkgPT4ge1xyXG4gIHJldHVybiB7XHJcbiAgICBuYW1lOiBcInNwYS1oaXN0b3J5LWZhbGxiYWNrXCIsXHJcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyOiBhbnkpIHtcclxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxOiBhbnksIHJlczogYW55LCBuZXh0OiBhbnkpID0+IHtcclxuICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gXCJHRVRcIikgcmV0dXJuIG5leHQoKTtcclxuXHJcbiAgICAgICAgY29uc3QgdXJsID0gKHJlcS5vcmlnaW5hbFVybCA/PyByZXEudXJsID8/IFwiXCIpIGFzIHN0cmluZztcclxuICAgICAgICBjb25zdCBwYXRobmFtZSA9IHVybC5zcGxpdChcIj9cIilbMF0gfHwgXCJcIjtcclxuXHJcbiAgICAgICAgLy8gU2tpcCBWaXRlIGludGVybmFscywgYXNzZXRzLCBhbmQgQVBJIHJvdXRlc1xyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgIHBhdGhuYW1lLnN0YXJ0c1dpdGgoXCIvQFwiKSB8fFxyXG4gICAgICAgICAgcGF0aG5hbWUuc3RhcnRzV2l0aChcIi9hcGkvXCIpIHx8XHJcbiAgICAgICAgICBwYXRobmFtZS5zdGFydHNXaXRoKFwiL3N1cGFiYXNlL1wiKSB8fFxyXG4gICAgICAgICAgcGF0aG5hbWUuaW5jbHVkZXMoXCIuXCIpXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICByZXR1cm4gbmV4dCgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgaW5kZXhQYXRoID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJpbmRleC5odG1sXCIpO1xyXG4gICAgICAgIGNvbnN0IGh0bWwgPSBmcy5yZWFkRmlsZVN5bmMoaW5kZXhQYXRoLCBcInV0Zi04XCIpO1xyXG5cclxuICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcclxuICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwidGV4dC9odG1sOyBjaGFyc2V0PXV0Zi04XCIpO1xyXG4gICAgICAgIHJlcy5lbmQoaHRtbCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSxcclxuICB9O1xyXG59O1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4gKHtcclxuICBhcHBUeXBlOiBcInNwYVwiLFxyXG4gIHNlcnZlcjoge1xyXG4gICAgaG9zdDogXCI6OlwiLFxyXG4gICAgcG9ydDogODA4MCxcclxuICAgIGhtcjogZmFsc2UsXHJcbiAgfSxcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgbW9kZSA9PT0gXCJkZXZlbG9wbWVudFwiICYmIHNwYUhpc3RvcnlGYWxsYmFja1BsdWdpbigpLFxyXG4gICAgbW9kZSA9PT0gXCJkZXZlbG9wbWVudFwiICYmXHJcbiAgICAgIHByb2Nlc3MuZW52LlZJVEVfRU5BQkxFX0NPTVBPTkVOVF9UQUdHRVIgPT09IFwidHJ1ZVwiICYmXHJcbiAgICAgIGNvbXBvbmVudFRhZ2dlcigpLFxyXG4gICAgcHJvY2Vzcy5lbnYuQlVJTERJTkdfTkFUSVZFICE9PSBcInRydWVcIiAmJlxyXG4gICAgICBWaXRlUFdBKHtcclxuICAgICAgICByZWdpc3RlclR5cGU6IFwiYXV0b1VwZGF0ZVwiLFxyXG4gICAgICAgIGluY2x1ZGVBc3NldHM6IFtcclxuICAgICAgICAgIFwiZmF2aWNvbi5pY29cIixcclxuICAgICAgICAgIFwibWFuaWZlc3Qud2VibWFuaWZlc3RcIixcclxuICAgICAgICAgIFwib2ZmbGluZS5odG1sXCIsXHJcbiAgICAgICAgICBcInB3YS1pY29uLnN2Z1wiLFxyXG4gICAgICAgICAgXCJyb2JvdHMudHh0XCIsXHJcbiAgICAgICAgICBcInNpZ25hdHVyZS10di1sb2dvLnBuZ1wiLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgbWFuaWZlc3Q6IHtcclxuICAgICAgICAgIG5hbWU6IFwiU2lnbmF0dXJlIFRWXCIsXHJcbiAgICAgICAgICBzaG9ydF9uYW1lOiBcIlNpZ25hdHVyZSBUVlwiLFxyXG4gICAgICAgICAgZGVzY3JpcHRpb246XHJcbiAgICAgICAgICAgIFwiSG9tZSBvZiBxdWFsaXR5IGVudGVydGFpbm1lbnQgLSBTdHJlYW0gbW92aWVzIGFuZCBUViBzaG93c1wiLFxyXG4gICAgICAgICAgdGhlbWVfY29sb3I6IFwiIzBhMGEwYVwiLFxyXG4gICAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogXCIjMGEwYTBhXCIsXHJcbiAgICAgICAgICBkaXNwbGF5OiBcInN0YW5kYWxvbmVcIixcclxuICAgICAgICAgIG9yaWVudGF0aW9uOiBcInBvcnRyYWl0XCIsXHJcbiAgICAgICAgICBzY29wZTogXCIvXCIsXHJcbiAgICAgICAgICBzdGFydF91cmw6IFwiL1wiLFxyXG4gICAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIHNyYzogXCIvcHdhLWljb24uc3ZnXCIsXHJcbiAgICAgICAgICAgICAgc2l6ZXM6IFwiYW55XCIsXHJcbiAgICAgICAgICAgICAgdHlwZTogXCJpbWFnZS9zdmcreG1sXCIsXHJcbiAgICAgICAgICAgICAgcHVycG9zZTogXCJhbnkgbWFza2FibGVcIixcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgfSxcclxuICAgICAgICB3b3JrYm94OiB7XHJcbiAgICAgICAgICBnbG9iUGF0dGVybnM6IFtcclxuICAgICAgICAgICAgXCIqKi8qLntqcyxjc3MsaHRtbCxpY28sd29mZjIsdHh0LHdlYm1hbmlmZXN0fVwiXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgICAgcnVudGltZUNhY2hpbmc6IFtcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvdHNmd2xlcmVvZmpseGhqc2FyYXBcXC5zdXBhYmFzZVxcLmNvXFwvcmVzdFxcLy4qL2ksXHJcbiAgICAgICAgICAgICAgaGFuZGxlcjogXCJOZXR3b3JrRmlyc3RcIixcclxuICAgICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICBjYWNoZU5hbWU6IFwic3VwYWJhc2UtYXBpLWNhY2hlXCIsXHJcbiAgICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgIG1heEVudHJpZXM6IDEwMCxcclxuICAgICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA1LFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7XHJcbiAgICAgICAgICAgICAgICAgIHN0YXR1c2VzOiBbMCwgMjAwXSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBuZXR3b3JrVGltZW91dFNlY29uZHM6IDEwLFxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL3RzZndsZXJlb2ZqbHhoanNhcmFwXFwuc3VwYWJhc2VcXC5jb1xcL3N0b3JhZ2VcXC8uKi9pLFxyXG4gICAgICAgICAgICAgIGhhbmRsZXI6IFwiTmV0d29ya0ZpcnN0XCIsXHJcbiAgICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgY2FjaGVOYW1lOiBcInN1cGFiYXNlLXN0b3JhZ2UtY2FjaGVcIixcclxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgICAgICAgbWF4RW50cmllczogNTAwLFxyXG4gICAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiA3LFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7XHJcbiAgICAgICAgICAgICAgICAgIHN0YXR1c2VzOiBbMCwgMjAwXSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIHVybFBhdHRlcm46IC9cXC4od29mZnx3b2ZmMnx0dGZ8ZW90KSQvaSxcclxuICAgICAgICAgICAgICBoYW5kbGVyOiBcIkNhY2hlRmlyc3RcIixcclxuICAgICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICBjYWNoZU5hbWU6IFwiZm9udHMtY2FjaGVcIixcclxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgICAgICAgbWF4RW50cmllczogMjAsXHJcbiAgICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDM2NSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZToge1xyXG4gICAgICAgICAgICAgICAgICBzdGF0dXNlczogWzAsIDIwMF0sXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgICAgbmF2aWdhdGVGYWxsYmFjazogXCIvaW5kZXguaHRtbFwiLFxyXG4gICAgICAgICAgbmF2aWdhdGVGYWxsYmFja0RlbnlsaXN0OiBbL15cXC9hcGlcXC8vLCAvXlxcL3N1cGFiYXNlXFwvL10sXHJcbiAgICAgICAgICBjbGVhbnVwT3V0ZGF0ZWRDYWNoZXM6IHRydWUsXHJcbiAgICAgICAgICBjbGllbnRzQ2xhaW06IHRydWUsXHJcbiAgICAgICAgICBza2lwV2FpdGluZzogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIGRldk9wdGlvbnM6IHtcclxuICAgICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0pLFxyXG4gIF0uZmlsdGVyKEJvb2xlYW4pLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgfSxcclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICBvdXREaXI6IFwiZGlzdFwiLFxyXG4gICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICBtYW51YWxDaHVua3M6IHtcclxuICAgICAgICAgIFwidmVuZG9yLXJlYWN0XCI6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCIsIFwicmVhY3Qtcm91dGVyLWRvbVwiXSxcclxuICAgICAgICAgIFwidmVuZG9yLXF1ZXJ5XCI6IFtcIkB0YW5zdGFjay9yZWFjdC1xdWVyeVwiXSxcclxuICAgICAgICAgIFwidmVuZG9yLXVpXCI6IFtcclxuICAgICAgICAgICAgXCJAcmFkaXgtdWkvcmVhY3QtZGlhbG9nXCIsXHJcbiAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LWRyb3Bkb3duLW1lbnVcIixcclxuICAgICAgICAgICAgXCJAcmFkaXgtdWkvcmVhY3QtdGFic1wiLFxyXG4gICAgICAgICAgICBcIkByYWRpeC11aS9yZWFjdC10b2FzdFwiLFxyXG4gICAgICAgICAgICBcIkByYWRpeC11aS9yZWFjdC10b29sdGlwXCIsXHJcbiAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LXNlbGVjdFwiLFxyXG4gICAgICAgICAgICBcIkByYWRpeC11aS9yZWFjdC1hY2NvcmRpb25cIixcclxuICAgICAgICAgICAgXCJAcmFkaXgtdWkvcmVhY3QtYWxlcnQtZGlhbG9nXCIsXHJcbiAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LWF2YXRhclwiLFxyXG4gICAgICAgICAgICBcIkByYWRpeC11aS9yZWFjdC1jaGVja2JveFwiLFxyXG4gICAgICAgICAgICBcIkByYWRpeC11aS9yZWFjdC1sYWJlbFwiLFxyXG4gICAgICAgICAgICBcIkByYWRpeC11aS9yZWFjdC1wb3BvdmVyXCIsXHJcbiAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LXByb2dyZXNzXCIsXHJcbiAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LXJhZGlvLWdyb3VwXCIsXHJcbiAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LXNjcm9sbC1hcmVhXCIsXHJcbiAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LXNlcGFyYXRvclwiLFxyXG4gICAgICAgICAgICBcIkByYWRpeC11aS9yZWFjdC1zbGlkZXJcIixcclxuICAgICAgICAgICAgXCJAcmFkaXgtdWkvcmVhY3Qtc3dpdGNoXCIsXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgICAgXCJ2ZW5kb3ItbW90aW9uXCI6IFtcImZyYW1lci1tb3Rpb25cIl0sXHJcbiAgICAgICAgICBcInZlbmRvci12aWRlb1wiOiBbXCJ2aWRlby5qc1wiLCBcIkB2aWRlb2pzL2h0dHAtc3RyZWFtaW5nXCJdLFxyXG4gICAgICAgICAgXCJ2ZW5kb3Itc3VwYWJhc2VcIjogW1wiQHN1cGFiYXNlL3N1cGFiYXNlLWpzXCJdLFxyXG4gICAgICAgICAgXCJ2ZW5kb3ItY2hhcnRzXCI6IFtcInJlY2hhcnRzXCJdLFxyXG4gICAgICAgICAgXCJ2ZW5kb3ItY2FwYWNpdG9yXCI6IFtcclxuICAgICAgICAgICAgXCJAY2FwYWNpdG9yL2NvcmVcIixcclxuICAgICAgICAgICAgXCJAY2FwYWNpdG9yL2FwcFwiLFxyXG4gICAgICAgICAgICBcIkBjYXBhY2l0b3IvcHJlZmVyZW5jZXNcIixcclxuICAgICAgICAgICAgXCJAY2FwYWNpdG9yL2hhcHRpY3NcIixcclxuICAgICAgICAgICAgXCJAY2FwYWNpdG9yL3NwbGFzaC1zY3JlZW5cIixcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxufSkpO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWtVLFNBQVMsb0JBQW9CO0FBQy9WLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsT0FBTyxRQUFRO0FBQ2YsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxlQUFlO0FBTHhCLElBQU0sbUNBQW1DO0FBT3pDLElBQU0sMkJBQTJCLE1BQU07QUFDckMsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sZ0JBQWdCLFFBQWE7QUFDM0IsYUFBTyxZQUFZLElBQUksQ0FBQyxLQUFV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
