import type { Id } from "@plomada/shared";
import type { ConsultaProgramacionPort } from "../../application/ports/consulta-programacion.port";

export class InMemoryConsultaProgramacion implements ConsultaProgramacionPort {
  private readonly actividades = new Map<Id, Id>();
  private readonly centros = new Set<Id>();

  agregarActividad(actividadId: Id, operarioId: Id): void {
    this.actividades.set(actividadId, operarioId);
  }

  agregarCentro(centroTrabajoId: Id): void {
    this.centros.add(centroTrabajoId);
  }

  async operarioDeActividad(actividadId: Id): Promise<Id | null> {
    return this.actividades.get(actividadId) ?? null;
  }

  async existeCentroTrabajo(centroTrabajoId: Id): Promise<boolean> {
    return this.centros.has(centroTrabajoId);
  }
}
