import crypto from "node:crypto";
import type { ProgramacionCrear, ProgramacionSemanal } from "@plomada/shared";
import {
  CentroTrabajoNoEncontradoError,
  ProgramacionSemanalExistenteError,
} from "../domain/errores";
import type { CentroTrabajoRepositoryPort } from "./ports/centro-trabajo-repository.port";
import type {
  AsignacionPersistida,
  ProgramacionPersistida,
  ProgramacionRepositoryPort,
} from "./ports/programacion-repository.port";

export class CrearProgramacionUseCase {
  constructor(
    private readonly programacionRepo: ProgramacionRepositoryPort,
    private readonly centroRepo: CentroTrabajoRepositoryPort,
  ) {}

  async ejecutar(input: ProgramacionCrear): Promise<ProgramacionSemanal> {
    const existente = await this.programacionRepo.buscarPorSemana(input.semanaInicio);
    if (existente) {
      throw new ProgramacionSemanalExistenteError(input.semanaInicio);
    }

    // Verificar que los centros existan
    const centrosMap = new Map<string, { id: string; nombre: string; direccion?: string }>();
    for (const asig of input.asignaciones) {
      if (!centrosMap.has(asig.centroTrabajoId)) {
        const c = await this.centroRepo.buscarPorId(asig.centroTrabajoId);
        if (!c) {
          throw new CentroTrabajoNoEncontradoError(asig.centroTrabajoId);
        }
        centrosMap.set(asig.centroTrabajoId, c);
      }
    }

    const programacionId = crypto.randomUUID();

    const asignacionesPersistidas: AsignacionPersistida[] = input.asignaciones.map((a) => {
      const asignacionId = crypto.randomUUID();
      return {
        id: asignacionId,
        operarioId: a.operarioId,
        centroTrabajoId: a.centroTrabajoId,
        fecha: a.fecha,
        actividades: a.actividades.map((act) => ({
          id: crypto.randomUUID(),
          descripcion: act.descripcion.trim(),
        })),
      };
    });

    const persistida: ProgramacionPersistida = {
      id: programacionId,
      semanaInicio: input.semanaInicio,
      estado: "borrador",
      asignaciones: asignacionesPersistidas,
    };

    await this.programacionRepo.guardar(persistida);

    return {
      id: persistida.id,
      semanaInicio: persistida.semanaInicio,
      estado: "borrador",
      asignaciones: persistida.asignaciones.map((a) => ({
        id: a.id,
        operarioId: a.operarioId,
        centroTrabajo: centrosMap.get(a.centroTrabajoId)!,
        fecha: a.fecha,
        actividades: a.actividades.map((act) => ({
          id: act.id,
          descripcion: act.descripcion,
          estado: "pendiente",
        })),
      })),
    };
  }
}
