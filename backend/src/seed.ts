import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { Argon2PasswordHasher } from "./modules/identidad/infrastructure/security/argon2-password-hasher";
import { lunesDeLaSemanaActual } from "./compartido/tiempo";

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

// Misma semana que usa la API, para que los datos sembrados caigan en la semana en curso.
export function obtenerLunesSemanaActual(): string {
  return lunesDeLaSemanaActual();
}

export function sumarDias(fechaStr: string, dias: number): string {
  const d = new Date(`${fechaStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function sembrarDatos(databaseUrl?: string): Promise<void> {
  // El seed hace TRUNCATE ... CASCADE de todo y usa claves fijas conocidas.
  if (process.env.NODE_ENV === "production") {
    throw new Error("El seed no se ejecuta con NODE_ENV=production: borra todas las tablas.");
  }
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no configurada para seed.");

  const pool = new pg.Pool({ connectionString: url });
  const client = await pool.connect();
  const hasher = new Argon2PasswordHasher();

  try {
    await client.query("BEGIN");
    console.log("Limpiando datos anteriores para resembrar...");
    await client.query(`
      TRUNCATE TABLE
        revisiones,
        evidencias,
        registros_jornada,
        actividades,
        asignaciones,
        programaciones_semanales,
        centros_trabajo,
        sesiones,
        hojas_de_vida,
        usuarios
      CASCADE
    `);

    console.log("Sembrando datos de demostración...");

    const passwordComun = await hasher.hash("Plomada2026!");

    // 1. Usuarios del sistema
    const usuarios = [
      {
        id: "10000000-0000-4000-8000-000000000001",
        nombre: "Administrador Central",
        correo: "admin@plomada.local",
        rol: "administrador",
      },
      {
        id: "10000000-0000-4000-8000-000000000002",
        nombre: "Coordinador Administrativo",
        correo: "administrativo@plomada.local",
        rol: "administrativo",
      },
      {
        id: "10000000-0000-4000-8000-000000000003",
        nombre: "Supervisor de Zona",
        correo: "supervisor@plomada.local",
        rol: "supervisor",
      },
      {
        id: "10000000-0000-4000-8000-000000000004",
        nombre: "Juan Carlos Pérez",
        correo: "operario1@plomada.local",
        rol: "operario",
      },
      {
        id: "10000000-0000-4000-8000-000000000005",
        nombre: "Andrés Felipe Ruiz",
        correo: "operario2@plomada.local",
        rol: "operario",
      },
      {
        id: "10000000-0000-4000-8000-000000000006",
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
        id: "20000000-0000-4000-8000-000000000001",
        nombre: "Conjunto Residencial Los Robles",
        direccion: "Carrera 15 # 116-45, Bogotá",
      },
      {
        id: "20000000-0000-4000-8000-000000000002",
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
    const programacionId = "30000000-0000-4000-8000-000000000001";
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
        id: "40000000-0000-4000-8000-000000000001",
        operarioId: "10000000-0000-4000-8000-000000000004", // operario1
        centroTrabajoId: centros[0].id, // Los Robles
        fecha: semanaInicio, // Lunes
        actividades: [
          { id: "50000000-0000-4000-8000-000000000001", descripcion: "Mantenimiento y desinfección de piscina" },
          { id: "50000000-0000-4000-8000-000000000002", descripcion: "Revisión de válvulas y bomba sumergible" },
        ],
      },
      {
        id: "40000000-0000-4000-8000-000000000002",
        operarioId: "10000000-0000-4000-8000-000000000004", // operario1
        centroTrabajoId: centros[1].id, // Las Acacias
        fecha: sumarDias(semanaInicio, 1), // Martes
        actividades: [
          { id: "50000000-0000-4000-8000-000000000003", descripcion: "Pintura de muro perimetral norte" },
        ],
      },
      {
        id: "40000000-0000-4000-8000-000000000003",
        operarioId: "10000000-0000-4000-8000-000000000005", // operario2
        centroTrabajoId: centros[0].id, // Los Robles
        fecha: sumarDias(semanaInicio, 2), // Miércoles
        actividades: [
          { id: "50000000-0000-4000-8000-000000000004", descripcion: "Poda de césped y jardinería zona social" },
        ],
      },
      {
        id: "40000000-0000-4000-8000-000000000004",
        operarioId: "10000000-0000-4000-8000-000000000006", // operario3
        centroTrabajoId: centros[1].id, // Las Acacias
        fecha: sumarDias(semanaInicio, 3), // Jueves
        actividades: [
          { id: "50000000-0000-4000-8000-000000000005", descripcion: "Limpieza y desinfección de shut de basuras" },
        ],
      },
      {
        id: "40000000-0000-4000-8000-000000000005",
        operarioId: "10000000-0000-4000-8000-000000000004", // operario1
        centroTrabajoId: centros[0].id, // Los Robles
        fecha: sumarDias(semanaInicio, 4), // Viernes
        actividades: [
          { id: "50000000-0000-4000-8000-000000000006", descripcion: "Mantenimiento preventivo cuarto de máquinas" },
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

    // 4. Sembrar Evidencia de muestra para que el Supervisor tenga actividad en "Pendientes de revisión"
    const fotosDir = process.env.FOTOS_DIR ?? "./data/fotos";
    await fs.mkdir(fotosDir, { recursive: true });
    const fotoId = "60000000-0000-4000-8000-000000000001";
    const fotoArchivo = `${fotoId}.jpg`;
    const fotoRuta = path.join(fotosDir, fotoArchivo);
    const bufferJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
      0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
      0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
      0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
      0x00, 0xbf, 0x80, 0xff, 0xd9,
    ]);
    await fs.writeFile(fotoRuta, bufferJpeg);

    await client.query(
      `INSERT INTO evidencias (id, actividad_id, operario_id, tipo, capturada_en, recibida_en, tipo_mime, tamano_bytes, foto_ruta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        fotoId,
        "50000000-0000-4000-8000-000000000001",
        "10000000-0000-4000-8000-000000000004",
        "antes",
        new Date().toISOString(),
        new Date().toISOString(),
        "image/jpeg",
        bufferJpeg.length,
        fotoArchivo,
      ],
    );
    console.log("- 1 evidencia de muestra sembrada para la cola de supervisión.");

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
