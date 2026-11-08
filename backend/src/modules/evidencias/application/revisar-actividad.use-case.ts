import type { Revision, RevisionSolicitud } from "@plomada/shared";
import {
  ActividadNoEncontradaError,
  RevisionSinEvidenciaError,
} from "../domain/errores";
import type { RevisionEntidad } from "../domain/revision";
import type { ConsultaActividadPort } from "./ports/consulta-actividad.port";
import type { EvidenciaRepositoryPort } from "./ports/evidencia-repository.port";
import type { RevisionRepositoryPort } from "./ports/revision-repository.port";

export class RevisarActividadUseCase {
  constructor(
    private readonly consultaActividadPort: ConsultaActividadPort,
    private readonly evidenciaRepo: EvidenciaRepositoryPort,
    private readonly revisionRepo: RevisionRepositoryPort,
  ) {}

  async ejecutar(
    actividadId: string,
    supervisorId: string,
    input: RevisionSolicitud,
  ): Promise<Revision> {
    const act = await this.consultaActividadPort.buscarActividad(actividadId);
    if (!act) {
      throw new ActividadNoEncontradaError(actividadId);
    }

    const evidencias =
      await this.evidenciaRepo.listarPorActividadId(actividadId);
    if (evidencias.length === 0) {
      throw new RevisionSinEvidenciaError(actividadId);
    }

    const revisadaEn = new Date().toISOString();
    const entidad: RevisionEntidad = {
      actividadId,
      supervisorId,
      resultado: input.resultado,
      observacion: input.observacion?.trim() || undefined,
      revisadaEn,
    };

    await this.revisionRepo.guardar(entidad);

    return {
      actividadId: entidad.actividadId,
      supervisorId: entidad.supervisorId,
      resultado: entidad.resultado,
      observacion: entidad.observacion,
      revisadaEn: entidad.revisadaEn,
    };
  }
}
