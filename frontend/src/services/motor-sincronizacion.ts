import type { RegistroJornadaSolicitud, TipoEvidencia } from "@plomada/shared";
import { ApiError, clienteApi } from "../infrastructure/api/cliente-api";
import { db, type EvidenciaLocal, type RegistroJornadaLocal } from "../infrastructure/storage/dexie-db";

export interface EstadoSincronizacion {
  enLinea: boolean;
  sincronizando: boolean;
  elementosPendientes: number;
  elementosFallidos?: number;
  ultimoError?: string;
}

type OyenteEstado = (estado: EstadoSincronizacion) => void;

/**
 * Calcula el tiempo de espera exponencial con variación aleatoria (jitter).
 * Regla: 2 s, 4 s, 8 s... hasta un tope de 60 s con variación aleatoria. Sin límite de intentos.
 */
export function calcularTiempoEspera(intentos: number, randomFn = Math.random): number {
  const baseMs = Math.min(60_000, 2000 * Math.pow(2, intentos));
  const variacionJitter = Math.floor(randomFn() * 1000);
  return Math.min(60_000, baseMs + variacionJitter);
}

class MotorSincronizacion {
  private sincronizando = false;
  private oyentes: Set<OyenteEstado> = new Set();
  private enLinea =
    typeof window !== "undefined" && typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? navigator.onLine
      : true;
  private temporizadorReintento: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.enLinea = true;
        this.limpiarTemporizador();
        this.notificar();
        void this.sincronizarCola();
      });

      window.addEventListener("offline", () => {
        this.enLinea = false;
        this.limpiarTemporizador();
        this.notificar();
      });

      window.addEventListener("focus", () => {
        if (this.enLinea) {
          this.limpiarTemporizador();
          void this.sincronizarCola();
        }
      });
    }
  }

  setEnLinea(enLinea: boolean): void {
    this.enLinea = enLinea;
    if (!enLinea) {
      this.limpiarTemporizador();
    }
    this.notificar();
  }

  limpiarTemporizador(): void {
    if (this.temporizadorReintento) {
      clearTimeout(this.temporizadorReintento);
      this.temporizadorReintento = null;
    }
  }

  private programarReintento(milisegundos: number): void {
    this.limpiarTemporizador();
    this.temporizadorReintento = setTimeout(() => {
      this.temporizadorReintento = null;
      if (this.enLinea) {
        void this.sincronizarCola();
      }
    }, milisegundos);
  }

  suscribir(oyente: OyenteEstado): () => void {
    this.oyentes.add(oyente);
    void this.obtenerEstado().then((st) => oyente(st));
    return () => {
      this.oyentes.delete(oyente);
    };
  }

  async obtenerEstado(): Promise<EstadoSincronizacion> {
    const total = await db.colaSincronizacion.count();
    const fallidos = await db.colaSincronizacion.filter((e) => e.estado === "fallido").count();
    const conError = await db.colaSincronizacion.filter((e) => !!e.ultimoError).first();
    return {
      enLinea: this.enLinea,
      sincronizando: this.sincronizando,
      elementosPendientes: total,
      elementosFallidos: fallidos,
      ultimoError: conError?.ultimoError,
    };
  }

  private notificar(): void {
    void this.obtenerEstado().then((st) => {
      for (const oyente of this.oyentes) {
        oyente(st);
      }
    });
  }

  async registrarJornada(operarioId: string, solicitud: RegistroJornadaSolicitud): Promise<RegistroJornadaLocal> {
    const id = crypto.randomUUID();
    const ocurridoEn = solicitud.capturadoEn;

    const local: RegistroJornadaLocal = {
      id,
      operarioId,
      solicitud,
      ocurridoEn,
      estadoSincronizacion: "pendiente",
    };

    await db.registrosJornadaLocales.put(local);
    await db.colaSincronizacion.put({
      id: crypto.randomUUID(),
      tipo: "jornada",
      recursoId: id,
      intentos: 0,
      creadoEn: ocurridoEn,
      estado: "pendiente",
    });

    this.notificar();

    if (this.enLinea) {
      void this.sincronizarCola();
    }

    return local;
  }

  async registrarEvidencia(params: {
    actividadId: string;
    operarioId: string;
    tipo: TipoEvidencia;
    blob: Blob;
    tamanoBytes: number;
  }): Promise<EvidenciaLocal> {
    const id = crypto.randomUUID();
    const capturadaEn = new Date().toISOString();

    const local: EvidenciaLocal = {
      id,
      actividadId: params.actividadId,
      operarioId: params.operarioId,
      tipo: params.tipo,
      capturadaEn,
      blob: params.blob,
      tipoMime: "image/jpeg",
      tamanoBytes: params.tamanoBytes,
      estadoSincronizacion: "pendiente",
    };

    await db.evidenciasLocales.put(local);
    await db.colaSincronizacion.put({
      id: crypto.randomUUID(),
      tipo: "evidencia",
      recursoId: id,
      intentos: 0,
      creadoEn: capturadaEn,
      estado: "pendiente",
    });

    this.notificar();

    if (this.enLinea) {
      void this.sincronizarCola();
    }

    return local;
  }

  async sincronizarCola(esReintentoPorSesion = false): Promise<void> {
    if (this.sincronizando) return;
    if (!this.enLinea) return;

    this.limpiarTemporizador();
    this.sincronizando = true;
    this.notificar();

    let reanudarTrasRenovacion = false;

    try {
      const elementos = await db.colaSincronizacion.orderBy("creadoEn").toArray();

      for (const el of elementos) {
        // Los elementos con error definitivo no se reintentan automáticamente (C-1)
        if (el.estado === "fallido") {
          continue;
        }

        try {
          if (el.tipo === "jornada") {
            const reg = await db.registrosJornadaLocales.get(el.recursoId);
            if (reg) {
              await clienteApi.subirRegistroJornada(reg.id, reg.solicitud);
              await db.registrosJornadaLocales.update(reg.id, {
                estadoSincronizacion: "sincronizado",
              });
            }
          } else if (el.tipo === "evidencia") {
            const ev = await db.evidenciasLocales.get(el.recursoId);
            if (ev) {
              await clienteApi.subirEvidencia(
                ev.id,
                ev.actividadId,
                ev.tipo,
                ev.capturadaEn,
                ev.blob,
              );
              await db.evidenciasLocales.update(ev.id, {
                estadoSincronizacion: "sincronizado",
              });
            }
          }

          // Regla general: solo se borra cuando el servidor confirma con respuesta válida (éxito)
          await db.colaSincronizacion.delete(el.id);
          this.notificar();
        } catch (error) {
          console.warn(`[SyncEngine] Error procesando elemento ${el.id}:`, error);
          const errorMsg = (error as Error).message || "Error desconocido";

          // 1. Error de sesión (401)
          const esErrorSesion = error instanceof ApiError && error.status === 401;

          // 2. Errores definitivos: 400, 403, 404, 409, 413, 415, 422 y demás 4xx (excepto 401, 408, 429)
          const esErrorDefinitivo =
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 401 &&
            error.status !== 408 &&
            error.status !== 429;

          if (esErrorSesion) {
            // Error de sesión (401): intenta renovar el token una sola vez por ciclo.
            // Si tras renovar sale 401 de nuevo, no reanuda y deja la cola pausada (evita bucle infinito).
            if (!esReintentoPorSesion) {
              const nuevoToken = await clienteApi.renovarToken();
              if (nuevoToken) {
                // Reanudar la cola tras el finally (cuando sincronizando vuelve a ser false)
                reanudarTrasRenovacion = true;
                break;
              }
            }

            // Si no puede o ya se intentó una renovación en este ciclo, pausa la cola sin descartar los elementos
            await db.colaSincronizacion.update(el.id, {
              ultimoError: "Sesión no válida o expirada (401). Pausando sincronización.",
            });
            this.notificar();
            break;
          }

          if (esErrorDefinitivo) {
            // Error definitivo: se marca como fallido, se conserva el archivo,
            // deja de reintentarse solo y se avisa al operario.
            if (el.tipo === "jornada") {
              await db.registrosJornadaLocales.update(el.recursoId, {
                estadoSincronizacion: "error",
                errorDetalle: errorMsg,
              });
            } else if (el.tipo === "evidencia") {
              await db.evidenciasLocales.update(el.recursoId, {
                estadoSincronizacion: "error",
                errorDetalle: errorMsg,
              });
            }

            // Regla general: NUNCA se borra de la cola por fallar.
            // Se marca como 'fallido' para que deje de reintentarse solo.
            await db.colaSincronizacion.update(el.id, {
              estado: "fallido",
              ultimoError: errorMsg,
              intentos: el.intentos + 1,
            });

            this.notificar();
            continue;
          }

          // 3. Errores transitorios (Sin red, timeout, cortes de conexión, 5xx, 408, 429)
          // El elemento NUNCA debe borrarse de la cola. Debe conservarse y reintentarse
          // con una espera creciente (2 s, 4 s, 8 s... tope 60 s) sin límite de intentos.
          const nuevosIntentos = el.intentos + 1;
          await db.colaSincronizacion.update(el.id, {
            intentos: nuevosIntentos,
            ultimoError: errorMsg,
          });

          const esperaMs = calcularTiempoEspera(el.intentos);
          this.programarReintento(esperaMs);
          this.notificar();
          break;
        }
      }
    } finally {
      this.sincronizando = false;
      this.notificar();
    }

    if (reanudarTrasRenovacion && this.enLinea) {
      return this.sincronizarCola(true);
    }
  }
}

export const motorSincronizacion = new MotorSincronizacion();
