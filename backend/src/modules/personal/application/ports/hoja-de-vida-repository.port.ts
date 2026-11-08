import type { HojaDeVida } from "@plomada/shared";

export interface HojaDeVidaRepositoryPort {
  guardar(hoja: HojaDeVida): Promise<void>;
  buscarPorOperarioId(operarioId: string): Promise<HojaDeVida | null>;
}
