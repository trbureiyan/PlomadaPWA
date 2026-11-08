import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./src/pruebas/preparar-base.ts"],
    setupFiles: ["./src/pruebas/entorno.ts"],
    // Los archivos comparten plomada_test y varios la truncan: van uno tras otro.
    fileParallelism: false,
  },
});
