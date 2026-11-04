import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
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
