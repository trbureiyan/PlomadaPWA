import type { Id, Instante, ResultadoRevision } from "@plomada/shared";

export interface RevisionEntidad {
  actividadId: Id;
  supervisorId: Id;
  resultado: ResultadoRevision;
  observacion?: string;
  revisadaEn: Instante;
}
