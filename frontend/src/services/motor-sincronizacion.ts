import type { RegistroJornadaSolicitud, TipoEvidencia } from "@plomada/shared";
import { clienteApi } from "../infrastructure/api/cliente-api";
import { db, type EvidenciaLocal, type RegistroJornadaLocal } from "../infrastructure/storage/dexie-db";

export interface EstadoSincronizacion {
  enLinea: boolean;
  sincronizando: boolean;
  elementosPendientes: number;
  ultimoError?: string;
}

type OyenteEstado = (estado: EstadoSincronizacion) => void;

class MotorSincronizacion {
  private sincronizando = false;
  private oyentes: Set<OyenteEstado> = new Set();
  private enLinea = typeof navigator !== "undefined" ? navigator.onLine : true;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.enLinea = true;
        this.notificar();
        void this.sincronizarCola();
      });

      window.addEventListener("offline", () => {
        this.enLinea = false;
        this.notificar();
      });

      window.addEventListener("focus", () => {
        if (this.enLinea) {
          void this.sincronizarCola();
        }
      });
    }
  }

  suscribir(oyente: OyenteEstado): () => void {
    this.oyentes.add(oyente);
    void this.obtenerEstado().then((st) => oyente(st));
    return () => {
      this.oyentes.delete(oyente);
    };
  }

  async obtenerEstado(): Promise<EstadoSincronizacion> {
    const pendientes = await db.colaSincronizacion.count();
    return {
      enLinea: this.enLinea,
      sincronizando: this.sincronizando,
      elementosPendientes: pendientes,
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
    });

    this.notificar();

    if (this.enLinea) {
      void this.sincronizarCola();
    }

    return local;
  }

  async sincronizarCola(): Promise<void> {
    if (this.sincronizando) return;
    if (!this.enLinea) return;

    this.sincronizando = true;
    this.notificar();

    try {
      const elementos = await db.colaSincronizacion.orderBy("creadoEn").toArray();

      for (const el of elementos) {
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

          await db.colaSincronizacion.delete(el.id);
          this.notificar();
        } catch (error) {
          console.warn(`[SyncEngine] Error procesando elemento ${el.id}:`, error);
          await db.colaSincronizacion.update(el.id, {
            intentos: el.intentos + 1,
            ultimoError: (error as Error).message,
          });
          if ((error as Error).message.includes("red") || (error as Error).message.includes("fetch")) {
            break;
          }
        }
      }
    } finally {
      this.sincronizando = false;
      this.notificar();
    }
  }
}

export const motorSincronizacion = new MotorSincronizacion();
