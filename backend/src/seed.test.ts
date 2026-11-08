import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ejecutarMigraciones } from "./infrastructure/database/migrator";
import { urlPruebas } from "./infrastructure/database/url-pruebas";
import { sembrarDatos } from "./seed";

const OPERARIOS = [
  "10000000-0000-4000-8000-000000000004",
  "10000000-0000-4000-8000-000000000005",
  "10000000-0000-4000-8000-000000000006",
];

describe("sembrarDatos", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("se niega a correr con NODE_ENV=production porque trunca todas las tablas", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(sembrarDatos("postgres://x:x@localhost:1/x")).rejects.toThrow(
      /production/,
    );
  });
});

describe("sembrarDatos: actividades para hoy (PostgreSQL real)", () => {
  const url = urlPruebas();
  let pool: pg.Pool;
  let fotosDir: string;

  beforeAll(async () => {
    await ejecutarMigraciones({ databaseUrl: url });
    pool = new pg.Pool({ connectionString: url });
    fotosDir = await mkdtemp(path.join(tmpdir(), "plomada-seed-"));
    vi.stubEnv("FOTOS_DIR", fotosDir);
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await pool.end();
    await rm(fotosDir, { recursive: true, force: true });
  });

  async function sembrarEn(ahoraIso: string) {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await sembrarDatos(url, new Date(ahoraIso));
    vi.restoreAllMocks();
  }

  async function asignacionesDe(fecha: string) {
    const res = await pool.query<{ operario_id: string; actividades: string }>(
      `SELECT a.operario_id, COUNT(act.id) AS actividades
       FROM asignaciones a JOIN actividades act ON act.asignacion_id = a.id
       WHERE a.fecha = $1 GROUP BY a.operario_id`,
      [fecha],
    );
    return new Map(res.rows.map((r) => [r.operario_id, Number(r.actividades)]));
  }

  // Mediodía de Bogotá en cada día de la semana del 2 al 8 de noviembre de 2026.
  it.each([
    ["lunes", "2026-11-02T17:00:00Z", "2026-11-02"],
    ["martes", "2026-11-03T17:00:00Z", "2026-11-03"],
    ["miércoles", "2026-11-04T17:00:00Z", "2026-11-04"],
    ["jueves", "2026-11-05T17:00:00Z", "2026-11-05"],
    ["viernes", "2026-11-06T17:00:00Z", "2026-11-06"],
  ])(
    "un %s los tres operarios tienen actividades para hoy",
    async (_dia, ahora, hoy) => {
      await sembrarEn(ahora);
      const deHoy = await asignacionesDe(hoy);
      for (const operario of OPERARIOS) {
        expect(deHoy.get(operario) ?? 0).toBeGreaterThan(0);
      }
    },
  );

  it("el lunes no duplica la asignación que el operario1 ya tenía ese día", async () => {
    await sembrarEn("2026-11-02T17:00:00Z");
    const res = await pool.query(
      "SELECT 1 FROM asignaciones WHERE operario_id = $1 AND fecha = '2026-11-02'",
      [OPERARIOS[0]],
    );
    expect(res.rowCount).toBe(1);
  });

  it("un sábado no agrega nada: la programación es de lunes a viernes", async () => {
    await sembrarEn("2026-11-07T17:00:00Z");
    const res = await pool.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM asignaciones",
    );
    expect(Number(res.rows[0].n)).toBe(5);
    expect((await asignacionesDe("2026-11-07")).size).toBe(0);
  });

  it("un domingo tampoco agrega nada y la semana sembrada es la que termina", async () => {
    await sembrarEn("2026-11-08T17:00:00Z");
    const res = await pool.query<{ semana: string; n: string }>(
      `SELECT p.semana_inicio::text AS semana, COUNT(a.id) AS n
       FROM programaciones_semanales p JOIN asignaciones a ON a.programacion_id = p.id
       GROUP BY p.semana_inicio`,
    );
    expect(res.rows).toEqual([{ semana: "2026-11-02", n: "5" }]);
  });

  it("a las 20:00 de Bogotá de un viernes sigue siendo viernes", async () => {
    // 2026-11-07T01:00Z son las 20:00 del viernes 6 en Bogotá.
    await sembrarEn("2026-11-07T01:00:00Z");
    expect((await asignacionesDe("2026-11-06")).size).toBe(3);
  });
});
