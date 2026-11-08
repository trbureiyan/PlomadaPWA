// Mismo criterio que backend/src/compartido/tiempo.ts (nota 016): "hoy" es el día de calendario
// de Bogotá. Con la fecha UTC, desde las 19:00 locales el día ya es el siguiente.
const ZONA_NEGOCIO = "America/Bogota";

// "en-CA" formatea como AAAA-MM-DD.
const formatoDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_NEGOCIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function hoyEnNegocio(ahora: Date = new Date()): string {
  return formatoDia.format(ahora);
}
