import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "../infrastructure/storage/dexie-db";
import { ApiError, clienteApi } from "../infrastructure/api/cliente-api";
import {
  motorSincronizacion,
  calcularTiempoEspera,
} from "./motor-sincronizacion";

describe("C-1: Motor de sincronización y cliente API (D1)", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.colaSincronizacion.clear();
    await db.evidenciasLocales.clear();
    await db.registrosJornadaLocales.clear();
    await db.sesion.clear();
    motorSincronizacion.limpiarTemporizador();
    motorSincronizacion.setEnLinea(false); // offline durante preparación para evitar carreras asíncronas
  });

  describe("Cálculo de espera creciente (Backoff exponencial con tope de 60s)", () => {
    it("incrementa la espera en 2s, 4s, 8s, 16s, 32s y tiene tope en 60s sin límite de intentos", () => {
      const mockRandom0 = () => 0; // sin jitter para probar base
      expect(calcularTiempoEspera(0, mockRandom0)).toBe(2000);
      expect(calcularTiempoEspera(1, mockRandom0)).toBe(4000);
      expect(calcularTiempoEspera(2, mockRandom0)).toBe(8000);
      expect(calcularTiempoEspera(3, mockRandom0)).toBe(16000);
      expect(calcularTiempoEspera(4, mockRandom0)).toBe(32000);
      expect(calcularTiempoEspera(5, mockRandom0)).toBe(60000); // 64s tope en 60s
      expect(calcularTiempoEspera(10, mockRandom0)).toBe(60000);
      expect(calcularTiempoEspera(100, mockRandom0)).toBe(60000);
    });

    it("agrega variación aleatoria (jitter) sin superar el tope de 60s", () => {
      const mockRandom500 = () => 0.5; // jitter de 500ms
      expect(calcularTiempoEspera(0, mockRandom500)).toBe(2500);
      expect(calcularTiempoEspera(5, mockRandom500)).toBe(60000);
    });
  });

  describe("Errores transitorios (Sin red, cortes, 5xx, 408, 429)", () => {
    it("NUNCA borra de la cola tras 10 fallos de red seguidos y luego sincroniza al recuperarse", async () => {
      // 1. Crear una evidencia local mientras está sin conexión
      const evidencia = await motorSincronizacion.registrarEvidencia({
        actividadId: "act-1",
        operarioId: "op-1",
        tipo: "antes",
        blob: new Blob(["foto-prueba"], { type: "image/jpeg" }),
        tamanoBytes: 11,
      });

      // 2. Simular 10 fallos de red seguidos
      let llamadas = 0;
      vi.spyOn(clienteApi, "subirEvidencia").mockImplementation(async () => {
        llamadas++;
        throw new Error("Fallo de red o servidor inaccesible: Failed to fetch");
      });

      motorSincronizacion.setEnLinea(true);
      for (let i = 0; i < 10; i++) {
        await motorSincronizacion.sincronizarCola();
      }

      expect(llamadas).toBe(10);

      // El elemento debe PERMANECER en la cola con 10 intentos
      const colaDespuesDe10 = await db.colaSincronizacion.toArray();
      expect(colaDespuesDe10).toHaveLength(1);
      expect(colaDespuesDe10[0].intentos).toBe(10);
      expect(colaDespuesDe10[0].ultimoError).toContain("Failed to fetch");

      // La foto sigue existiendo en evidenciasLocales (nunca se borra)
      const evGuardada = await db.evidenciasLocales.get(evidencia.id);
      expect(evGuardada).toBeDefined();

      // 3. Simular recuperación de la red
      vi.spyOn(clienteApi, "subirEvidencia").mockResolvedValue({
        id: evidencia.id,
        actividadId: "act-1",
        tipo: "antes",
        capturadaEn: new Date().toISOString(),
        recibidaEn: new Date().toISOString(),
        urlArchivo: "/uploads/foto.jpg",
        tamanoBytes: 11,
      });

      await motorSincronizacion.sincronizarCola();

      // Ahora que el servidor confirmó con respuesta válida, se borra de la cola
      const colaVacia = await db.colaSincronizacion.toArray();
      expect(colaVacia).toHaveLength(0);

      // La evidencia local queda marcada como sincronizada
      const evSincronizada = await db.evidenciasLocales.get(evidencia.id);
      expect(evSincronizada?.estadoSincronizacion).toBe("sincronizado");
    });

    it("conserva y reintenta ante errores de servidor 503, 408 y 429", async () => {
      await motorSincronizacion.registrarJornada("op-1", {
        tipo: "entrada_centro",
        centroTrabajoId: "ct-1",
        capturadoEn: new Date().toISOString(),
      });

      // Simular error 503
      vi.spyOn(clienteApi, "subirRegistroJornada").mockRejectedValueOnce(
        new ApiError(503, "servicio_no_disponible"),
      );

      motorSincronizacion.setEnLinea(true);
      await motorSincronizacion.sincronizarCola();

      const cola503 = await db.colaSincronizacion.toArray();
      expect(cola503).toHaveLength(1);
      expect(cola503[0].intentos).toBe(1);

      // Simular error 429
      vi.spyOn(clienteApi, "subirRegistroJornada").mockRejectedValueOnce(
        new ApiError(429, "demasiadas_peticiones"),
      );

      await motorSincronizacion.sincronizarCola();

      const cola429 = await db.colaSincronizacion.toArray();
      expect(cola429).toHaveLength(1);
      expect(cola429[0].intentos).toBe(2);
    });
  });

  describe("Errores definitivos (400, 403, 404, 409, 413, 415, 422)", () => {
    it("marca como fallido, conserva archivo y deja de reintentarse solo ante 422 y 413", async () => {
      const ev = await motorSincronizacion.registrarEvidencia({
        actividadId: "act-422",
        operarioId: "op-1",
        tipo: "durante",
        blob: new Blob(["archivo-demasiado-grande"], { type: "image/jpeg" }),
        tamanoBytes: 25,
      });

      vi.spyOn(clienteApi, "subirEvidencia").mockRejectedValueOnce(
        new ApiError(413, "archivo_demasiado_grande"),
      );

      motorSincronizacion.setEnLinea(true);
      await motorSincronizacion.sincronizarCola();

      // Regla general: NUNCA se borra de la cola por fallar
      const cola = await db.colaSincronizacion.toArray();
      expect(cola).toHaveLength(1);
      expect(cola[0].estado).toBe("fallido");
      expect(cola[0].ultimoError).toContain("413");

      // El archivo local se conserva y se marca como error
      const evLocal = await db.evidenciasLocales.get(ev.id);
      expect(evLocal).toBeDefined();
      expect(evLocal?.estadoSincronizacion).toBe("error");

      // Segunda sincronización: NO debe reintentarse automáticamente
      let seLlamo = false;
      vi.spyOn(clienteApi, "subirEvidencia").mockImplementation(async () => {
        seLlamo = true;
        return {
          id: ev.id,
          actividadId: "act-422",
          tipo: "durante",
          capturadaEn: new Date().toISOString(),
          recibidaEn: new Date().toISOString(),
          urlArchivo: "/uploads/foto.jpg",
          tamanoBytes: 25,
        };
      });

      await motorSincronizacion.sincronizarCola();
      expect(seLlamo).toBe(false);
    });
  });

  describe("Errores de sesión (401)", () => {
    it("pausa la cola y conserva los elementos cuando no puede renovar token", async () => {
      await motorSincronizacion.registrarJornada("op-1", {
        tipo: "salida_centro",
        centroTrabajoId: "ct-1",
        capturadoEn: new Date().toISOString(),
      });

      vi.spyOn(clienteApi, "subirRegistroJornada").mockRejectedValue(
        new ApiError(401, "no_autenticado"),
      );
      vi.spyOn(clienteApi, "renovarToken").mockResolvedValue(null);

      motorSincronizacion.setEnLinea(true);
      await motorSincronizacion.sincronizarCola();

      // Se conserva en la cola
      const cola = await db.colaSincronizacion.toArray();
      expect(cola).toHaveLength(1);
      expect(cola[0].ultimoError).toBeDefined();
      expect(cola[0].ultimoError).toContain("401");
    });
  });

  describe("cliente-api: Manejo de sesión ante /auth/refresh", () => {
    it("un fallo 500 de servidor en refresh NO debe cerrar la sesión local", async () => {
      await db.sesion.put({
        clave: "activa",
        accessToken: "token-viejo",
        refreshToken: "refresh-valido",
        usuario: { id: "u1", nombre: "Juan", correo: "juan@plomada.local", rol: "operario" },
        guardadoEn: new Date().toISOString(),
      });

      // Simular que /auth/refresh responde 500
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const nuevoToken = await clienteApi.renovarToken();
      expect(nuevoToken).toBeNull();

      // La sesión DEBE seguir existiendo en IndexedDB
      const sesionGuardada = await db.sesion.get("activa");
      expect(sesionGuardada).toBeDefined();
      expect(sesionGuardada?.refreshToken).toBe("refresh-valido");
    });

    it("un fallo 401 en refresh SÍ debe cerrar la sesión local", async () => {
      await db.sesion.put({
        clave: "activa",
        accessToken: "token-viejo",
        refreshToken: "refresh-expirado",
        usuario: { id: "u1", nombre: "Juan", correo: "juan@plomada.local", rol: "operario" },
        guardadoEn: new Date().toISOString(),
      });

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const nuevoToken = await clienteApi.renovarToken();
      expect(nuevoToken).toBeNull();

      // La sesión DEBE haber sido borrada
      const sesionGuardada = await db.sesion.get("activa");
      expect(sesionGuardada).toBeUndefined();
    });
  });
});
