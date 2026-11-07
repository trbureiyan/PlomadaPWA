import type { Rol } from "@plomada/shared";
import {
  EvidenciaAjenaError,
  EvidenciaNoEncontradaError,
} from "../domain/errores";
import type { AlmacenamientoEvidenciasPort } from "./ports/almacenamiento-evidencias.port";
import type { EvidenciaRepositoryPort } from "./ports/evidencia-repository.port";

export class ObtenerFotoEvidenciaUseCase {
  constructor(
    private readonly evidenciaRepo: EvidenciaRepositoryPort,
    private readonly almacenamientoPort: AlmacenamientoEvidenciasPort,
  ) {}

  async ejecutar(
    id: string,
    solicitante: { id: string; rol: Rol },
  ): Promise<{ buffer: Buffer; tipoMime: string }> {
    const evidencia = await this.evidenciaRepo.buscarPorId(id);
    if (!evidencia) {
      throw new EvidenciaNoEncontradaError(id);
    }

    // El router deja pasar al rol operario; que la foto sea suya se decide aquí (nota 014).
    if (
      solicitante.rol === "operario" &&
      evidencia.operarioId !== solicitante.id
    ) {
      throw new EvidenciaAjenaError();
    }

    const archivo = await this.almacenamientoPort.obtenerFoto(
      evidencia.fotoRuta,
    );
    if (!archivo) {
      throw new EvidenciaNoEncontradaError(
        `Archivo físico para evidencia ${id} no encontrado`,
      );
    }

    return archivo;
  }
}
