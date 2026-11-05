import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PREFIJO_API } from "@plomada/shared";
import { crearApp } from "./composition-root";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env en desarrollo
if (!process.env.DATABASE_URL) {
  const dotenvPath = path.resolve(__dirname, "../.env");
  try {
    const dotenvContent = await fs.readFile(dotenvPath, "utf-8");
    for (const line of dotenvContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...vals] = trimmed.split("=");
        process.env[key.trim()] = vals.join("=").trim();
      }
    }
  } catch {
    // Continuar con variables de entorno por defecto
  }
}

const PORT = Number(process.env.PORT ?? 3000);
const { app } = crearApp();

app.listen(PORT, () => {
  console.log(`[Plomada API] Servidor ejecutándose en http://localhost:${PORT}${PREFIJO_API}`);
});
