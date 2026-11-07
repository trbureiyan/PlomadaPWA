import { describe, expect, it } from "vitest";
import { RegistrarJornadaUseCase } from "./application/registrar-jornada.use-case";
import { ListarRegistrosJornadaUseCase } from "./application/listar-registros-jornada.use-case";
import { InMemoryRegistroJornadaRepository } from "./infrastructure/persistence/in-memory-registro-jornada.repository";
import {
  ActividadAjenaError,
  ActividadNoEncontradaError,
  CentroNoEncontradoError,
  RegistroJornadaConflictoError,
} from "./domain/errores";
import { InMemoryConsultaProgramacion } from "../programacion";

describe("Módulo Jornada", () => {
  const repo = new InMemoryRegistroJornadaRepository();
  const programacion = new InMemoryConsultaProgramacion();
  programacion.agregarCentro("cen-1");
  programacion.agregarActividad("act-1", "op-1");
  const registrarJornada = new RegistrarJornadaUseCase(repo, programacion);
  const listarJornada = new ListarRegistrosJornadaUseCase(repo);

  it("registra entrada al centro de trabajo con hora capturada y recibida", async () => {
    const res = await registrarJornada.ejecutar("jor-1", "op-1", {
      tipo: "entrada_centro",
      centroTrabajoId: "cen-1",
      capturadoEn: "2026-11-03T07:55:00Z",
    });

    expect(res.esNuevo).toBe(true);
    expect(res.registro.id).toBe("jor-1");
    expect(res.registro.tipo).toBe("entrada_centro");
    expect(res.registro.capturadoEn).toBe("2026-11-03T07:55:00Z");
    expect(res.registro.recibidoEn).toBeDefined();
  });

  it("idempotencia: reintentar con el mismo contenido devuelve 200 sin duplicar", async () => {
    const res = await registrarJornada.ejecutar("jor-1", "op-1", {
      tipo: "entrada_centro",
      centroTrabajoId: "cen-1",
      capturadoEn: "2026-11-03T07:55:00Z",
    });

    expect(res.esNuevo).toBe(false);
    expect(res.registro.id).toBe("jor-1");
  });

  it("idempotencia: reintentar con el mismo id pero contenido diferente arroja conflicto", async () => {
    await expect(
      registrarJornada.ejecutar("jor-1", "op-1", {
        tipo: "salida_centro",
        centroTrabajoId: "cen-1",
        capturadoEn: "2026-11-03T17:00:00Z",
      }),
    ).rejects.toThrow(RegistroJornadaConflictoError);
  });

  it("registra inicio de actividad y lista los eventos del día", async () => {
    await registrarJornada.ejecutar("jor-2", "op-1", {
      tipo: "inicio_actividad",
      actividadId: "act-1",
      capturadoEn: "2026-11-03T08:00:00Z",
    });

    const listado = await listarJornada.ejecutar({
      fecha: "2026-11-03",
      operarioId: "op-1",
    });

    expect(listado.length).toBe(2);
    expect(listado.some((r) => r.tipo === "entrada_centro")).toBe(true);
    expect(listado.some((r) => r.tipo === "inicio_actividad")).toBe(true);
  });

  it("lista por el día de Bogotá: un evento a las 19:30 locales no pasa al día siguiente", async () => {
    // 2026-11-04T00:30:00Z son las 19:30 del 3 de noviembre en Bogotá.
    await registrarJornada.ejecutar("jor-noche", "op-1", {
      tipo: "salida_centro",
      centroTrabajoId: "cen-1",
      capturadoEn: "2026-11-04T00:30:00Z",
    });

    const del3 = await listarJornada.ejecutar({ fecha: "2026-11-03", operarioId: "op-1" });
    const del4 = await listarJornada.ejecutar({ fecha: "2026-11-04", operarioId: "op-1" });
    expect(del3.some((r) => r.id === "jor-noche")).toBe(true);
    expect(del4.some((r) => r.id === "jor-noche")).toBe(false);
  });

  it("idempotencia: el reintento con el mismo instante escrito sin milisegundos es el mismo registro", async () => {
    // Postgres devuelve el instante como "...:00.000Z" aunque el cliente lo mande como "...:00Z".
    await repo.guardar({
      id: "jor-ms",
      operarioId: "op-1",
      tipo: "entrada_centro",
      centroTrabajoId: "cen-1",
      capturadoEn: "2026-11-04T13:05:00.000Z",
      recibidoEn: "2026-11-04T13:06:00.000Z",
    });

    const res = await registrarJornada.ejecutar("jor-ms", "op-1", {
      tipo: "entrada_centro",
      centroTrabajoId: "cen-1",
      capturadoEn: "2026-11-04T13:05:00Z",
    });
    expect(res.esNuevo).toBe(false);
  });

  describe("propiedad de la actividad y existencia del centro", () => {
    it("rechaza una actividad asignada a otro operario y no guarda nada", async () => {
      await expect(
        registrarJornada.ejecutar("jor-ajena", "op-2", {
          tipo: "inicio_actividad",
          actividadId: "act-1",
          capturadoEn: "2026-11-03T08:00:00Z",
        }),
      ).rejects.toThrow(ActividadAjenaError);
      expect(await repo.buscarPorId("jor-ajena")).toBeNull();
    });

    it("rechaza una actividad inexistente", async () => {
      await expect(
        registrarJornada.ejecutar("jor-x", "op-1", {
          tipo: "fin_actividad",
          actividadId: "no-existe",
          capturadoEn: "2026-11-03T09:00:00Z",
        }),
      ).rejects.toThrow(ActividadNoEncontradaError);
      expect(await repo.buscarPorId("jor-x")).toBeNull();
    });

    it("rechaza un centro de trabajo inexistente", async () => {
      await expect(
        registrarJornada.ejecutar("jor-y", "op-1", {
          tipo: "entrada_centro",
          centroTrabajoId: "no-existe",
          capturadoEn: "2026-11-03T07:00:00Z",
        }),
      ).rejects.toThrow(CentroNoEncontradoError);
      expect(await repo.buscarPorId("jor-y")).toBeNull();
    });

    it("el reintento idéntico de un registro ya guardado sigue devolviendo 200", async () => {
      const res = await registrarJornada.ejecutar("jor-2", "op-1", {
        tipo: "inicio_actividad",
        actividadId: "act-1",
        capturadoEn: "2026-11-03T08:00:00Z",
      });
      expect(res.esNuevo).toBe(false);
    });
  });
});
