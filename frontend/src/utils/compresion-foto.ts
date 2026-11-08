import { LIMITES_EVIDENCIA } from "@plomada/shared";

export interface ResultadoCompresion {
  blob: Blob;
  tamanoBytes: number;
  ancho: number;
  alto: number;
  tipoMime: string;
}

export async function comprimirFoto(
  archivo: File | Blob,
  ladoMayorMax = LIMITES_EVIDENCIA.ladoMayorMaximoPx,
): Promise<ResultadoCompresion> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      let ancho = img.naturalWidth || img.width;
      let alto = img.naturalHeight || img.height;

      // Calcular reducción respetando relación de aspecto
      if (ancho > ladoMayorMax || alto > ladoMayorMax) {
        if (ancho >= alto) {
          alto = Math.round((alto * ladoMayorMax) / ancho);
          ancho = ladoMayorMax;
        } else {
          ancho = Math.round((ancho * ladoMayorMax) / alto);
          alto = ladoMayorMax;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = ancho;
      canvas.height = alto;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("No se pudo obtener el contexto 2D del Canvas"));
        return;
      }

      ctx.drawImage(img, 0, 0, ancho, alto);

      // Exportar en JPEG a calidad 0.8
      const calidad = 0.8;
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Error al convertir Canvas a Blob"));
            return;
          }

          resolve({
            blob,
            tamanoBytes: blob.size,
            ancho,
            alto,
            tipoMime: "image/jpeg",
          });
        },
        "image/jpeg",
        calidad,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Error al cargar la imagen para compresión"));
    };

    img.src = url;
  });
}
