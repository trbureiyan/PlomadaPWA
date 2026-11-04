import { z } from "zod";

// Identificador de cualquier recurso. Lo que el cliente crea sin conexión
// (evidencias, registros de jornada) lleva el UUID generado en el celular.
export const Id = z.uuid();
export type Id = z.infer<typeof Id>;

// Instante exacto en UTC con sufijo Z. Nunca hora local: un evento capturado
// sin conexión llega horas después y la zona del celular no es de fiar.
export const Instante = z.iso.datetime();
export type Instante = z.infer<typeof Instante>;

// Día de calendario (AAAA-MM-DD) sin hora ni zona, para fechas de programación.
export const Fecha = z.iso.date();
export type Fecha = z.infer<typeof Fecha>;

export const ROLES = [
  "administrador",
  "administrativo",
  "supervisor",
  "operario",
] as const;
export const Rol = z.enum(ROLES);
export type Rol = z.infer<typeof Rol>;

export const CODIGOS_ERROR = [
  "no_autenticado", // 401: falta el token, venció o es inválido
  "sin_permiso", // 403: el rol no puede hacer esto
  "no_encontrado", // 404
  "validacion", // 422: el cuerpo o los parámetros no cumplen el esquema
  "conflicto", // 409: el id ya existe con contenido distinto
  "archivo_invalido", // 415/413: tipo o tamaño de foto fuera de los límites
  "error_interno", // 500
] as const;

// Forma única de todo error de la API.
export const ErrorApi = z.object({
  codigo: z.enum(CODIGOS_ERROR),
  mensaje: z.string(),
  campos: z
    .array(z.object({ campo: z.string(), mensaje: z.string() }))
    .optional(),
});
export type ErrorApi = z.infer<typeof ErrorApi>;

export const Salud = z.object({
  estado: z.literal("ok"),
  version: z.string(),
});
export type Salud = z.infer<typeof Salud>;

// Fechas en UTC a propósito: sumar días sobre AAAA-MM-DD no debe depender
// de la zona horaria de quien ejecuta el código.
export function sumarDias(fecha: Fecha, dias: number): Fecha {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function esLunes(fecha: Fecha): boolean {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay() === 1;
}
