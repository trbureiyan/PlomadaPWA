import { z } from "zod";
import { Fecha, Id, Instante } from "./comunes";
import { CentroTrabajo, EstadoActividad } from "./programacion";

// Borrador de prioridad P2. Es una vista de solo lectura que el cliente
// consulta por polling (ver docs/decisiones/009).
export const SeguimientoOperario = z.object({
  operario: z.object({ id: Id, nombre: z.string().min(1) }),
  centroTrabajo: CentroTrabajo.nullable(),
  entradaEn: Instante.nullable(),
  salidaEn: Instante.nullable(),
  actividades: z.array(
    z.object({
      id: Id,
      descripcion: z.string().min(1),
      estado: EstadoActividad,
      evidenciasRecibidas: z.int().nonnegative(),
    }),
  ),
});
export type SeguimientoOperario = z.infer<typeof SeguimientoOperario>;

export const SeguimientoDia = z.object({
  fecha: Fecha,
  generadoEn: Instante,
  operarios: z.array(SeguimientoOperario),
});
export type SeguimientoDia = z.infer<typeof SeguimientoDia>;

// Sin fecha: hoy.
export const SeguimientoFiltro = z.object({ fecha: Fecha.optional() });
export type SeguimientoFiltro = z.infer<typeof SeguimientoFiltro>;
