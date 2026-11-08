import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "../infrastructure/storage/dexie-db";
import { clienteApi } from "../infrastructure/api/cliente-api";
import { motorSincronizacion } from "./motor-sincronizacion";

describe("C-2: Orden de envío: la jornada antes que las fotos (D6)", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.colaSincronizacion.clear();
    await db.evidenciasLocales.clear();
    await db.registrosJornadaLocales.clear();
    await db.sesion.clear();
    motorSincronizacion.setEnLinea(false); // Modo sin conexión mientras se captura
  });

  it("despacha las peticiones en orden 'jornada, foto, foto, foto' aunque se capturen en orden 'foto, jornada, foto, foto'", async () => {
    // 1. Simular captura offline en el orden exacto del reporte: foto, jornada, foto, foto
    const foto1 = await motorSincronizacion.registrarEvidencia({
      actividadId: "act-1",
      operarioId: "op-1",
      tipo: "antes",
      blob: new Blob(["foto-1"], { type: "image/jpeg" }),
      tamanoBytes: 6,
    });

    const jornada1 = await motorSincronizacion.registrarJornada("op-1", {
      tipo: "entrada_centro",
      centroTrabajoId: "ct-1",
      capturadoEn: new Date(Date.now() + 1000).toISOString(),
    });

    const foto2 = await motorSincronizacion.registrarEvidencia({
      actividadId: "act-1",
      operarioId: "op-1",
      tipo: "durante",
      blob: new Blob(["foto-2"], { type: "image/jpeg" }),
      tamanoBytes: 6,
    });

    const foto3 = await motorSincronizacion.registrarEvidencia({
      actividadId: "act-1",
      operarioId: "op-1",
      tipo: "despues",
      blob: new Blob(["foto-3"], { type: "image/jpeg" }),
      tamanoBytes: 6,
    });

    // 2. Registrar el orden real de las peticiones HTTP que llegan al servidor
    const peticionesEnviadas: Array<{
      tipo: "jornada" | "evidencia";
      recursoId: string;
    }> = [];

    vi.spyOn(clienteApi, "subirRegistroJornada").mockImplementation(
      async (id) => {
        peticionesEnviadas.push({ tipo: "jornada", recursoId: id });
        return {
          id,
          operarioId: "op-1",
          tipo: "entrada_centro",
          centroTrabajoId: "ct-1",
          capturadoEn: new Date().toISOString(),
          recibidoEn: new Date().toISOString(),
        };
      },
    );

    vi.spyOn(clienteApi, "subirEvidencia").mockImplementation(
      async (id, actividadId, tipo) => {
        peticionesEnviadas.push({ tipo: "evidencia", recursoId: id });
        return {
          id,
          actividadId,
          tipo,
          capturadaEn: new Date().toISOString(),
          recibidaEn: new Date().toISOString(),
          operarioId: "op-1",
          tipoMime: "image/jpeg",
          fotoUrl: `/evidencias/${id}/foto`,
          tamanoBytes: 6,
        };
      },
    );

    // 3. Volver en línea y sincronizar la cola
    motorSincronizacion.setEnLinea(true);
    await motorSincronizacion.sincronizarCola();

    // 4. Verificar que se enviaron los 4 elementos
    expect(peticionesEnviadas).toHaveLength(4);

    // 5. El contrato exige estrictamente: primero la jornada, luego las evidencias
    const tiposEnviados = peticionesEnviadas.map((p) => p.tipo);
    expect(tiposEnviados).toEqual([
      "jornada",
      "evidencia",
      "evidencia",
      "evidencia",
    ]);

    // 6. Verificar el orden específico por ID de recurso:
    // Primero jornada1, luego foto1, foto2 y foto3 en su orden de captura
    const idsEnviados = peticionesEnviadas.map((p) => p.recursoId);
    expect(idsEnviados).toEqual([jornada1.id, foto1.id, foto2.id, foto3.id]);
  });

  it("mantiene orden estricto de captura para múltiples jornadas seguidas de múltiples fotos", async () => {
    // 2 jornadas y 2 fotos capturadas intercaladas
    const foto1 = await motorSincronizacion.registrarEvidencia({
      actividadId: "act-1",
      operarioId: "op-1",
      tipo: "antes",
      blob: new Blob(["foto-1"], { type: "image/jpeg" }),
      tamanoBytes: 6,
    });

    const jornadaEntrada = await motorSincronizacion.registrarJornada("op-1", {
      tipo: "entrada_centro",
      centroTrabajoId: "ct-1",
      capturadoEn: new Date(Date.now() + 60_000).toISOString(),
    });

    const foto2 = await motorSincronizacion.registrarEvidencia({
      actividadId: "act-1",
      operarioId: "op-1",
      tipo: "despues",
      blob: new Blob(["foto-2"], { type: "image/jpeg" }),
      tamanoBytes: 6,
    });

    const jornadaSalida = await motorSincronizacion.registrarJornada("op-1", {
      tipo: "salida_centro",
      centroTrabajoId: "ct-1",
      capturadoEn: new Date(Date.now() + 120_000).toISOString(),
    });

    const ordenLlegada: string[] = [];

    vi.spyOn(clienteApi, "subirRegistroJornada").mockImplementation(
      async (id, req) => {
        ordenLlegada.push(`jornada:${req.tipo}`);
        return {
          id,
          operarioId: "op-1",
          tipo: "entrada_centro",
          centroTrabajoId: "ct-1",
          capturadoEn: req.capturadoEn,
          recibidoEn: new Date().toISOString(),
        };
      },
    );

    vi.spyOn(clienteApi, "subirEvidencia").mockImplementation(
      async (id, actividadId, tipo, capturadaEn) => {
        ordenLlegada.push(`evidencia:${tipo}`);
        return {
          id,
          operarioId: "op-1",
          actividadId,
          tipo,
          capturadaEn,
          recibidaEn: new Date().toISOString(),
          tipoMime: "image/jpeg",
          tamanoBytes: 6,
          fotoUrl: `/evidencias/${id}/foto`,
        };
      },
    );

    motorSincronizacion.setEnLinea(true);
    await motorSincronizacion.sincronizarCola();

    // Las jornadas salen primero por orden de captura, luego las fotos
    expect(ordenLlegada).toEqual([
      "jornada:entrada_centro",
      "jornada:salida_centro",
      "evidencia:antes",
      "evidencia:despues",
    ]);
  });
});
