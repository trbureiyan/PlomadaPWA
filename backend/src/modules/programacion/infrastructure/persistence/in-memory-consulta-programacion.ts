import type { Id } from "@plomada/shared";
import type {
  ActividadProgramada,
  ConsultaProgramacionPort,
  FiltroActividades,
} from "../../application/ports/consulta-programacion.port";

export class InMemoryConsultaProgramacion implements ConsultaProgramacionPort {
  private readonly actividades = new Map<Id, ActividadProgramada>();
  private readonly centros = new Set<Id>();

  agregarActividad(
    actividadId: Id,
    operarioId: Id,
    resto: Partial<ActividadProgramada> = {},
  ): void {
    this.actividades.set(actividadId, {
      id: actividadId,
      descripcion: "",
      operarioId,
      centroTrabajoId: "",
      centroTrabajoNombre: "",
      fecha: "2026-01-01",
      ...resto,
    });
  }

  agregarCentro(centroTrabajoId: Id): void {
    this.centros.add(centroTrabajoId);
  }

  async operarioDeActividad(actividadId: Id): Promise<Id | null> {
    return this.actividades.get(actividadId)?.operarioId ?? null;
  }

  async existeCentroTrabajo(centroTrabajoId: Id): Promise<boolean> {
    return this.centros.has(centroTrabajoId);
  }

  async buscarActividad(actividadId: Id): Promise<ActividadProgramada | null> {
    return this.actividades.get(actividadId) ?? null;
  }

  async listarActividades(
    filtro: FiltroActividades = {},
  ): Promise<ActividadProgramada[]> {
    return [...this.actividades.values()].filter(
      (a) =>
        (!filtro.fecha || a.fecha === filtro.fecha) &&
        (!filtro.centroTrabajoId ||
          a.centroTrabajoId === filtro.centroTrabajoId),
    );
  }
}
