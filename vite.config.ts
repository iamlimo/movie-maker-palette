import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const spaHistoryFallbackPlugin = () => {
  return {
    name: "spa-history-fallback",
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.method !== "GET") return next();

        const url = (req.originalUrl ?? req.url ?? "") as string;
        const pathname = url.split("?")[0] || "";

        // Skip Vite internals, assets, and API routes
        if (
          pathname.startsWith("/@") ||
          pathname.startsWith("/api/") ||
          pathname.startsWith("/supabase/") ||
          pathname.includes(".")
        ) {
          return next();
        }

        const indexPath = path.resolve(__dirname, "index.html");
        const html = fs.readFileSync(indexPath, "utf-8");

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
      });
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  appType: "spa",
  server: {
    host: "::",
    port: 8080,
    hmr: false,
  },
  plugins: [
    react(),
    mode === "development" && spaHistoryFallbackPlugin(),
    mode === "development" &&
      process.env.VITE_ENABLE_COMPONENT_TAGGER === "true" &&
      componentTagger(),
    process.env.BUILDING_NATIVE !== "true" &&
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: [
          "favicon.ico",
          "manifest.webmanifest",
          "offline.html",
          "pwa-icon.svg",
          "robots.txt",
          "signature-tv-logo.png",
        ],
        manifest: {
          name: "Signature TV",
          short_name: "Signature TV",
          description:
            "Home of quality entertainment - Stream movies and TV shows",
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
              purpose: "any maskable",
            },
          ],
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
                  maxAgeSeconds: 60 * 5,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
                networkTimeoutSeconds: 10,
              },
            },
            {
              urlPattern: /^https:\/\/tsfwlereofjlxhjsarap\.supabase\.co\/storage\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "supabase-storage-cache",
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\.(woff|woff2|ttf|eot)$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "fonts-cache",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api\//, /^\/supabase\//],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
        },
        devOptions: {
          enabled: false,
        },
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
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
            "@radix-ui/react-switch",
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
            "@capacitor/splash-screen",
          ],
        },
      },
    },
  },
}));
