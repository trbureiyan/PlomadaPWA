import fs from "node:fs/promises";
import path from "node:path";
import type { AlmacenamientoEvidenciasPort } from "../../application/ports/almacenamiento-evidencias.port";

export class DiscoAlmacenamientoEvidencias implements AlmacenamientoEvidenciasPort {
  private readonly directorioBase: string;

  constructor(directorioBase = process.env.FOTOS_DIR ?? "./data/fotos") {
    this.directorioBase = path.resolve(directorioBase);
  }

  private async asegurarDirectorio(): Promise<void> {
    await fs.mkdir(this.directorioBase, { recursive: true });
  }

  async guardarFoto(id: string, buffer: Buffer, tipoMime: string): Promise<string> {
    await this.asegurarDirectorio();
    const extension = tipoMime.includes("webp") ? "webp" : "jpg";
    const nombreArchivo = `${id}.${extension}`;
    const rutaAbsoluta = path.join(this.directorioBase, nombreArchivo);

    await fs.writeFile(rutaAbsoluta, buffer);
    return rutaAbsoluta;
  }

  async obtenerFoto(fotoRuta: string): Promise<{ buffer: Buffer; tipoMime: string } | null> {
    try {
      const buffer = await fs.readFile(fotoRuta);
      const extension = path.extname(fotoRuta).toLowerCase();
      const tipoMime = extension === ".webp" ? "image/webp" : "image/jpeg";
      return { buffer, tipoMime };
    } catch {
      return null;
    }
  }
}
