import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { Argon2PasswordHasher } from "./modules/identidad/infrastructure/security/argon2-password-hasher";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env si no existe DATABASE_URL
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
    // Continuar
  }
}

export function obtenerLunesSemanaActual(): string {
  const ahora = new Date();
  const dia = ahora.getUTCDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(ahora);
  lunes.setUTCDate(ahora.getUTCDate() + diff);
  return lunes.toISOString().slice(0, 10);
}

export function sumarDias(fechaStr: string, dias: number): string {
  const d = new Date(`${fechaStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function sembrarDatos(databaseUrl?: string): Promise<void> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no configurada para seed.");

  const pool = new pg.Pool({ connectionString: url });
  const client = await pool.connect();
  const hasher = new Argon2PasswordHasher();

  try {
    await client.query("BEGIN");
    console.log("Sembrando datos de demostración...");

    const passwordComun = await hasher.hash("Plomada2026!");

    // 1. Usuarios del sistema
    const usuarios = [
      {
        id: "10000000-0000-0000-0000-000000000001",
        nombre: "Administrador Central",
        correo: "admin@plomada.local",
        rol: "administrador",
      },
      {
        id: "10000000-0000-0000-0000-000000000002",
        nombre: "Coordinador Administrativo",
        correo: "administrativo@plomada.local",
        rol: "administrativo",
      },
      {
        id: "10000000-0000-0000-0000-000000000003",
        nombre: "Supervisor de Zona",
        correo: "supervisor@plomada.local",
        rol: "supervisor",
      },
      {
        id: "10000000-0000-0000-0000-000000000004",
        nombre: "Juan Carlos Pérez",
        correo: "operario1@plomada.local",
        rol: "operario",
      },
      {
        id: "10000000-0000-0000-0000-000000000005",
        nombre: "Andrés Felipe Ruiz",
        correo: "operario2@plomada.local",
        rol: "operario",
      },
      {
        id: "10000000-0000-0000-0000-000000000006",
        nombre: "Mauricio Gómez",
        correo: "operario3@plomada.local",
        rol: "operario",
      },
    ];

    for (const u of usuarios) {
      await client.query(
        `INSERT INTO usuarios (id, nombre, correo, rol, contrasena_hash)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (correo) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           rol = EXCLUDED.rol,
           contrasena_hash = EXCLUDED.contrasena_hash`,
        [u.id, u.nombre, u.correo, u.rol, passwordComun],
      );
    }
    console.log(`- ${usuarios.length} usuarios sembrados.`);

    // 2. Centros de Trabajo
    const centros = [
      {
        id: "20000000-0000-0000-0000-000000000001",
        nombre: "Conjunto Residencial Los Robles",
        direccion: "Carrera 15 # 116-45, Bogotá",
      },
      {
        id: "20000000-0000-0000-0000-000000000002",
        nombre: "Conjunto Residencial Las Acacias",
        direccion: "Calle 140 # 9-30, Bogotá",
      },
    ];

    for (const c of centros) {
      await client.query(
        `INSERT INTO centros_trabajo (id, nombre, direccion)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           direccion = EXCLUDED.direccion`,
        [c.id, c.nombre, c.direccion],
      );
    }
    console.log(`- ${centros.length} centros de trabajo sembrados.`);

    // 3. Programación Semanal de la semana actual
    const semanaInicio = obtenerLunesSemanaActual();
    const programacionId = "30000000-0000-0000-0000-000000000001";
    const publicadaEn = new Date().toISOString();

    await client.query(
      `INSERT INTO programaciones_semanales (id, semana_inicio, estado, publicada_en)
       VALUES ($1, $2, 'publicada', $3)
       ON CONFLICT (semana_inicio) DO UPDATE SET
         estado = 'publicada',
         publicada_en = EXCLUDED.publicada_en
       RETURNING id`,
      [programacionId, semanaInicio, publicadaEn],
    );

    // Limpiar asignaciones anteriores de esta programación para resembrar limpio
    await client.query("DELETE FROM asignaciones WHERE programacion_id = $1", [programacionId]);

    const asignaciones = [
      {
        id: "40000000-0000-0000-0000-000000000001",
        operarioId: "10000000-0000-0000-0000-000000000004", // operario1
        centroTrabajoId: centros[0].id, // Los Robles
        fecha: semanaInicio, // Lunes
        actividades: [
          { id: "50000000-0000-0000-0000-000000000001", descripcion: "Mantenimiento y desinfección de piscina" },
          { id: "50000000-0000-0000-0000-000000000002", descripcion: "Revisión de válvulas y bomba sumergible" },
        ],
      },
      {
        id: "40000000-0000-0000-0000-000000000002",
        operarioId: "10000000-0000-0000-0000-000000000004", // operario1
        centroTrabajoId: centros[1].id, // Las Acacias
        fecha: sumarDias(semanaInicio, 1), // Martes
        actividades: [
          { id: "50000000-0000-0000-0000-000000000003", descripcion: "Pintura de muro perimetral norte" },
        ],
      },
      {
        id: "40000000-0000-0000-0000-000000000003",
        operarioId: "10000000-0000-0000-0000-000000000005", // operario2
        centroTrabajoId: centros[0].id, // Los Robles
        fecha: sumarDias(semanaInicio, 2), // Miércoles
        actividades: [
          { id: "50000000-0000-0000-0000-000000000004", descripcion: "Poda de césped y jardinería zona social" },
        ],
      },
      {
        id: "40000000-0000-0000-0000-000000000004",
        operarioId: "10000000-0000-0000-0000-000000000006", // operario3
        centroTrabajoId: centros[1].id, // Las Acacias
        fecha: sumarDias(semanaInicio, 3), // Jueves
        actividades: [
          { id: "50000000-0000-0000-0000-000000000005", descripcion: "Limpieza y desinfección de shut de basuras" },
        ],
      },
      {
        id: "40000000-0000-0000-0000-000000000005",
        operarioId: "10000000-0000-0000-0000-000000000004", // operario1
        centroTrabajoId: centros[0].id, // Los Robles
        fecha: sumarDias(semanaInicio, 4), // Viernes
        actividades: [
          { id: "50000000-0000-0000-0000-000000000006", descripcion: "Mantenimiento preventivo cuarto de máquinas" },
        ],
      },
    ];

    for (const a of asignaciones) {
      await client.query(
        `INSERT INTO asignaciones (id, programacion_id, operario_id, centro_trabajo_id, fecha)
         VALUES ($1, $2, $3, $4, $5)`,
        [a.id, programacionId, a.operarioId, a.centroTrabajoId, a.fecha],
      );

      for (const act of a.actividades) {
        await client.query(
          `INSERT INTO actividades (id, asignacion_id, descripcion)
           VALUES ($1, $2, $3)`,
          [act.id, a.id, act.descripcion],
        );
      }
    }

    console.log(`- 1 programación semanal publicada para la semana del ${semanaInicio} con ${asignaciones.length} asignaciones.`);
    await client.query("COMMIT");
    console.log("¡Semilla completada exitosamente!");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] === __filename) {
  sembrarDatos()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error al sembrar:", err);
      process.exit(1);
    });
}
