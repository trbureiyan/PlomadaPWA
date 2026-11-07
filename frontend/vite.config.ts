import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "Plomada - Mantenimiento Locativo",
        short_name: "Plomada",
        description: "Gestión de programación, jornada y evidencias fotográficas offline-first",
        theme_color: "#0284c7",
        background_color: "#f8fafc",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
    }),
  ],
  server: {
    port: 5173,
    // El cliente llama siempre a /api/v1 en su propio origen; en desarrollo
    // Vite lo reenvía al backend. Así no hay CORS que configurar y la ruta
    // es la misma que tendrá en el despliegue.
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
