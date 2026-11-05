import type { ActividadResumen, ActividadesFiltro } from "@plomada/shared";
import { derivarEstado } from "../../programacion/domain/estado-actividad";
import type { ConsultaActividadPort } from "./ports/consulta-actividad.port";
import type { EvidenciaRepositoryPort } from "./ports/evidencia-repository.port";
import type { RevisionRepositoryPort } from "./ports/revision-repository.port";

export class ListarActividadesSupervisorUseCase {
  constructor(
    private readonly consultaActividadPort: ConsultaActividadPort,
    private readonly evidenciaRepo: EvidenciaRepositoryPort,
    private readonly revisionRepo: RevisionRepositoryPort,
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
    const evidenciasMap = await this.evidenciaRepo.listarPorActividadesIds(ids);
    const revisionesMap = await this.revisionRepo.buscarPorActividadesIds(ids);

    const resultados: ActividadResumen[] = [];

    for (const act of actividades) {
      const evidencias = evidenciasMap.get(act.id) ?? [];
      const revision = revisionesMap.get(act.id);

      // Si el filtro pide revision=pendiente: actividades con al menos una evidencia y sin revisión
      if (filtro?.revision === "pendiente") {
        if (evidencias.length === 0 || revision !== undefined) {
          continue;
        }
      } else if (filtro?.revision === "revisada") {
        if (revision === undefined) {
          continue;
        }
      }

      const estado = derivarEstado({
        evidencias: evidencias.map((e) => ({ tipo: e.tipo })),
        revision: revision ? { resultado: revision.resultado } : undefined,
      });

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
        evidenciasRecibidas: evidencias.length,
      });
    }

    return resultados;
  }
}
