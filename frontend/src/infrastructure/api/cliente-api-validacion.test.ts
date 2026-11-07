import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "../storage/dexie-db";
import { clienteApi, peticionApi } from "./cliente-api";
import { motorSincronizacion } from "../../services/motor-sincronizacion";
import { rutas } from "@plomada/shared";

describe("C-4: Validar las respuestas con los esquemas del contrato", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.colaSincronizacion.clear();
    await db.evidenciasLocales.clear();
    await db.registrosJornadaLocales.clear();
    await db.sesion.clear();
    motorSincronizacion.setEnLinea(false);
  });

  it("rechaza respuesta 200 con JSON vacío '{}' o basura y conserva la evidencia en la cola (C-4)", async () => {
    // 1. Operario registra una evidencia
    const ev = await motorSincronizacion.registrarEvidencia({
      actividadId: "act-123",
      operarioId: "op-1",
      tipo: "antes",
      blob: new Blob(["foto-prueba"], { type: "image/jpeg" }),
      tamanoBytes: 11,
    });

    // 2. El servidor o proxy wifi responde 200 OK con JSON basura
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => ({ basura: true, foo: "bar" }),
      text: async () => JSON.stringify({ basura: true, foo: "bar" }),
    } as unknown as Response);

    motorSincronizacion.setEnLinea(true);
    await motorSincronizacion.sincronizarCola();

    // 3. El elemento NO debe borrarse de la cola porque la respuesta no cumplió el esquema de Evidencia
    const cola = await db.colaSincronizacion.toArray();
    expect(cola).toHaveLength(1);
    expect(cola[0].recursoId).toBe(ev.id);

    // La evidencia local no debe marcarse como sincronizada
    const evLocal = await db.evidenciasLocales.get(ev.id);
    expect(evLocal?.estadoSincronizacion).not.toBe("sincronizado");
  });

  it("rechaza respuesta 200 con HTML (portal cautivo wifi) y conserva el elemento en cola (C-4)", async () => {
    // 1. Operario registra una evidencia
    const ev = await motorSincronizacion.registrarEvidencia({
      actividadId: "act-123",
      operarioId: "op-1",
      tipo: "durante",
      blob: new Blob(["foto-prueba"], { type: "image/jpeg" }),
      tamanoBytes: 11,
    });

    // 2. Portal cautivo devuelve 200 OK con HTML
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "text/html" }),
      json: async () => {
        throw new SyntaxError("Unexpected token '<', '<!DOCTYPE '... is not valid JSON");
      },
      text: async () => "<!DOCTYPE html><html><body>Inicie sesión en la red</body></html>",
    } as unknown as Response);

    motorSincronizacion.setEnLinea(true);
    await motorSincronizacion.sincronizarCola();

    // 3. El elemento debe conservarse en cola para reintentar cuando haya internet real
    const cola = await db.colaSincronizacion.toArray();
    expect(cola).toHaveLength(1);
    expect(cola[0].recursoId).toBe(ev.id);
  });

  it("peticionApi lanza error transitorio cuando el JSON no cumple el esquema de rutas.*.respuesta", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => ({ datos_inventados: 123 }),
    } as unknown as Response);

    await expect(
      peticionApi(
        "/registros-jornada/123",
        {},
        true,
        rutas.registrarJornada.respuesta,
      ),
    ).rejects.toThrow(/esquema del contrato|no válida/i);
  });

  it("peticionApi acepta y devuelve los datos cuando cumplen estrictamente el esquema", async () => {
    const jornadaValida = {
      id: "7b47e24a-718e-4a69-8086-bfd4b97d8481",
      operarioId: "e7fb021d-92a5-4e78-be7f-947f6ff6ba14",
      tipo: "entrada_centro",
      centroTrabajoId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
      capturadoEn: "2026-11-06T10:00:00.000Z",
      recibidoEn: "2026-11-06T10:05:00.000Z",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => jornadaValida,
    } as unknown as Response);

    const resultado = await peticionApi(
      "/registros-jornada/7b47e24a-718e-4a69-8086-bfd4b97d8481",
      {},
      true,
      rutas.registrarJornada.respuesta,
    );

    expect(resultado).toEqual(jornadaValida);
  });
});
