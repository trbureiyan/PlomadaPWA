import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { urlPruebas } from "./url-pruebas";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface OpcionesMigracion {
  databaseUrl?: string;
  directorioMigraciones?: string;
}

export async function ejecutarMigraciones(
  opciones: OpcionesMigracion = {},
): Promise<string[]> {
  const connectionString = opciones.databaseUrl ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida.");
  }

  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();

  try {
    // Tabla para registrar migraciones aplicadas
    await client.query(`
      CREATE TABLE IF NOT EXISTS migraciones (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL UNIQUE,
        ejecutado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const dirMigraciones =
      opciones.directorioMigraciones ??
      path.resolve(__dirname, "../../../db/migrations");
    const archivos = (await fs.readdir(dirMigraciones))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const aplicadasResult = await client.query<{ nombre: string }>(
      "SELECT nombre FROM migraciones ORDER BY id ASC",
    );
    const aplicadas = new Set(aplicadasResult.rows.map((r) => r.nombre));

    const recienEjecutadas: string[] = [];

    for (const archivo of archivos) {
      if (!aplicadas.has(archivo)) {
        const contenidoSql = await fs.readFile(
          path.join(dirMigraciones, archivo),
          "utf-8",
        );
        await client.query("BEGIN");
        try {
          await client.query(contenidoSql);
          await client.query("INSERT INTO migraciones (nombre) VALUES ($1)", [
            archivo,
          ]);
          await client.query("COMMIT");
          recienEjecutadas.push(archivo);
        } catch (error) {
          await client.query("ROLLBACK");
          throw new Error(
            `Error al ejecutar migración ${archivo}: ${(error as Error).message}`,
          );
        }
      }
    }

    return recienEjecutadas;
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecución directa por CLI: tsx src/infrastructure/database/migrator.ts
if (process.argv[1] === __filename) {
  // Cargar .env si no está en el entorno
  if (!process.env.DATABASE_URL) {
    const dotenvPath = path.resolve(__dirname, "../../../.env");
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
      // Ignorar si no existe .env
    }
  }

  const isTest =
    process.argv.includes("--test") || process.argv.includes("test");
  const targetUrl = isTest ? urlPruebas() : process.env.DATABASE_URL;

  console.log(
    `Ejecutando migraciones en ${isTest ? "plomada_test" : "plomada"}...`,
  );
  ejecutarMigraciones({ databaseUrl: targetUrl })
    .then((ejecutadas) => {
      if (ejecutadas.length === 0) {
        console.log("No hay migraciones pendientes.");
      } else {
        console.log(
          `Migraciones aplicadas con éxito: ${ejecutadas.join(", ")}`,
        );
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Fallo al migrar:", err);
      process.exit(1);
    });
}
