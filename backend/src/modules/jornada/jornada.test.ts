import { describe, expect, it } from "vitest";
import { RegistrarJornadaUseCase } from "./application/registrar-jornada.use-case";
import { ListarRegistrosJornadaUseCase } from "./application/listar-registros-jornada.use-case";
import { InMemoryRegistroJornadaRepository } from "./infrastructure/persistence/in-memory-registro-jornada.repository";
import { RegistroJornadaConflictoError } from "./domain/errores";

describe("Módulo Jornada", () => {
  const repo = new InMemoryRegistroJornadaRepository();
  const registrarJornada = new RegistrarJornadaUseCase(repo);
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
});
