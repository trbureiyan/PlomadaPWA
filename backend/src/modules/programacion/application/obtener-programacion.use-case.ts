import type { Asignacion, ProgramacionSemanal } from "@plomada/shared";
import { derivarEstado } from "../domain/estado-actividad";
import { ProgramacionNoEncontradaError } from "../domain/errores";
import type { CentroTrabajoRepositoryPort } from "./ports/centro-trabajo-repository.port";
import type { HechosDeActividadPort } from "./ports/hechos-de-actividad.port";
import type {
  ProgramacionPersistida,
  ProgramacionRepositoryPort,
} from "./ports/programacion-repository.port";

export class ObtenerProgramacionUseCase {
  constructor(
    private readonly programacionRepo: ProgramacionRepositoryPort,
    private readonly centroRepo: CentroTrabajoRepositoryPort,
    private readonly hechosPort: HechosDeActividadPort,
  ) {}

  async ejecutar(id: string): Promise<ProgramacionSemanal> {
    const persistida = await this.programacionRepo.buscarPorId(id);
    if (!persistida) {
      throw new ProgramacionNoEncontradaError(id);
    }

    return this.armarProgramacionSemanal(persistida);
  }

  async armarProgramacionSemanal(persistida: ProgramacionPersistida): Promise<ProgramacionSemanal> {
    const todosCentros = await this.centroRepo.listar();
    const centrosMap = new Map(todosCentros.map((c) => [c.id, c]));

    const todasActividadesIds = persistida.asignaciones.flatMap((a) => a.actividades.map((act) => act.id));
    const hechosMap = await this.hechosPort.obtenerHechosPorActividadesIds(todasActividadesIds);

    const asignaciones: Asignacion[] = persistida.asignaciones.map((a) => {
      const centro = centrosMap.get(a.centroTrabajoId) ?? {
        id: a.centroTrabajoId,
        nombre: "Centro no identificado",
      };

      return {
        id: a.id,
        operarioId: a.operarioId,
        centroTrabajo: centro,
        fecha: a.fecha,
        actividades: a.actividades.map((act) => {
          const hechos = hechosMap.get(act.id) ?? {};
          return {
            id: act.id,
            descripcion: act.descripcion,
            estado: derivarEstado(hechos),
          };
        }),
      };
    });

    return {
      id: persistida.id,
      semanaInicio: persistida.semanaInicio,
      estado: persistida.estado,
      publicadaEn: persistida.publicadaEn,
      asignaciones,
    };
  }
}
