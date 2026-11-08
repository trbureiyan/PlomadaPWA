import type { HojaDeVida, HojaDeVidaGuardar } from "@plomada/shared";
import type { HojaDeVidaRepositoryPort } from "./ports/hoja-de-vida-repository.port";

export class GuardarHojaDeVidaUseCase {
  constructor(private readonly hojaRepo: HojaDeVidaRepositoryPort) {}

  async ejecutar(
    operarioId: string,
    input: HojaDeVidaGuardar,
  ): Promise<HojaDeVida> {
    const actualizada: HojaDeVida = {
      operarioId,
      nombreCompleto: input.nombreCompleto.trim(),
      tipoDocumento: input.tipoDocumento,
      numeroDocumento: input.numeroDocumento.trim(),
      telefono: input.telefono?.trim() || undefined,
      cargo: input.cargo.trim(),
      fechaIngreso: input.fechaIngreso,
      cursoAlturas: input.cursoAlturas,
      vencimientoAlturas: input.vencimientoAlturas,
      formacion: input.formacion,
      experiencia: input.experiencia,
    };

    await this.hojaRepo.guardar(actualizada);
    return actualizada;
  }
}
