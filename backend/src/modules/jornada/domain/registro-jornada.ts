import type { Fecha, Id, Instante, TipoRegistroJornada } from "@plomada/shared";

export interface RegistroJornadaEntidad {
  id: Id;
  operarioId: Id;
  tipo: TipoRegistroJornada;
  centroTrabajoId?: Id;
  actividadId?: Id;
  capturadoEn: Instante;
  recibidoEn: Instante;
}
