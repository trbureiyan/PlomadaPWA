import { EvidenciaNoEncontradaError } from "../domain/errores";
import type { AlmacenamientoEvidenciasPort } from "./ports/almacenamiento-evidencias.port";
import type { EvidenciaRepositoryPort } from "./ports/evidencia-repository.port";

export class ObtenerFotoEvidenciaUseCase {
  constructor(
    private readonly evidenciaRepo: EvidenciaRepositoryPort,
    private readonly almacenamientoPort: AlmacenamientoEvidenciasPort,
  ) {}

  async ejecutar(id: string): Promise<{ buffer: Buffer; tipoMime: string }> {
    const evidencia = await this.evidenciaRepo.buscarPorId(id);
    if (!evidencia) {
      throw new EvidenciaNoEncontradaError(id);
    }

    const archivo = await this.almacenamientoPort.obtenerFoto(evidencia.fotoRuta);
    if (!archivo) {
      throw new EvidenciaNoEncontradaError(`Archivo físico para evidencia ${id} no encontrado`);
    }

    return archivo;
  }
}
