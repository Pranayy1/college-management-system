import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {

  const isElectron = process.env.ELECTRON === "true";
  const isProduction = mode === "production" && !isElectron;

  return {

    base: "./",

    plugins: [
      react(),
      tailwindcss(),

      // Enable PWA ONLY for web production
      isProduction &&
      VitePWA({
        registerType: "autoUpdate",

        includeAssets: ["favicon.ico"],

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
              src: "/pwa-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/pwa-512.png",
              sizes: "512x512",
              type: "image/png",
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
    },

  };

});