import type { Fecha, Id, MiProgramacion, MiProgramacionFiltro } from "@plomada/shared";
import type { ObtenerProgramacionUseCase } from "./obtener-programacion.use-case";
import type { ProgramacionRepositoryPort } from "./ports/programacion-repository.port";

export function obtenerLunesSemanaActual(): Fecha {
  const ahora = new Date();
  const dia = ahora.getUTCDay(); // 0: dom, 1: lun, ...
  const diff = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(ahora);
  lunes.setUTCDate(ahora.getUTCDate() + diff);
  return lunes.toISOString().slice(0, 10);
}

export class ObtenerMiProgramacionUseCase {
  constructor(
    private readonly programacionRepo: ProgramacionRepositoryPort,
    private readonly obtenerProgramacionUseCase: ObtenerProgramacionUseCase,
  ) {}

  async ejecutar(operarioId: Id, filtro?: MiProgramacionFiltro): Promise<MiProgramacion> {
    const semanaInicio = filtro?.semanaInicio ?? obtenerLunesSemanaActual();
    const persistida = await this.programacionRepo.buscarPublicadaParaOperario(operarioId, semanaInicio);

    if (!persistida) {
      return {
        semanaInicio,
        asignaciones: [],
      };
    }

    const armada = await this.obtenerProgramacionUseCase.armarProgramacionSemanal(persistida);
    const asignacionesOperario = armada.asignaciones.filter((a) => a.operarioId === operarioId);

    return {
      semanaInicio: persistida.semanaInicio,
      asignaciones: asignacionesOperario,
    };
  }
}
