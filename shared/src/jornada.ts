import { z } from "zod";
import { Fecha, Id, Instante } from "./comunes";

export const TIPOS_REGISTRO_JORNADA = [
  "entrada_centro",
  "salida_centro",
  "inicio_actividad",
  "fin_actividad",
] as const;
export const TipoRegistroJornada = z.enum(TIPOS_REGISTRO_JORNADA);
export type TipoRegistroJornada = z.infer<typeof TipoRegistroJornada>;

// Entrada y salida se refieren a un centro; inicio y fin, a una actividad.
// La unión discriminada impide mezclar los campos por construcción.
const entrada = [
  z.object({
    tipo: z.literal("entrada_centro"),
    centroTrabajoId: Id,
    capturadoEn: Instante,
  }),
  z.object({
    tipo: z.literal("salida_centro"),
    centroTrabajoId: Id,
    capturadoEn: Instante,
  }),
  z.object({
    tipo: z.literal("inicio_actividad"),
    actividadId: Id,
    capturadoEn: Instante,
  }),
  z.object({
    tipo: z.literal("fin_actividad"),
    actividadId: Id,
    capturadoEn: Instante,
  }),
] as const;

// El id va en la URL (PUT /registros-jornada/:id), no en el cuerpo.
export const RegistroJornadaSolicitud = z.discriminatedUnion("tipo", entrada);
export type RegistroJornadaSolicitud = z.infer<typeof RegistroJornadaSolicitud>;

// capturadoEn es la hora real del evento según el celular; recibidoEn es la
// hora del servidor. Se guardan y se muestran las dos, sin corregir ninguna.
const servidor = { id: Id, operarioId: Id, recibidoEn: Instante };

export const RegistroJornada = z.discriminatedUnion("tipo", [
  entrada[0].extend(servidor),
  entrada[1].extend(servidor),
  entrada[2].extend(servidor),
  entrada[3].extend(servidor),
]);
export type RegistroJornada = z.infer<typeof RegistroJornada>;

export const RegistrosJornadaFiltro = z.object({
  fecha: Fecha,
  operarioId: Id.optional(),
});
export type RegistrosJornadaFiltro = z.infer<typeof RegistrosJornadaFiltro>;
