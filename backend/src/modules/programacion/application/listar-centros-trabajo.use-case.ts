import type { CentroTrabajo } from "@plomada/shared";
import type { CentroTrabajoRepositoryPort } from "./ports/centro-trabajo-repository.port";

export class ListarCentrosTrabajoUseCase {
  constructor(private readonly centroRepo: CentroTrabajoRepositoryPort) {}

  async ejecutar(): Promise<CentroTrabajo[]> {
    return this.centroRepo.listar();
  }
}
