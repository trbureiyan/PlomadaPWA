import type { Fecha, Id } from "@plomada/shared";

export interface ActividadProgramada {
  id: Id;
  descripcion: string;
  operarioId: Id;
  centroTrabajoId: Id;
  centroTrabajoNombre: string;
  centroTrabajoDireccion?: string;
  fecha: Fecha;
}

export interface FiltroActividades {
  fecha?: Fecha;
  centroTrabajoId?: Id;
  soloPublicadas?: boolean;
}

// Lo que otros módulos (jornada, evidencias, seguimiento) preguntan a
// programacion, dueña de las actividades, las asignaciones y los centros. Evita
// que ellos consulten esas tablas.
export interface ConsultaProgramacionPort {
  /** Operario al que está asignada la actividad, o null si la actividad no existe. */
  operarioDeActividad(actividadId: Id): Promise<Id | null>;
  existeCentroTrabajo(centroTrabajoId: Id): Promise<boolean>;
  buscarActividad(actividadId: Id): Promise<ActividadProgramada | null>;
  listarActividades(filtro?: FiltroActividades): Promise<ActividadProgramada[]>;
}
