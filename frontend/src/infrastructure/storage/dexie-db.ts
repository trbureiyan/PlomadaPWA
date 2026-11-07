import Dexie, { type EntityTable } from "dexie";
import type {
  Asignacion,
  RegistroJornadaSolicitud,
  TipoEvidencia,
  Usuario,
} from "@plomada/shared";

export interface SesionLocal {
  clave: "activa";
  accessToken: string;
  refreshToken: string;
  usuario: Usuario;
  guardadoEn: string;
}

export interface MiProgramacionLocal {
  semanaInicio: string;
  asignaciones: Asignacion[];
  guardadoEn: string;
}

export interface RegistroJornadaLocal {
  id: string; // UUID v4 generado por el cliente
  operarioId: string;
  solicitud: RegistroJornadaSolicitud;
  ocurridoEn: string; // ISO 8601 UTC
  estadoSincronizacion: "pendiente" | "sincronizado" | "error";
  errorDetalle?: string;
}

export interface EvidenciaLocal {
  id: string; // UUID v4 generado por el cliente
  actividadId: string;
  operarioId: string;
  tipo: TipoEvidencia;
  capturadaEn: string; // ISO 8601 UTC
  blob: Blob;
  tipoMime: string;
  tamanoBytes: number;
  estadoSincronizacion: "pendiente" | "sincronizado" | "error";
  errorDetalle?: string;
}

export interface ElementoColaSincronizacion {
  id: string; // UUID del elemento en cola
  tipo: "jornada" | "evidencia";
  recursoId: string; // id del RegistroJornadaLocal o EvidenciaLocal
  intentos: number;
  ultimoError?: string;
  creadoEn: string; // ISO 8601 UTC
  estado?: "pendiente" | "fallido";
}

export class PlomadaDatabase extends Dexie {
  sesion!: EntityTable<SesionLocal, "clave">;
  miProgramacion!: EntityTable<MiProgramacionLocal, "semanaInicio">;
  registrosJornadaLocales!: EntityTable<RegistroJornadaLocal, "id">;
  evidenciasLocales!: EntityTable<EvidenciaLocal, "id">;
  colaSincronizacion!: EntityTable<ElementoColaSincronizacion, "id">;

  constructor() {
    super("PlomadaDB");

    this.version(1).stores({
      sesion: "clave",
      miProgramacion: "semanaInicio",
      registrosJornadaLocales: "id, operarioId, ocurridoEn, estadoSincronizacion",
      evidenciasLocales: "id, actividadId, operarioId, capturadaEn, estadoSincronizacion",
      colaSincronizacion: "id, tipo, recursoId, creadoEn",
    });
  }
}

export const db = new PlomadaDatabase();

/**
 * Solicita almacenamiento persistente al navegador (nota de decisión 011 / C-8).
 * En dispositivos móviles o con poco espacio libre, evita que el navegador desaloje
 * silenciosamente IndexedDB y la cola de fotos sin sincronizar.
 */
export async function solicitarAlmacenamientoPersistente(): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.storage &&
    typeof navigator.storage.persist === "function" &&
    typeof navigator.storage.persisted === "function"
  ) {
    try {
      const yaEsPersistente = await navigator.storage.persisted();
      if (!yaEsPersistente) {
        const concedido = await navigator.storage.persist();
        console.info(
          `[Storage] Almacenamiento persistente: ${concedido ? "concedido" : "denegado"}`,
        );
        return concedido;
      }
      return true;
    } catch (err) {
      console.warn("[Storage] No se pudo solicitar almacenamiento persistente:", err);
      return false;
    }
  }
  return false;
}
