// B7: los adaptadores PostgreSQL se prueban contra la base real de pruebas
// (`plomada_test`), nunca con mocks. Cada caso aplica a un adaptador la misma
// expectativa que el repositorio en memoria cumple en las pruebas de dominio.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import { ejecutarMigraciones } from "./infrastructure/database/migrator";
import { urlPruebas } from "./infrastructure/database/url-pruebas";
import { PgUsuarioRepository } from "./modules/identidad/infrastructure/persistence/pg-usuario.repository";
import { PgSesionRepository } from "./modules/identidad/infrastructure/persistence/pg-sesion.repository";
import { JoseTokenService } from "./modules/identidad/infrastructure/security/jose-token-service";
import type { SesionRepositoryPort } from "./modules/identidad/application/ports/sesion-repository.port";
import { RenovarSesionUseCase } from "./modules/identidad/application/renovar-sesion.use-case";
import { PgEvidenciaRepository } from "./modules/evidencias/infrastructure/persistence/pg-evidencia.repository";
import { PgRevisionRepository } from "./modules/evidencias/infrastructure/persistence/pg-revision.repository";
import { PgProgramacionRepository } from "./modules/programacion/infrastructure/persistence/pg-programacion.repository";
import { PgRegistroJornadaRepository } from "./modules/jornada/infrastructure/persistence/pg-registro-jornada.repository";

const URL_PRUEBAS = urlPruebas();

const OPERARIO = "a0000000-0000-4000-8000-000000000001";
const SUPERVISOR = "a0000000-0000-4000-8000-000000000002";
const CENTRO = "a0000000-0000-4000-8000-000000000003";
const PROGRAMACION = "a0000000-0000-4000-8000-000000000004";
const ASIGNACION = "a0000000-0000-4000-8000-000000000005";
const ACTIVIDAD = "a0000000-0000-4000-8000-000000000006";

