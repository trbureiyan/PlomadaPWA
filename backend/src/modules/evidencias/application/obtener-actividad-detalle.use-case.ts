import type { ActividadDetalle, Evidencia } from "@plomada/shared";
import { derivarEstado, type HechosDeActividadPort } from "../../programacion";
import { ActividadNoEncontradaError } from "../domain/errores";
import type { ConsultaActividadPort } from "./ports/consulta-actividad.port";
import type { EvidenciaRepositoryPort } from "./ports/evidencia-repository.port";
import type { RevisionRepositoryPort } from "./ports/revision-repository.port";

export class ObtenerActividadDetalleUseCase {
  constructor(
    private readonly consultaActividadPort: ConsultaActividadPort,
    private readonly evidenciaRepo: EvidenciaRepositoryPort,
    private readonly revisionRepo: RevisionRepositoryPort,
    private readonly hechosDeActividad: HechosDeActividadPort,
  ) {}

  async ejecutar(actividadId: string): Promise<ActividadDetalle> {
    const act = await this.consultaActividadPort.buscarActividad(actividadId);
    if (!act) {
      throw new ActividadNoEncontradaError(actividadId);
    }

    const entidadesEvidencias = await this.evidenciaRepo.listarPorActividadId(actividadId);
    const revision = await this.revisionRepo.buscarPorActividadId(actividadId);

    const estado = derivarEstado(await this.hechosDeActividad.obtenerHechosPorActividadId(actividadId));

    const evidencias: Evidencia[] = entidadesEvidencias.map((e) => ({
      id: e.id,
      actividadId: e.actividadId,
      operarioId: e.operarioId,
      tipo: e.tipo,
      capturadaEn: e.capturadaEn,
      recibidaEn: e.recibidaEn,
      tipoMime: e.tipoMime,
      tamanoBytes: e.tamanoBytes,
      fotoUrl: `/api/v1/evidencias/${e.id}/foto`,
    }));

    return {
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
      evidencias,
      revision: revision
        ? {
            actividadId: revision.actividadId,
            supervisorId: revision.supervisorId,
            resultado: revision.resultado,
            observacion: revision.observacion,
            revisadaEn: revision.revisadaEn,
          }
        : undefined,
    };
  }
}
