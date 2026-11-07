import type { ActividadResumen, ActividadesFiltro } from "@plomada/shared";
import { derivarEstado, type HechosDeActividadPort } from "../../programacion";
import type { ConsultaActividadPort } from "./ports/consulta-actividad.port";

export class ListarActividadesSupervisorUseCase {
  constructor(
    private readonly consultaActividadPort: ConsultaActividadPort,
    private readonly hechosDeActividad: HechosDeActividadPort,
  ) {}

  async ejecutar(filtro?: ActividadesFiltro): Promise<ActividadResumen[]> {
    const actividades = await this.consultaActividadPort.listarActividades({
      fecha: filtro?.fecha,
      centroTrabajoId: filtro?.centroTrabajoId,
    });

    if (actividades.length === 0) {
      return [];
    }

    const ids = actividades.map((a) => a.id);
    // Mismos hechos (jornada, evidencias y revisión) que usan mi-programacion y seguimiento.
    const hechosMap = await this.hechosDeActividad.obtenerHechosPorActividadesIds(ids);

    const resultados: ActividadResumen[] = [];

    for (const act of actividades) {
      const hechos = hechosMap.get(act.id) ?? {};
      const evidenciasRecibidas = hechos.evidencias?.length ?? 0;
      const revision = hechos.revision;

      // Si el filtro pide revision=pendiente: actividades con al menos una evidencia y sin revisión
      if (filtro?.revision === "pendiente") {
        if (evidenciasRecibidas === 0 || revision !== undefined) {
          continue;
        }
      } else if (filtro?.revision === "revisada") {
        if (revision === undefined) {
          continue;
        }
      }

      const estado = derivarEstado(hechos);

      resultados.push({
        id: act.id,
        descripcion: act.descripcion,
        estado,
        fecha: act.fecha,
        operario: {
          id: act.operarioId,
          nombre: act.operarioNombre,
        },
        centroTrabajo: {
          id: act.centroTrabajoId,
          nombre: act.centroTrabajoNombre,
          direccion: act.centroTrabajoDireccion,
        },
        evidenciasRecibidas,
      });
    }

    return resultados;
  }
}