describe("Adaptadores PostgreSQL contra plomada_test", () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    await ejecutarMigraciones({ databaseUrl: URL_PRUEBAS });
    pool = new pg.Pool({ connectionString: URL_PRUEBAS });
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query(
      "TRUNCATE revisiones, evidencias, registros_jornada, actividades, asignaciones, programaciones_semanales, centros_trabajo, sesiones, usuarios CASCADE",
    );
    await pool.query(
      `INSERT INTO usuarios (id, nombre, correo, rol, contrasena_hash) VALUES
        ($1, 'Operario Prueba', 'op@plomada.local', 'operario', 'hash'),
        ($2, 'Supervisor Prueba', 'sup@plomada.local', 'supervisor', 'hash')`,
      [OPERARIO, SUPERVISOR],
    );
    await pool.query(
      "INSERT INTO centros_trabajo (id, nombre) VALUES ($1, 'Conjunto Prueba')",
      [CENTRO],
    );
    await pool.query(
      "INSERT INTO programaciones_semanales (id, semana_inicio, estado) VALUES ($1, '2026-11-02', 'publicada')",
      [PROGRAMACION],
    );
    await pool.query(
      "INSERT INTO asignaciones (id, programacion_id, operario_id, centro_trabajo_id, fecha) VALUES ($1, $2, $3, $4, '2026-11-03')",
      [ASIGNACION, PROGRAMACION, OPERARIO, CENTRO],
    );
    await pool.query(
      "INSERT INTO actividades (id, asignacion_id, descripcion) VALUES ($1, $2, 'Pintar muro')",
      [ACTIVIDAD, ASIGNACION],
    );
  });

  describe("identidad", () => {
    it("guarda y busca usuarios por id y por correo, y filtra por rol", async () => {
      const repo = new PgUsuarioRepository(pool);
      const id = "b0000000-0000-4000-8000-000000000001";
      await repo.guardar({
        id,
        nombre: "Nuevo",
        correo: "nuevo@plomada.local",
        rol: "administrativo",
        contrasenaHash: "hash-argon2",
        creadoEn: new Date(),
      });

      expect((await repo.buscarPorId(id))?.correo).toBe("nuevo@plomada.local");
      expect((await repo.buscarPorCorreo("nuevo@plomada.local"))?.id).toBe(id);
      expect(await repo.buscarPorCorreo("nadie@plomada.local")).toBeNull();
      expect(
        (await repo.listar({ rol: "supervisor" })).map((u) => u.id),
      ).toEqual([SUPERVISOR]);
    });

    it("el correo es único", async () => {
      const repo = new PgUsuarioRepository(pool);
      await expect(
        repo.guardar({
          id: "b0000000-0000-4000-8000-000000000002",
          nombre: "Repetido",
          correo: "op@plomada.local",
          rol: "operario",
          contrasenaHash: "x",
          creadoEn: new Date(),
        }),
      ).rejects.toThrow();
    });

    it("revocar una sesión queda registrado", async () => {
      const repo = new PgSesionRepository(pool);
      const sesion = {
        id: "c0000000-0000-4000-8000-000000000001",
        usuarioId: OPERARIO,
        tokenRefrescoHash: "hash-del-token",
        expiraEn: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        creadoEn: new Date(),
      };
      await repo.guardar(sesion);
      expect(
        (await repo.buscarPorTokenHash("hash-del-token"))?.revocadoEn,
      ).toBeFalsy();

      await repo.revocar(sesion.id, new Date());
      expect(
        (await repo.buscarPorTokenHash("hash-del-token"))?.revocadoEn,
      ).toBeTruthy();
    });

    // Hallazgo 2: revocar debe ser un solo paso atómico; solo una de las llamadas lo consigue.
    it("revocar simultáneamente la misma sesión solo la gana una llamada", async () => {
      const repo = new PgSesionRepository(pool);
      await repo.guardar({
        id: "c0000000-0000-4000-8000-000000000002",
        usuarioId: OPERARIO,
        tokenRefrescoHash: "hash-carrera",
        expiraEn: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        creadoEn: new Date(),
      });

      const resultados = await Promise.all(
        Array.from({ length: 8 }, () =>
          repo.revocar("c0000000-0000-4000-8000-000000000002", new Date()),
        ),
      );
      expect(resultados.filter(Boolean)).toHaveLength(1);
    });

    it("renovar la sesión con el mismo refresh a la vez entrega una sola sesión nueva", async () => {
      const sesiones = new PgSesionRepository(pool);
      const tokens = new JoseTokenService(
        "secreto-de-prueba-con-mas-de-32-caracteres",
      );
      const { token, hash } = await tokens.generarRefreshToken();
      await sesiones.guardar({
        id: "c0000000-0000-4000-8000-000000000003",
        usuarioId: OPERARIO,
        tokenRefrescoHash: hash,
        expiraEn: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        creadoEn: new Date(),
      });
      // Barrera: ninguna lectura devuelve hasta que las 8 llegaron, así todas ven la sesión
      // sin revocar. Es el peor entrelazado posible y hace la prueba determinista.
      const LLAMADAS = 8;
      let llegadas = 0;
      let abrir!: () => void;
      const barrera = new Promise<void>((resolve) => (abrir = resolve));
      const conBarrera: SesionRepositoryPort = {
        guardar: (sesion) => sesiones.guardar(sesion),
        revocar: (id, cuando) => sesiones.revocar(id, cuando),
        async buscarPorTokenHash(h) {
          const encontrada = await sesiones.buscarPorTokenHash(h);
          if (++llegadas === LLAMADAS) abrir();
          await barrera;
          return encontrada;
        },
      };
      const renovar = new RenovarSesionUseCase(
        new PgUsuarioRepository(pool),
        conBarrera,
        tokens,
      );

      const resultados = await Promise.allSettled(
        Array.from({ length: LLAMADAS }, () =>
          renovar.ejecutar({ refreshToken: token }),
        ),
      );
      expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(
        1,
      );
      for (const r of resultados) {
        if (r.status === "rejected")
          expect(r.reason).toMatchObject({ name: "SesionInvalidaError" });
      }
      const { rows } = await pool.query(
        "SELECT count(*)::int AS n FROM sesiones WHERE revocado_en IS NULL",
      );
      expect(rows[0].n).toBe(1);
    });
  });

  describe("jornada", () => {
    it("guardar es idempotente por id y conserva ambas horas", async () => {
      const repo = new PgRegistroJornadaRepository(pool);
      const registro = {
        id: "d0000000-0000-4000-8000-000000000001",
        operarioId: OPERARIO,
        tipo: "entrada_centro" as const,
        centroTrabajoId: CENTRO,
        capturadoEn: "2026-11-03T12:00:00.000Z",
        recibidoEn: "2026-11-03T15:30:00.000Z",
      };
      await repo.guardar(registro);
      await repo.guardar(registro);

      const lista = await repo.listar({
        fecha: "2026-11-03",
        operarioId: OPERARIO,
      });
      expect(lista).toHaveLength(1);
      expect(lista[0]?.capturadoEn).toBe(registro.capturadoEn);
      expect(lista[0]?.recibidoEn).toBe(registro.recibidoEn);
    });
  });

  describe("tiempo y orden (hallazgos 5 y 6)", () => {
    it("listar jornada agrupa por el día de Bogotá, no por el de UTC", async () => {
      const repo = new PgRegistroJornadaRepository(pool);
      await repo.guardar({
        id: "d0000000-0000-4000-8000-000000000002",
        operarioId: OPERARIO,
        tipo: "salida_centro",
        centroTrabajoId: CENTRO,
        capturadoEn: "2026-11-04T00:30:00.000Z", // 19:30 del 3 de noviembre en Bogotá
        recibidoEn: "2026-11-04T00:31:00.000Z",
      });

      expect(await repo.listar({ fecha: "2026-11-03" })).toHaveLength(1);
      expect(await repo.listar({ fecha: "2026-11-04" })).toHaveLength(0);
    });

    it("sin semana, la programación publicada de respaldo es la más reciente", async () => {
      await pool.query("DELETE FROM asignaciones");
      await pool.query("DELETE FROM programaciones_semanales");
      const semanas = [
        "2026-09-07",
        "2026-10-19",
        "2026-10-05",
        "2026-08-03",
        "2026-09-21",
      ];
      for (const [i, semana] of semanas.entries()) {
        const programacion = `a1000000-0000-4000-8000-00000000000${i}`;
        await pool.query(
          "INSERT INTO programaciones_semanales (id, semana_inicio, estado) VALUES ($1, $2, 'publicada')",
          [programacion, semana],
        );
        await pool.query(
          "INSERT INTO asignaciones (id, programacion_id, operario_id, centro_trabajo_id, fecha) VALUES ($1, $2, $3, $4, $5)",
          [
            `a2000000-0000-4000-8000-00000000000${i}`,
            programacion,
            OPERARIO,
            CENTRO,
            semana,
          ],
        );
      }

      const repo = new PgProgramacionRepository(pool);
      expect(
        (await repo.buscarPublicadaParaOperario(OPERARIO))?.semanaInicio,
      ).toBe("2026-10-19");
    });
  });

  describe("evidencias", () => {
    const evidencia = {
      id: "e0000000-0000-4000-8000-000000000001",
      actividadId: ACTIVIDAD,
      operarioId: OPERARIO,
      tipo: "antes" as const,
      capturadaEn: "2026-11-03T09:00:00.000Z",
      recibidaEn: "2026-11-03T14:00:00.000Z",
      tipoMime: "image/jpeg" as const,
      tamanoBytes: 1234,
      fotoRuta: "e0000000-0000-4000-8000-000000000001.jpg",
    };

    it("guardar dos veces el mismo id no duplica y conserva la primera copia", async () => {
      const repo = new PgEvidenciaRepository(pool);
      await repo.guardar(evidencia);
      await repo.guardar({ ...evidencia, tamanoBytes: 9999 });

      expect(await repo.listarPorActividadId(ACTIVIDAD)).toHaveLength(1);
      expect((await repo.buscarPorId(evidencia.id))?.tamanoBytes).toBe(1234);
    });

    it("agrupa por actividad y respeta las dos horas", async () => {
      const repo = new PgEvidenciaRepository(pool);
      await repo.guardar(evidencia);

      const porActividad = await repo.listarPorActividadesIds([ACTIVIDAD]);
      expect(porActividad.get(ACTIVIDAD)?.[0]?.capturadaEn).toBe(
        evidencia.capturadaEn,
      );
      expect(porActividad.get(ACTIVIDAD)?.[0]?.recibidaEn).toBe(
        evidencia.recibidaEn,
      );
    });

    it("una evidencia exige una actividad existente", async () => {
      const repo = new PgEvidenciaRepository(pool);
      await expect(
        repo.guardar({
          ...evidencia,
          actividadId: "f0000000-0000-4000-8000-000000000009",
        }),
      ).rejects.toThrow();
    });
  });

  describe("revisiones", () => {
    it("hay una sola revisión por actividad y la última decisión prevalece", async () => {
      const repo = new PgRevisionRepository(pool);
      await repo.guardar({
        actividadId: ACTIVIDAD,
        supervisorId: SUPERVISOR,
        resultado: "rechazada",
        observacion: "Falta el después",
        revisadaEn: "2026-11-03T18:00:00.000Z",
      });
      await repo.guardar({
        actividadId: ACTIVIDAD,
        supervisorId: SUPERVISOR,
        resultado: "aprobada",
        revisadaEn: "2026-11-04T08:00:00.000Z",
      });

      const { rows } = await pool.query(
        "SELECT count(*)::int AS n FROM revisiones WHERE actividad_id = $1",
        [ACTIVIDAD],
      );
      expect(rows[0].n).toBe(1);
      expect((await repo.buscarPorActividadId(ACTIVIDAD))?.resultado).toBe(
        "aprobada",
      );
    });
  });
});
