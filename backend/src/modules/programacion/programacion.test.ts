import { afterEach, describe, expect, it, vi } from "vitest";
import { derivarEstado } from "./domain/estado-actividad";
import { CrearCentroTrabajoUseCase } from "./application/crear-centro-trabajo.use-case";
import { CrearProgramacionUseCase } from "./application/crear-programacion.use-case";
import { PublicarProgramacionUseCase } from "./application/publicar-programacion.use-case";
import { ObtenerProgramacionUseCase } from "./application/obtener-programacion.use-case";
import { ObtenerMiProgramacionUseCase } from "./application/obtener-mi-programacion.use-case";
import { InMemoryCentroTrabajoRepository } from "./infrastructure/persistence/in-memory-centro-trabajo.repository";
import { InMemoryProgramacionRepository } from "./infrastructure/persistence/in-memory-programacion.repository";
import { InMemoryNotificadorProgramacion } from "./infrastructure/mail/in-memory-notificador-programacion";
import type { HechosDeActividadPort } from "./application/ports/hechos-de-actividad.port";
import { ProgramacionSemanalExistenteError } from "./domain/errores";

describe("Módulo Programación", () => {
  describe("derivarEstado (función pura de dominio)", () => {
    it("devuelve 'pendiente' si no existen hechos", () => {
      expect(derivarEstado({})).toBe("pendiente");
      expect(derivarEstado({ evidencias: [] })).toBe("pendiente");
    });

    it("devuelve 'en_curso' si hay inicio de actividad o cualquier evidencia antes/durante", () => {
      expect(derivarEstado({ tieneInicio: true })).toBe("en_curso");
      expect(derivarEstado({ evidencias: [{ tipo: "antes" }] })).toBe("en_curso");
      expect(derivarEstado({ evidencias: [{ tipo: "durante" }] })).toBe("en_curso");
    });

    it("devuelve 'finalizada' si hay fin de actividad o evidencia de tipo despues", () => {
      expect(derivarEstado({ tieneFin: true })).toBe("finalizada");
      expect(derivarEstado({ evidencias: [{ tipo: "despues" }] })).toBe("finalizada");
    });

    it("deriva correctamente sin importar orden de llegada (hechos fuera de orden)", () => {
      // Llega foto despues antes que antes
      expect(derivarEstado({ evidencias: [{ tipo: "despues" }] })).toBe("finalizada");
      // Llegan ambas
      expect(derivarEstado({ evidencias: [{ tipo: "despues" }, { tipo: "antes" }] })).toBe("finalizada");
    });

    it("la revisión aprobada o rechazada prevalece sobre los demás hechos", () => {
      expect(
        derivarEstado({
          tieneInicio: true,
          tieneFin: true,
          evidencias: [{ tipo: "despues" }],
          revision: { resultado: "aprobada" },
        }),
      ).toBe("aprobada");

      expect(
        derivarEstado({
          evidencias: [{ tipo: "despues" }],
          revision: { resultado: "rechazada" },
        }),
      ).toBe("rechazada");
    });
  });

  describe("Casos de uso de programación", () => {
    const centroRepo = new InMemoryCentroTrabajoRepository();
    const programacionRepo = new InMemoryProgramacionRepository();
    const notificador = new InMemoryNotificadorProgramacion();

    const mockHechosPort: HechosDeActividadPort = {
      async obtenerHechosPorActividadId() {
        return {};
      },
      async obtenerHechosPorActividadesIds(ids) {
        return new Map(ids.map((id) => [id, {}]));
      },
    };

    const crearCentro = new CrearCentroTrabajoUseCase(centroRepo);
    const obtenerProg = new ObtenerProgramacionUseCase(programacionRepo, centroRepo, mockHechosPort);
    const crearProg = new CrearProgramacionUseCase(programacionRepo, centroRepo);
    const publicarProg = new PublicarProgramacionUseCase(
      programacionRepo,
      obtenerProg,
      notificador,
      async () =>
        new Map([
          ["11111111-1111-1111-1111-111111111111", { id: "11111111-1111-1111-1111-111111111111", nombre: "Operario Uno", correo: "op1@plomada.local" }],
        ]),
    );
    const obtenerMiProg = new ObtenerMiProgramacionUseCase(programacionRepo, obtenerProg);

    it("crea centro de trabajo y una programación semanal", async () => {
      const centro = await crearCentro.ejecutar({
        nombre: "Conjunto Los Robles",
        direccion: "Calle 10 # 5-20",
      });

      const semanaLunes = "2026-11-02"; // Lunes
      const prog = await crearProg.ejecutar({
        semanaInicio: semanaLunes,
        asignaciones: [
          {
            operarioId: "11111111-1111-1111-1111-111111111111",
            centroTrabajoId: centro.id,
            fecha: "2026-11-03",
            actividades: [{ descripcion: "Mantenimiento motobomba piscina" }],
          },
        ],
      });

      expect(prog.id).toBeDefined();
      expect(prog.estado).toBe("borrador");
      expect(prog.asignaciones.length).toBe(1);
      expect(prog.asignaciones[0].actividades[0].estado).toBe("pendiente");

      // No debe permitir crear otra programación para el mismo lunes
      await expect(
        crearProg.ejecutar({
          semanaInicio: semanaLunes,
          asignaciones: [],
        }),
      ).rejects.toThrow(ProgramacionSemanalExistenteError);
    });

    it("publica la programación, dispara correo y responde de forma idempotente", async () => {
      const listado = await programacionRepo.listar();
      const prog = listado[0];

      const publicada = await publicarProg.ejecutar(prog.id);
      expect(publicada.estado).toBe("publicada");
      expect(publicada.publicadaEn).toBeDefined();

      // Correo despachado
      expect(notificador.notificacionesEnviadas.length).toBe(1);
      expect(notificador.notificacionesEnviadas[0].correo).toBe("op1@plomada.local");

      // Segunda llamada: devuelve la misma programación sin enviar correos duplicados
      notificador.limpiar();
      const repub = await publicarProg.ejecutar(prog.id);
      expect(repub.estado).toBe("publicada");
      expect(notificador.notificacionesEnviadas.length).toBe(0);
    });

    it("permite a un operario consultar su propia programación publicada", async () => {
      const miProg = await obtenerMiProg.ejecutar("11111111-1111-1111-1111-111111111111", {
        semanaInicio: "2026-11-02",
      });

      expect(miProg.semanaInicio).toBe("2026-11-02");
      expect(miProg.asignaciones.length).toBe(1);
      expect(miProg.asignaciones[0].centroTrabajo.nombre).toBe("Conjunto Los Robles");
      expect(miProg.asignaciones[0].actividades[0].descripcion).toBe("Mantenimiento motobomba piscina");
    });

    describe("semana en curso y semana de respaldo", () => {
      const OPERARIO = "22222222-2222-2222-2222-222222222222";
      const publicada = (id: string, semanaInicio: string) => ({
        id,
        semanaInicio,
        estado: "publicada" as const,
        publicadaEn: "2026-10-01T12:00:00Z",
        asignaciones: [
          { id: `${id}-a`, operarioId: OPERARIO, centroTrabajoId: "c", fecha: semanaInicio, actividades: [] },
        ],
      });

      afterEach(() => vi.useRealTimers());

      it("el domingo a las 20:00 de Bogotá la semana en curso sigue siendo la que termina", async () => {
        const repo = new InMemoryProgramacionRepository();
        await repo.guardar(publicada("p-actual", "2026-11-02"));
        await repo.guardar(publicada("p-siguiente", "2026-11-09"));
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-09T01:00:00Z")); // domingo 8, 20:00 en Bogotá

        const casoDeUso = new ObtenerMiProgramacionUseCase(repo, obtenerProg);
        expect((await casoDeUso.ejecutar(OPERARIO)).semanaInicio).toBe("2026-11-02");
      });

      it("sin programación en la semana en curso entrega la publicada más reciente, no una cualquiera", async () => {
        const repo = new InMemoryProgramacionRepository();
        await repo.guardar(publicada("p-vieja", "2026-09-07"));
        await repo.guardar(publicada("p-reciente", "2026-10-19"));
        await repo.guardar(publicada("p-intermedia", "2026-10-05"));
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T15:00:00Z"));

        const casoDeUso = new ObtenerMiProgramacionUseCase(repo, obtenerProg);
        expect((await casoDeUso.ejecutar(OPERARIO)).semanaInicio).toBe("2026-10-19");
      });
    });
  });
});
