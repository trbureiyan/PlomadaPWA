import { sumarDias, type Fecha } from "@plomada/shared";

// El negocio opera en Colombia (UTC-5, sin horario de verano). "Hoy", el día de un evento y el
// inicio de la semana son días de calendario de Bogotá; calcularlos en UTC hace que después de
// las 19:00 locales el día ya sea el siguiente. Los instantes se siguen guardando en UTC
// (nota 005): esta zona solo decide a qué día de calendario pertenece cada uno.
export const ZONA_NEGOCIO = "America/Bogota";

// "en-CA" formatea como AAAA-MM-DD.
const formatoDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_NEGOCIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function hoyEnNegocio(ahora: Date = new Date()): Fecha {
  return formatoDia.format(ahora);
}

export function diaDeNegocio(instante: string): Fecha {
  return hoyEnNegocio(new Date(instante));
}

export function lunesDeLaSemanaActual(ahora: Date = new Date()): Fecha {
  const hoy = hoyEnNegocio(ahora);
  const diaSemana = new Date(`${hoy}T00:00:00Z`).getUTCDay(); // 0: domingo
  return sumarDias(hoy, diaSemana === 0 ? -6 : 1 - diaSemana);
}

// El contrato acepta "...:00Z" y "...:00.000Z", y Postgres devuelve siempre la segunda forma:
// dos textos distintos pueden ser el mismo instante, así que se comparan como instantes.
export function esMismoInstante(a: string, b: string): boolean {
  return Date.parse(a) === Date.parse(b);
}
