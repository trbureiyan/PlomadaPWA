import type { Id, MiProgramacion, MiProgramacionFiltro } from "@plomada/shared";
import { lunesDeLaSemanaActual } from "../../../compartido/tiempo";
import type { ObtenerProgramacionUseCase } from "./obtener-programacion.use-case";
import type { ProgramacionRepositoryPort } from "./ports/programacion-repository.port";

export class ObtenerMiProgramacionUseCase {
  constructor(
    private readonly programacionRepo: ProgramacionRepositoryPort,
    private readonly obtenerProgramacionUseCase: ObtenerProgramacionUseCase,
  ) {}

  async ejecutar(operarioId: Id, filtro?: MiProgramacionFiltro): Promise<MiProgramacion> {
    const semanaEspecifica = filtro?.semanaInicio;
    const semanaActual = lunesDeLaSemanaActual();

    let persistida = semanaEspecifica
      ? await this.programacionRepo.buscarPublicadaParaOperario(operarioId, semanaEspecifica)
      : await this.programacionRepo.buscarPublicadaParaOperario(operarioId, semanaActual);

    // Sin semana pedida y sin programación en la actual, se entrega la publicada más reciente
    // del operario (el repositorio ordena por semana descendente), para que el celular no
    // quede en blanco. Está documentado en docs/contrato-api.md.
    if (!persistida && !semanaEspecifica) {
      persistida = await this.programacionRepo.buscarPublicadaParaOperario(operarioId);
    }

    if (!persistida) {
      return {
        semanaInicio: semanaEspecifica ?? semanaActual,
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
