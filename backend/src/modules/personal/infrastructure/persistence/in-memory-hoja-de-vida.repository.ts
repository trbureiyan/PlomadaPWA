import type { HojaDeVida } from "@plomada/shared";
import type { HojaDeVidaRepositoryPort } from "../../application/ports/hoja-de-vida-repository.port";

export class InMemoryHojaDeVidaRepository implements HojaDeVidaRepositoryPort {
  private readonly hojas = new Map<string, HojaDeVida>();

  async guardar(hoja: HojaDeVida): Promise<void> {
    this.hojas.set(hoja.operarioId, { ...hoja });
  }

  async buscarPorOperarioId(operarioId: string): Promise<HojaDeVida | null> {
    return this.hojas.get(operarioId) ?? null;
  }

  limpiar(): void {
    this.hojas.clear();
  }
}
