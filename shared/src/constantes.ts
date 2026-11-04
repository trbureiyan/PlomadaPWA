export const PREFIJO_API = "/api/v1";

// Tokens: el de acceso es corto, pero la cola offline puede sincronizar
// horas después, así que el cliente lo renueva con el refresh antes de subir.
export const TOKENS = {
  accesoMinutos: 15,
  refrescoDias: 7,
} as const;

// Fotos. El cliente comprime antes de encolar; el servidor rechaza lo que
// exceda el máximo. Un solo lugar para que ambos lados coincidan.
export const LIMITES_EVIDENCIA = {
  tamanoMaximoBytes: 1_500_000,
  tamanoObjetivoBytes: 400_000,
  ladoMayorMaximoPx: 1600,
  tiposMime: ["image/jpeg", "image/webp"],
  // Nombre del campo del archivo en el multipart de PUT /evidencias/:id.
  campoArchivo: "foto",
} as const;
