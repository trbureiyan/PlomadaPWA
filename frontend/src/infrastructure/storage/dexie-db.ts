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
