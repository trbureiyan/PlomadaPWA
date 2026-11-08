import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "../infrastructure/storage/dexie-db";
import { clienteApi, ApiError } from "../infrastructure/api/cliente-api";
import { motorSincronizacion } from "./motor-sincronizacion";
import type {
  RegistroJornada,
  RegistroJornadaSolicitud,
} from "@plomada/shared";

function crearRespuestaJornada(
  id: string,
  operarioId: string,
  solicitud: RegistroJornadaSolicitud,
): RegistroJornada {
  if (
    solicitud.tipo === "entrada_centro" ||
    solicitud.tipo === "salida_centro"
  ) {
    return {
      id,
      operarioId,
      tipo: solicitud.tipo,
      centroTrabajoId: solicitud.centroTrabajoId,
      capturadoEn: solicitud.capturadoEn,
      recibidoEn: new Date().toISOString(),
    };
  }
  return {
    id,
    operarioId,
    tipo: solicitud.tipo,
    actividadId: solicitud.actividadId,
    capturadoEn: solicitud.capturadoEn,
    recibidoEn: new Date().toISOString(),
  };
}

describe("C-6: Pruebas automatizadas del motor y C8 (D1, D6, D8)", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.colaSincronizacion.clear();
    await db.evidenciasLocales.clear();
    await db.registrosJornadaLocales.clear();
    await db.sesion.clear();
    motorSincronizacion.limpiarTemporizador();
    motorSincronizacion.setEnLinea(false);
  });

  it("1. Tres fotos sin conexión: encola 3 fotos sin red, restablece la conexión y llegan exactamente 3 al servidor (C8)", async () => {
    motorSincronizacion.setEnLinea(false);

    const f1 = await motorSincronizacion.registrarEvidencia({
      actividadId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
      operarioId: "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
      tipo: "antes",
      blob: new Blob(["foto-1"], { type: "image/jpeg" }),
      tamanoBytes: 100,
    });

    const f2 = await motorSincronizacion.registrarEvidencia({
      actividadId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
      operarioId: "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
      tipo: "durante",
      blob: new Blob(["foto-2"], { type: "image/jpeg" }),
      tamanoBytes: 120,
    });

    const f3 = await motorSincronizacion.registrarEvidencia({
      actividadId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
      operarioId: "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
      tipo: "despues",
      blob: new Blob(["foto-3"], { type: "image/jpeg" }),
      tamanoBytes: 150,
    });

    // Verificar que las 3 fotos están en cola offline
    const colaOffline = await db.colaSincronizacion.toArray();
    expect(colaOffline).toHaveLength(3);

    const fotosRecibidasEnServidor: string[] = [];
    vi.spyOn(clienteApi, "subirEvidencia").mockImplementation(
      async (id, actividadId, tipo, capturadaEn, archivoBlob) => {
        fotosRecibidasEnServidor.push(id);
        return {
          id,
          actividadId,
          tipo,
          capturadaEn,
          recibidaEn: new Date().toISOString(),
          operarioId: "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
          tipoMime: "image/jpeg",
          fotoUrl: `/evidencias/${id}/foto`,
          tamanoBytes: archivoBlob.size,
        };
      },
    );

    // Se restablece la red y se sincroniza la cola
    motorSincronizacion.setEnLinea(true);
    await motorSincronizacion.sincronizarCola();

    // Verificaciones C8: llegan exactamente las 3 fotos al servidor y la cola se vacía
    expect(fotosRecibidasEnServidor).toHaveLength(3);
    expect(fotosRecibidasEnServidor).toEqual([f1.id, f2.id, f3.id]);

    const colaFinal = await db.colaSincronizacion.toArray();
    expect(colaFinal).toHaveLength(0);

    const ev1 = await db.evidenciasLocales.get(f1.id);
    const ev2 = await db.evidenciasLocales.get(f2.id);
    const ev3 = await db.evidenciasLocales.get(f3.id);
    expect(ev1?.estadoSincronizacion).toBe("sincronizado");
    expect(ev2?.estadoSincronizacion).toBe("sincronizado");
    expect(ev3?.estadoSincronizacion).toBe("sincronizado");
  });

  it("2. Diez fallos de red seguidos y recuperación: tras 10 fallos consecutivos la foto llega y nunca se descarta", async () => {
    motorSincronizacion.setEnLinea(false);

    const ev = await motorSincronizacion.registrarEvidencia({
      actividadId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
      operarioId: "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
      tipo: "antes",
      blob: new Blob(["foto-persistente"], { type: "image/jpeg" }),
      tamanoBytes: 200,
    });

    let llamadasFallidas = 0;
    vi.spyOn(clienteApi, "subirEvidencia").mockImplementation(async () => {
      llamadasFallidas++;
      throw new Error("Fallo de red: Failed to fetch");
    });

    motorSincronizacion.setEnLinea(true);
    for (let i = 0; i < 10; i++) {
      await motorSincronizacion.sincronizarCola();
    }

    expect(llamadasFallidas).toBe(10);

    // Comprobar que NUNCA se descarta de la cola por fallos de red
    const colaTras10 = await db.colaSincronizacion.toArray();
    expect(colaTras10).toHaveLength(1);
    expect(colaTras10[0].recursoId).toBe(ev.id);
    expect(colaTras10[0].intentos).toBe(10);
    expect(colaTras10[0].ultimoError).toContain("Failed to fetch");

    // El archivo binario local permanece íntegro y disponible
    const evLocal = await db.evidenciasLocales.get(ev.id);
    expect(evLocal).toBeDefined();
    expect(evLocal?.tamanoBytes).toBe(200);

    // Recuperación de la red
    vi.spyOn(clienteApi, "subirEvidencia").mockResolvedValueOnce({
      id: ev.id,
      actividadId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
      tipo: "antes",
      capturadaEn: new Date().toISOString(),
      recibidaEn: new Date().toISOString(),
      operarioId: "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
      tipoMime: "image/jpeg",
      fotoUrl: `/evidencias/${ev.id}/foto`,
      tamanoBytes: 200,
    });

    await motorSincronizacion.sincronizarCola();

    // Ahora la cola queda vacía y el estado sincronizado
    const colaFinal = await db.colaSincronizacion.toArray();
    expect(colaFinal).toHaveLength(0);

    const evSincronizada = await db.evidenciasLocales.get(ev.id);
    expect(evSincronizada?.estadoSincronizacion).toBe("sincronizado");
  });

  it("3. Manejo de errores transitorios: códigos 503, 408 y 429 se reintentan correctamente y se conservan en la cola", async () => {
    motorSincronizacion.setEnLinea(false);

    const j = await motorSincronizacion.registrarJornada(
      "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
      {
        tipo: "entrada_centro",
        centroTrabajoId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
        capturadoEn: "2026-11-06T08:00:00.000Z",
      },
    );

    // 1. Simular 503
    vi.spyOn(clienteApi, "subirRegistroJornada").mockRejectedValueOnce(
      new ApiError(503, "servicio_no_disponible"),
    );
    motorSincronizacion.setEnLinea(true);
    await motorSincronizacion.sincronizarCola();

    let cola = await db.colaSincronizacion.toArray();
    expect(cola).toHaveLength(1);
    expect(cola[0].intentos).toBe(1);
    expect(cola[0].estado).not.toBe("fallido");

    // 2. Simular 408
    vi.spyOn(clienteApi, "subirRegistroJornada").mockRejectedValueOnce(
      new ApiError(408, "tiempo_espera_agotado"),
    );
    await motorSincronizacion.sincronizarCola();

    cola = await db.colaSincronizacion.toArray();
    expect(cola).toHaveLength(1);
    expect(cola[0].intentos).toBe(2);
    expect(cola[0].estado).not.toBe("fallido");

    // 3. Simular 429
    vi.spyOn(clienteApi, "subirRegistroJornada").mockRejectedValueOnce(
      new ApiError(429, "demasiadas_peticiones"),
    );
    await motorSincronizacion.sincronizarCola();

    cola = await db.colaSincronizacion.toArray();
    expect(cola).toHaveLength(1);
    expect(cola[0].intentos).toBe(3);
    expect(cola[0].estado).not.toBe("fallido");

    // 4. Reintento exitoso
    vi.spyOn(clienteApi, "subirRegistroJornada").mockResolvedValueOnce(
      crearRespuestaJornada(
        j.id,
        "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
        j.solicitud,
      ),
    );
    await motorSincronizacion.sincronizarCola();

    cola = await db.colaSincronizacion.toArray();
    expect(cola).toHaveLength(0);

    const jLocal = await db.registrosJornadaLocales.get(j.id);
    expect(jLocal?.estadoSincronizacion).toBe("sincronizado");
  });

  it("4. Manejo de errores definitivos: códigos 422 y 413 se marcan como fallidos de inmediato, el archivo se conserva y dejan de reintentarse solos", async () => {
    motorSincronizacion.setEnLinea(false);

    const j = await motorSincronizacion.registrarJornada(
      "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
      {
        tipo: "inicio_actividad",
        actividadId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
        capturadoEn: "2026-11-06T09:00:00.000Z",
      },
    );

    const ev = await motorSincronizacion.registrarEvidencia({
      actividadId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
      operarioId: "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
      tipo: "antes",
      blob: new Blob(["foto-pesada"], { type: "image/jpeg" }),
      tamanoBytes: 5_000_000,
    });

    vi.spyOn(clienteApi, "subirRegistroJornada").mockRejectedValueOnce(
      new ApiError(422, "validacion", {
        mensaje: "Actividad no asignada al operario",
      }),
    );
    vi.spyOn(clienteApi, "subirEvidencia").mockRejectedValueOnce(
      new ApiError(413, "tamano_excedido", {
        mensaje: "El archivo supera 1.5 MB",
      }),
    );

    motorSincronizacion.setEnLinea(true);
    await motorSincronizacion.sincronizarCola();

    // Comprobar que ambos se marcaron como fallidos y se conservan en cola
    const cola = await db.colaSincronizacion.toArray();
    expect(cola).toHaveLength(2);
    expect(cola.every((el) => el.estado === "fallido")).toBe(true);

    // Los registros locales se marcan con error y conservan detalles y archivos
    const jLocal = await db.registrosJornadaLocales.get(j.id);
    expect(jLocal?.estadoSincronizacion).toBe("error");
    expect(jLocal?.errorDetalle).toContain("Actividad no asignada al operario");

    const evLocal = await db.evidenciasLocales.get(ev.id);
    expect(evLocal?.estadoSincronizacion).toBe("error");
    expect(evLocal?.errorDetalle).toContain("El archivo supera 1.5 MB");
    expect(evLocal?.blob).toBeDefined();

    // Segundo ciclo de sincronización: NINGUNO debe reintentarse automáticamente
    let llamadoJornada = false;
    let llamadoEvidencia = false;
    vi.spyOn(clienteApi, "subirRegistroJornada").mockImplementation(
      async () => {
        llamadoJornada = true;
        throw new Error("No debe llamarse");
      },
    );
    vi.spyOn(clienteApi, "subirEvidencia").mockImplementation(async () => {
      llamadoEvidencia = true;
      throw new Error("No debe llamarse");
    });

    await motorSincronizacion.sincronizarCola();
    expect(llamadoJornada).toBe(false);
    expect(llamadoEvidencia).toBe(false);
  });

  it("5. Orden de envío estricto: los registros de jornada se envían siempre antes que las fotos siguiendo el contrato", async () => {
    motorSincronizacion.setEnLinea(false);

    // Se capturan en orden intercalado inverso: foto1, jornada1, foto2, jornada2
    const foto1 = await motorSincronizacion.registrarEvidencia({
      actividadId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
      operarioId: "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
      tipo: "antes",
      blob: new Blob(["f1"], { type: "image/jpeg" }),
      tamanoBytes: 50,
    });

    const jornada1 = await motorSincronizacion.registrarJornada(
      "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
      {
        tipo: "entrada_centro",
        centroTrabajoId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
        capturadoEn: "2026-11-06T08:00:00.000Z",
      },
    );

    const foto2 = await motorSincronizacion.registrarEvidencia({
      actividadId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
      operarioId: "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
      tipo: "durante",
      blob: new Blob(["f2"], { type: "image/jpeg" }),
      tamanoBytes: 60,
    });

    const jornada2 = await motorSincronizacion.registrarJornada(
      "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
      {
        tipo: "inicio_actividad",
        actividadId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
        capturadoEn: "2026-11-06T08:30:00.000Z",
      },
    );

    const ordenLlamadas: Array<{ tipo: "jornada" | "evidencia"; id: string }> =
      [];

    vi.spyOn(clienteApi, "subirRegistroJornada").mockImplementation(
      async (id, req) => {
        ordenLlamadas.push({ tipo: "jornada", id });
        return crearRespuestaJornada(
          id,
          "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
          req,
        );
      },
    );

    vi.spyOn(clienteApi, "subirEvidencia").mockImplementation(
      async (id, actividadId, tipo, capturadaEn, blob) => {
        ordenLlamadas.push({ tipo: "evidencia", id });
        return {
          id,
          operarioId: "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
          actividadId,
          tipo,
          capturadaEn,
          recibidaEn: new Date().toISOString(),
          tipoMime: "image/jpeg",
          fotoUrl: `/evidencias/${id}/foto`,
          tamanoBytes: blob.size,
        };
      },
    );

    motorSincronizacion.setEnLinea(true);
    await motorSincronizacion.sincronizarCola();

    expect(ordenLlamadas).toHaveLength(4);

    // Tipos: primero TODAS las jornadas, luego TODAS las evidencias
    expect(ordenLlamadas.map((l) => l.tipo)).toEqual([
      "jornada",
      "jornada",
      "evidencia",
      "evidencia",
    ]);

    // IDs exactos en orden cronológico por tipo
    expect(ordenLlamadas.map((l) => l.id)).toEqual([
      jornada1.id,
      jornada2.id,
      foto1.id,
      foto2.id,
    ]);
  });

  it("6. Validación de respuestas inválidas: respuesta 200 fuera de esquema o respuesta 200 HTML mantienen el elemento en la cola", async () => {
    motorSincronizacion.setEnLinea(false);

    const actividadId = "24c2957b-7b56-4b68-b8ce-e1a5f69a8473";
    const operarioId = "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474";

    const ev = await motorSincronizacion.registrarEvidencia({
      actividadId,
      operarioId,
      tipo: "antes",
      blob: new Blob(["foto-prueba"], { type: "image/jpeg" }),
      tamanoBytes: 70,
    });

    // 6a: 200 OK con JSON fuera de esquema (ej. proxy o wifi que devuelve JSON ajeno)
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => ({ datos_corruptos: true, status: "ok" }),
      text: async () => JSON.stringify({ datos_corruptos: true, status: "ok" }),
    } as unknown as Response);

    motorSincronizacion.setEnLinea(true);
    await motorSincronizacion.sincronizarCola();

    // Sigue en cola
    let cola = await db.colaSincronizacion.toArray();
    expect(cola).toHaveLength(1);
    expect(cola[0].recursoId).toBe(ev.id);
    expect(cola[0].intentos).toBe(1);

    // 6b: 200 OK con HTML (portal cautivo wifi)
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "text/html" }),
      json: async () => {
        throw new SyntaxError(
          "Unexpected token '<', '<!DOCTYPE '... is not valid JSON",
        );
      },
      text: async () =>
        "<!DOCTYPE html><html><body>Inicie sesión</body></html>",
    } as unknown as Response);

    await motorSincronizacion.sincronizarCola();

    // Sigue en cola tras segundo fallo transitorio
    cola = await db.colaSincronizacion.toArray();
    expect(cola).toHaveLength(1);
    expect(cola[0].recursoId).toBe(ev.id);
    expect(cola[0].intentos).toBe(2);

    // Recuperación con respuesta válida conforme al esquema de Evidencia
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => ({
        id: ev.id,
        actividadId,
        tipo: "antes",
        capturadaEn: new Date().toISOString(),
        recibidaEn: new Date().toISOString(),
        operarioId,
        tipoMime: "image/jpeg",
        fotoUrl: `/evidencias/${ev.id}/foto`,
        tamanoBytes: 70,
      }),
      text: async () => "",
    } as unknown as Response);

    await motorSincronizacion.sincronizarCola();

    // Se drena la cola al recibir respuesta válida
    cola = await db.colaSincronizacion.toArray();
    expect(cola).toHaveLength(0);

    const evLocal = await db.evidenciasLocales.get(ev.id);
    expect(evLocal?.estadoSincronizacion).toBe("sincronizado");
  });

  it("7. Idempotencia ante pérdida de respuesta: simular respuesta perdida tras llegar al servidor y verificar que el reintento usa el mismo UUID sin duplicar", async () => {
    motorSincronizacion.setEnLinea(false);

    const j = await motorSincronizacion.registrarJornada(
      "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
      {
        tipo: "salida_centro",
        centroTrabajoId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
        capturadoEn: "2026-11-06T17:00:00.000Z",
      },
    );

    // Simulación de base de datos del servidor para verificar no-duplicación
    const registrosEnServidor = new Map<string, RegistroJornadaSolicitud>();
    let enviosRecibidosEnServidor = 0;

    vi.spyOn(clienteApi, "subirRegistroJornada").mockImplementation(
      async (id, req) => {
        enviosRecibidosEnServidor++;
        registrosEnServidor.set(id, req);

        if (enviosRecibidosEnServidor === 1) {
          // El servidor guardó el registro, pero la conexión se corta antes de devolver el 200 al cliente
          throw new Error(
            "Network timeout: corte de conexión antes de recibir la confirmación",
          );
        }

        // En el reintento (segunda petición), el servidor responde 200 idempotente
        return crearRespuestaJornada(
          id,
          "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
          req,
        );
      },
    );

    motorSincronizacion.setEnLinea(true);

    // Primer intento: falla en el cliente pero se guardó en servidor
    await motorSincronizacion.sincronizarCola();

    let cola = await db.colaSincronizacion.toArray();
    expect(cola).toHaveLength(1);
    expect(cola[0].recursoId).toBe(j.id);
    expect(registrosEnServidor.size).toBe(1);

    // Segundo intento (reintento del motor): utiliza exactamente el mismo UUID
    await motorSincronizacion.sincronizarCola();

    cola = await db.colaSincronizacion.toArray();
    expect(cola).toHaveLength(0);

    // Se verifican exactamente 2 peticiones recibidas, pero 1 solo registro en el servidor (idempotencia estricta por UUID)
    expect(enviosRecibidosEnServidor).toBe(2);
    expect(registrosEnServidor.size).toBe(1);
    expect(registrosEnServidor.has(j.id)).toBe(true);

    const jLocal = await db.registrosJornadaLocales.get(j.id);
    expect(jLocal?.estadoSincronizacion).toBe("sincronizado");
  });

  it("8. Persistencia de sesión/cola: simular cierre y reapertura de la aplicación con la cola llena para garantizar que nada se pierde", async () => {
    motorSincronizacion.setEnLinea(false);

    // Guardar sesión activa conforme al esquema Usuario
    await db.sesion.put({
      clave: "activa",
      accessToken: "access-token-inicial",
      refreshToken: "refresh-token-inicial",
      usuario: {
        id: "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
        correo: "operario@plomada.com",
        nombre: "Operario Prueba",
        rol: "operario",
      },
      guardadoEn: new Date().toISOString(),
    });

    // Encolar una jornada y dos fotos sin conexión
    const j = await motorSincronizacion.registrarJornada(
      "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
      {
        tipo: "entrada_centro",
        centroTrabajoId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
        capturadoEn: "2026-11-06T08:00:00.000Z",
      },
    );

    const ev1 = await motorSincronizacion.registrarEvidencia({
      actividadId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
      operarioId: "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
      tipo: "antes",
      blob: new Blob(["foto-offline-1"], { type: "image/jpeg" }),
      tamanoBytes: 150,
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    const ev2 = await motorSincronizacion.registrarEvidencia({
      actividadId: "24c2957b-7b56-4b68-b8ce-e1a5f69a8473",
      operarioId: "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
      tipo: "despues",
      blob: new Blob(["foto-offline-2"], { type: "image/jpeg" }),
      tamanoBytes: 180,
    });

    // Simular "cierre" de la aplicación cerrando la base de datos Dexie
    db.close();

    // Simular "reapertura" abriendo la base de datos nuevamente
    await db.open();

    // 1. Verificar persistencia de sesión
    const sesionPersistida = await db.sesion.get("activa");
    expect(sesionPersistida).toBeDefined();
    expect(sesionPersistida?.accessToken).toBe("access-token-inicial");
    expect(sesionPersistida?.usuario.nombre).toBe("Operario Prueba");

    // 2. Verificar persistencia de la cola completa
    const colaPersistida = await db.colaSincronizacion
      .orderBy("creadoEn")
      .toArray();
    expect(colaPersistida).toHaveLength(3);
    expect(colaPersistida.map((el) => el.recursoId)).toEqual([
      j.id,
      ev1.id,
      ev2.id,
    ]);

    // 3. Verificar persistencia íntegra de los archivos y solicitudes locales
    const jPersistida = await db.registrosJornadaLocales.get(j.id);
    expect(jPersistida).toBeDefined();
    expect(jPersistida?.solicitud.tipo).toBe("entrada_centro");

    const ev1Persistida = await db.evidenciasLocales.get(ev1.id);
    const ev2Persistida = await db.evidenciasLocales.get(ev2.id);
    expect(ev1Persistida?.blob).toBeDefined();
    expect(ev1Persistida?.tamanoBytes).toBe(150);
    expect(ev2Persistida?.blob).toBeDefined();
    expect(ev2Persistida?.tamanoBytes).toBe(180);

    // 4. Al restaurar conexión en la sesión reabierta, todo se sincroniza exitosamente
    const elementosSincronizados: string[] = [];

    vi.spyOn(clienteApi, "subirRegistroJornada").mockImplementation(
      async (id, req) => {
        elementosSincronizados.push(id);
        return crearRespuestaJornada(
          id,
          "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
          req,
        );
      },
    );

    vi.spyOn(clienteApi, "subirEvidencia").mockImplementation(
      async (id, actividadId, tipo, capturadaEn, blob) => {
        elementosSincronizados.push(id);
        return {
          id,
          operarioId: "3b29c12b-7b56-4b68-b8ce-e1a5f69a8474",
          actividadId,
          tipo,
          capturadaEn,
          recibidaEn: new Date().toISOString(),
          tipoMime: "image/jpeg",
          fotoUrl: `/evidencias/${id}/foto`,
          tamanoBytes: blob.size,
        };
      },
    );

    motorSincronizacion.setEnLinea(true);
    await motorSincronizacion.sincronizarCola();

    expect(elementosSincronizados).toHaveLength(3);
    expect(elementosSincronizados).toEqual([j.id, ev1.id, ev2.id]);

    const colaFinal = await db.colaSincronizacion.toArray();
    expect(colaFinal).toHaveLength(0);
  });
});
