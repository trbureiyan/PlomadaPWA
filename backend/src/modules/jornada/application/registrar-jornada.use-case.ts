import type { RegistroJornada, RegistroJornadaSolicitud } from "@plomada/shared";
import type { ConsultaProgramacionPort } from "../../programacion";
import {
  ActividadAjenaError,
  ActividadNoEncontradaError,
  CentroNoEncontradoError,
  RegistroJornadaConflictoError,
} from "../domain/errores";
import type { RegistroJornadaEntidad } from "../domain/registro-jornada";
import type { RegistroJornadaRepositoryPort } from "./ports/registro-jornada-repository.port";

export interface RegistrarJornadaResultado {
  esNuevo: boolean;
  registro: RegistroJornada;
}

export class RegistrarJornadaUseCase {
  constructor(
    private readonly jornadaRepo: RegistroJornadaRepositoryPort,
    private readonly programacion: ConsultaProgramacionPort,
  ) {}

  async ejecutar(
    id: string,
    operarioId: string,
    solicitud: RegistroJornadaSolicitud,
  ): Promise<RegistrarJornadaResultado> {
    const existente = await this.jornadaRepo.buscarPorId(id);
    if (existente) {
      const centroCoincide =
        ("centroTrabajoId" in solicitud && existente.centroTrabajoId === solicitud.centroTrabajoId) ||
        (!("centroTrabajoId" in solicitud) && !existente.centroTrabajoId);

      const actCoincide =
        ("actividadId" in solicitud && existente.actividadId === solicitud.actividadId) ||
        (!("actividadId" in solicitud) && !existente.actividadId);

      const coincide =
        existente.operarioId === operarioId &&
        existente.tipo === solicitud.tipo &&
        existente.capturadoEn === solicitud.capturadoEn &&
        centroCoincide &&
        actCoincide;

      if (!coincide) {
        throw new RegistroJornadaConflictoError(id);
      }

      return {
        esNuevo: false,
        registro: this.mapearRespuesta(existente),
      };
    }

    await this.verificarReferencias(operarioId, solicitud);

    const recibidoEn = new Date().toISOString();
    const entidad: RegistroJornadaEntidad = {
      id,
      operarioId,
      tipo: solicitud.tipo,
      centroTrabajoId: "centroTrabajoId" in solicitud ? solicitud.centroTrabajoId : undefined,
      actividadId: "actividadId" in solicitud ? solicitud.actividadId : undefined,
      capturadoEn: solicitud.capturadoEn,
      recibidoEn,
    };

    await this.jornadaRepo.guardar(entidad);

    return {
      esNuevo: true,
      registro: this.mapearRespuesta(entidad),
    };
  }

  // La propiedad del recurso se decide aquí y no en el router (nota 014). Sin
  // esta comprobación una clave foránea rota salía como 500 y el cliente
  // reintentaba sin fin; ahora es 404 o 403, errores definitivos.
  private async verificarReferencias(operarioId: string, solicitud: RegistroJornadaSolicitud): Promise<void> {
    if ("centroTrabajoId" in solicitud) {
      if (!(await this.programacion.existeCentroTrabajo(solicitud.centroTrabajoId))) {
        throw new CentroNoEncontradoError(solicitud.centroTrabajoId);
      }
      return;
    }
    const duenio = await this.programacion.operarioDeActividad(solicitud.actividadId);
    if (duenio === null) throw new ActividadNoEncontradaError(solicitud.actividadId);
    if (duenio !== operarioId) throw new ActividadAjenaError();
  }

  private mapearRespuesta(entidad: RegistroJornadaEntidad): RegistroJornada {
    if (entidad.tipo === "entrada_centro" || entidad.tipo === "salida_centro") {
      return {
        id: entidad.id,
        operarioId: entidad.operarioId,
        tipo: entidad.tipo,
        centroTrabajoId: entidad.centroTrabajoId!,
        capturadoEn: entidad.capturadoEn,
        recibidoEn: entidad.recibidoEn,
      };
    }
    return {
      id: entidad.id,
      operarioId: entidad.operarioId,
      tipo: entidad.tipo,
      actividadId: entidad.actividadId!,
      capturadoEn: entidad.capturadoEn,
      recibidoEn: entidad.recibidoEn,
    };
  }
}
