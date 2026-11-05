import type { RegistroJornada, RegistroJornadaSolicitud } from "@plomada/shared";
import { RegistroJornadaConflictoError } from "../domain/errores";
import type { RegistroJornadaEntidad } from "../domain/registro-jornada";
import type { RegistroJornadaRepositoryPort } from "./ports/registro-jornada-repository.port";

export interface RegistrarJornadaResultado {
  esNuevo: boolean;
  registro: RegistroJornada;
}

export class RegistrarJornadaUseCase {
  constructor(private readonly jornadaRepo: RegistroJornadaRepositoryPort) {}

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
