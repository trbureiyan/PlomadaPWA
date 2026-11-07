export interface AlmacenamientoEvidenciasPort {
  guardarFoto(id: string, buffer: Buffer, tipoMime: string): Promise<string>;
  obtenerFoto(
    fotoRuta: string,
  ): Promise<{ buffer: Buffer; tipoMime: string } | null>;
}
