// El tipo MIME lo declara el cliente; los primeros bytes dicen qué es el archivo.
// JPEG empieza con FF D8 FF y WebP es un contenedor RIFF cuyo bytes 8 a 11 son "WEBP".
export function contenidoCoincideConTipo(tipoMime: string, contenido: Buffer): boolean {
  if (tipoMime === "image/jpeg") {
    return contenido.length >= 3 && contenido[0] === 0xff && contenido[1] === 0xd8 && contenido[2] === 0xff;
  }
  if (tipoMime === "image/webp") {
    return (
      contenido.length >= 12 &&
      contenido.toString("ascii", 0, 4) === "RIFF" &&
      contenido.toString("ascii", 8, 12) === "WEBP"
    );
  }
  return false;
}
