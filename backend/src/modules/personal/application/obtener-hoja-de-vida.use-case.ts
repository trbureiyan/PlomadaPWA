import type { HojaDeVida } from "@plomada/shared";
import type { HojaDeVidaRepositoryPort } from "./ports/hoja-de-vida-repository.port";

export class ObtenerHojaDeVidaUseCase {
  constructor(private readonly hojaRepo: HojaDeVidaRepositoryPort) {}

  async ejecutar(operarioId: string): Promise<HojaDeVida | null> {
    return await this.hojaRepo.buscarPorOperarioId(operarioId);
  }
}
