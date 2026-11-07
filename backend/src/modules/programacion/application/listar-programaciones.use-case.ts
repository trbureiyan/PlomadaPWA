import type {
  ProgramacionesFiltro,
  ProgramacionSemanal,
} from "@plomada/shared";
import type { ObtenerProgramacionUseCase } from "./obtener-programacion.use-case";
import type { ProgramacionRepositoryPort } from "./ports/programacion-repository.port";

export class ListarProgramacionesUseCase {
  constructor(
    private readonly programacionRepo: ProgramacionRepositoryPort,
    private readonly obtenerProgramacionUseCase: ObtenerProgramacionUseCase,
  ) {}

  async ejecutar(
    filtro?: ProgramacionesFiltro,
  ): Promise<ProgramacionSemanal[]> {
    const persistidas = await this.programacionRepo.listar(filtro);
    const resultados: ProgramacionSemanal[] = [];

    for (const p of persistidas) {
      const armada =
        await this.obtenerProgramacionUseCase.armarProgramacionSemanal(p);
      resultados.push(armada);
    }

    return resultados;
  }
}
