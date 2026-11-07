import type { Id } from "@plomada/shared";
import type { ActividadProgramada, ConsultaProgramacionPort } from "../../../programacion";
import type { ActividadInfo, ConsultaActividadPort } from "../../application/ports/consulta-actividad.port";

// programacion es dueña de actividades, asignaciones y centros; el nombre del
// operario lo conoce identidad y llega como función desde composition-root.
export type NombresDeOperarios = (ids: Id[]) => Promise<Map<Id, string>>;

export class ConsultaActividadDesdeProgramacion implements ConsultaActividadPort {
  constructor(
    private readonly programacion: ConsultaProgramacionPort,
    private readonly nombresDeOperarios: NombresDeOperarios,
  ) {}

  async buscarActividad(id: Id): Promise<ActividadInfo | null> {
    const actividad = await this.programacion.buscarActividad(id);
    return actividad ? (await this.conNombres([actividad]))[0] : null;
  }

  async listarActividades(filtro?: { fecha?: string; centroTrabajoId?: Id }): Promise<ActividadInfo[]> {
    return this.conNombres(await this.programacion.listarActividades(filtro));
  }

  private async conNombres(actividades: ActividadProgramada[]): Promise<ActividadInfo[]> {
    const nombres = await this.nombresDeOperarios([...new Set(actividades.map((a) => a.operarioId))]);
    return actividades.map((a) => ({ ...a, operarioNombre: nombres.get(a.operarioId) ?? "" }));
  }
}
