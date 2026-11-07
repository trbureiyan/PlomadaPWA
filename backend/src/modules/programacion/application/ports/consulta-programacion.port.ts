import type { Id } from "@plomada/shared";

// Lo que otros módulos (jornada) preguntan a programacion, dueña de las
// actividades, las asignaciones y los centros. Evita que ellos consulten esas tablas.
export interface ConsultaProgramacionPort {
  /** Operario al que está asignada la actividad, o null si la actividad no existe. */
  operarioDeActividad(actividadId: Id): Promise<Id | null>;
  existeCentroTrabajo(centroTrabajoId: Id): Promise<boolean>;
}
