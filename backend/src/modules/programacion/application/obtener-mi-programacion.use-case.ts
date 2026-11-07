import type {
  Fecha,
  Id,
  MiProgramacion,
  MiProgramacionFiltro,
} from "@plomada/shared";
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

  async ejecutar(
    operarioId: Id,
    filtro?: MiProgramacionFiltro,
  ): Promise<MiProgramacion> {
    const semanaEspecifica = filtro?.semanaInicio;
    const semanaActual = obtenerLunesSemanaActual();

    let persistida = semanaEspecifica
      ? await this.programacionRepo.buscarPublicadaParaOperario(
          operarioId,
          semanaEspecifica,
        )
      : await this.programacionRepo.buscarPublicadaParaOperario(
          operarioId,
          semanaActual,
        );

    // Si no se pidió semana específica y no tiene en la semana actual,
    // buscamos la programación publicada más cercana o reciente para el operario.
    if (!persistida && !semanaEspecifica) {
      persistida =
        await this.programacionRepo.buscarPublicadaParaOperario(operarioId);
    }

    if (!persistida) {
      return {
        semanaInicio: semanaEspecifica ?? semanaActual,
        asignaciones: [],
      };
    }

    const armada =
      await this.obtenerProgramacionUseCase.armarProgramacionSemanal(
        persistida,
      );
    const asignacionesOperario = armada.asignaciones.filter(
      (a) => a.operarioId === operarioId,
    );

    return {
      semanaInicio: persistida.semanaInicio,
      asignaciones: asignacionesOperario,
    };
  }
}
