import type { AlmacenamientoEvidenciasPort } from "../../application/ports/almacenamiento-evidencias.port";

export class InMemoryAlmacenamientoEvidencias implements AlmacenamientoEvidenciasPort {
  private readonly archivos = new Map<string, { buffer: Buffer; tipoMime: string }>();

  async guardarFoto(id: string, buffer: Buffer, tipoMime: string): Promise<string> {
    const rutaVirtual = `memoria://${id}`;
    this.archivos.set(rutaVirtual, { buffer, tipoMime });
    return rutaVirtual;
  }

  async obtenerFoto(fotoRuta: string): Promise<{ buffer: Buffer; tipoMime: string } | null> {
    return this.archivos.get(fotoRuta) ?? null;
  }

  limpiar(): void {
    this.archivos.clear();
  }
}
