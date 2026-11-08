import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "../infrastructure/storage/dexie-db";
import { motorSincronizacion } from "./motor-sincronizacion";
import { clienteApi, ApiError } from "../infrastructure/api/cliente-api";

describe("C-3: Avisar al operario de lo que falló - D7", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.colaSincronizacion.clear();
    await db.evidenciasLocales.clear();
    await db.registrosJornadaLocales.clear();
    await db.sesion.clear();
    motorSincronizacion.limpiarTemporizador();
    motorSincronizacion.setEnLinea(false);
  });

  it("conserva elementos con error en la cola y distingue pendientes vs fallidos en obtenerEstado()", async () => {
    // 1. Operario registra una jornada y una evidencia
    const j = await motorSincronizacion.registrarJornada("op-1", {
      tipo: "entrada_centro",
      centroTrabajoId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
      capturadoEn: "2026-11-06T10:00:00.000Z",
    });

    const ev = await motorSincronizacion.registrarEvidencia({
      actividadId: "act-1",
      operarioId: "op-1",
      tipo: "antes",
      blob: new Blob(["foto-prueba"], { type: "image/jpeg" }),
      tamanoBytes: 100,
    });

    // En este punto, hay 2 pendientes y 0 fallidos
    let estado = await motorSincronizacion.obtenerEstado();
    expect(estado.elementosPendientes).toBe(2);
    expect(estado.elementosFallidos).toBe(0);

    // 2. Simular que la jornada falla con 422 y la evidencia con 413
    vi.spyOn(clienteApi, "subirRegistroJornada").mockRejectedValueOnce(
      new ApiError(422, "validacion", {
        mensaje: "Actividad fuera de horario",
      }),
    );
    vi.spyOn(clienteApi, "subirEvidencia").mockRejectedValueOnce(
      new ApiError(413, "tamano_excedido", { mensaje: "Foto supera límite" }),
    );

    motorSincronizacion.setEnLinea(true);
    await motorSincronizacion.sincronizarCola();

    // 3. Los elementos NO deben borrarse de colaSincronizacion (regla C-1 / C-3)
    const cola = await db.colaSincronizacion.toArray();
    expect(cola).toHaveLength(2);
    expect(cola.every((el) => el.estado === "fallido")).toBe(true);

    // 4. Los registros locales deben tener estadoSincronizacion: "error"
    const jLocal = await db.registrosJornadaLocales.get(j.id);
    expect(jLocal?.estadoSincronizacion).toBe("error");
    expect(jLocal?.errorDetalle).toContain("Actividad fuera de horario");

    const evLocal = await db.evidenciasLocales.get(ev.id);
    expect(evLocal?.estadoSincronizacion).toBe("error");
    expect(evLocal?.errorDetalle).toContain("Foto supera límite");

    // 5. obtenerEstado() debe distinguir pendientes (0) y fallidos (2)
    estado = await motorSincronizacion.obtenerEstado();
    expect(estado.elementosPendientes).toBe(0);
    expect(estado.elementosFallidos).toBe(2);
  });

  it("omite elementos con error durante el ciclo automático de sincronización", async () => {
    const jId = "jornada-error-1";
    await db.registrosJornadaLocales.put({
      id: jId,
      operarioId: "op-1",
      solicitud: {
        tipo: "entrada_centro",
        centroTrabajoId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
        capturadoEn: "2026-11-06T10:00:00.000Z",
      },
      ocurridoEn: "2026-11-06T10:00:00.000Z",
      estadoSincronizacion: "error",
      errorDetalle: "Error de validación (422)",
    });

    await db.colaSincronizacion.put({
      id: "cola-1",
      tipo: "jornada",
      recursoId: jId,
      intentos: 1,
      ultimoError: "Error de validación (422)",
      creadoEn: "2026-11-06T10:00:00.000Z",
      estado: "fallido",
    });

    const spySubir = vi.spyOn(clienteApi, "subirRegistroJornada");

    motorSincronizacion.setEnLinea(true);
    await motorSincronizacion.sincronizarCola();

    expect(spySubir).not.toHaveBeenCalled();
  });

  it("reintentarElemento reintenta la sincronización y la completa si el servidor responde OK", async () => {
    const jId = "jornada-reintento-1";
    await db.registrosJornadaLocales.put({
      id: jId,
      operarioId: "op-1",
      solicitud: {
        tipo: "entrada_centro",
        centroTrabajoId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
        capturadoEn: "2026-11-06T10:00:00.000Z",
      },
      ocurridoEn: "2026-11-06T10:00:00.000Z",
      estadoSincronizacion: "error",
      errorDetalle: "Error previo",
    });

    await db.colaSincronizacion.put({
      id: "cola-2",
      tipo: "jornada",
      recursoId: jId,
      intentos: 1,
      ultimoError: "Error previo",
      creadoEn: "2026-11-06T10:00:00.000Z",
      estado: "fallido",
    });

    vi.spyOn(clienteApi, "subirRegistroJornada").mockResolvedValueOnce({
      id: jId,
      operarioId: "op-1",
      tipo: "entrada_centro",
      centroTrabajoId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
      capturadoEn: "2026-11-06T10:00:00.000Z",
      recibidoEn: "2026-11-06T10:01:00.000Z",
    });

    motorSincronizacion.setEnLinea(true);
    await motorSincronizacion.reintentarElemento(jId, "jornada");

    const jLocal = await db.registrosJornadaLocales.get(jId);
    expect(jLocal?.estadoSincronizacion).toBe("sincronizado");

    const cola = await db.colaSincronizacion.toArray();
    expect(cola).toHaveLength(0);

    const estado = await motorSincronizacion.obtenerEstado();
    expect(estado.elementosPendientes).toBe(0);
    expect(estado.elementosFallidos).toBe(0);
  });

  it("descartarElemento elimina el elemento de la cola y del almacenamiento local", async () => {
    const evId = "ev-descartar-1";
    await db.evidenciasLocales.put({
      id: evId,
      actividadId: "act-1",
      operarioId: "op-1",
      tipo: "durante",
      capturadaEn: "2026-11-06T10:00:00.000Z",
      blob: new Blob(["foto"]),
      tipoMime: "image/jpeg",
      tamanoBytes: 50,
      estadoSincronizacion: "error",
      errorDetalle: "Error 413 tamano_excedido",
    });

    await db.colaSincronizacion.put({
      id: "cola-3",
      tipo: "evidencia",
      recursoId: evId,
      intentos: 1,
      ultimoError: "Error 413",
      creadoEn: "2026-11-06T10:00:00.000Z",
      estado: "fallido",
    });

    let estado = await motorSincronizacion.obtenerEstado();
    expect(estado.elementosFallidos).toBe(1);

    await motorSincronizacion.descartarElemento(evId, "evidencia");

    const cola = await db.colaSincronizacion.toArray();
    expect(cola).toHaveLength(0);

    const evLocal = await db.evidenciasLocales.get(evId);
    expect(evLocal).toBeUndefined();

    estado = await motorSincronizacion.obtenerEstado();
    expect(estado.elementosFallidos).toBe(0);
    expect(estado.elementosPendientes).toBe(0);
  });
});
