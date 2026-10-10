import { defineConfig } from "vite";
import process from "node:process";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {

  const isElectron = mode === "electron" || process.env.ELECTRON === "true";
  const isProduction = mode === "production" && !isElectron;

  return {

    base: process.env.VERCEL ? "/" : "./",

    plugins: [
      react(),
      tailwindcss(),

      // Enable PWA ONLY for web production
      isProduction &&
      VitePWA({
        registerType: "autoUpdate",

        includeAssets: ["favicon.png"],

        manifest: {
          name: "College Management System",
          short_name: "CMS",
          description: "College Management System",
          theme_color: "#111827",
          background_color: "#ffffff",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            {
              src: "/icons/icon-192.webp",
              sizes: "192x192",
              type: "image/webp",
              purpose: "any",
            },
            {
              src: "/icons/icon-512.webp",
              sizes: "512x512",
              type: "image/webp",
              purpose: "any",
            },
          ],
        },

        workbox: {
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,

          runtimeCaching: [
            {
              urlPattern: ({ request }) =>
                  request.destination === "style" ||
                  request.destination === "script",
              handler: "CacheFirst",
              options: { cacheName: "static-assets" },
            },
            {
              urlPattern: ({ request }) =>
                  request.destination === "image",
              handler: "CacheFirst",
              options: { cacheName: "images" },
            },
            {
              urlPattern: ({ url }) =>
                  url.pathname.startsWith("/api/") &&
                  !url.pathname.startsWith("/api/auth"),
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                networkTimeoutSeconds: 3,
              },
            },
          ],
        },
      }),
    ].filter(Boolean),

    build: {
      outDir: isElectron ? "release" : "dist"
    },

    server: {
      host: true,
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": "http://localhost:5000",
        "/uploads": "http://localhost:5000",
        "/status": "http://localhost:5000",
      },
    },

  };

});