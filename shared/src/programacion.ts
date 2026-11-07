import { z } from "zod";
import { Fecha, Id, Instante, esLunes, sumarDias } from "./comunes";

export const CentroTrabajo = z.object({
  id: Id,
  nombre: z.string().min(1),
  direccion: z.string().optional(),
});
export type CentroTrabajo = z.infer<typeof CentroTrabajo>;

export const CentroTrabajoCrear = z.object({
  nombre: z.string().min(1),
  direccion: z.string().optional(),
});
export type CentroTrabajoCrear = z.infer<typeof CentroTrabajoCrear>;

// El estado lo calcula el servidor a partir de lo que ocurrió; el cliente
// nunca lo envía. Reglas en docs/contrato-api.md.
export const ESTADOS_ACTIVIDAD = [
  "pendiente",
  "en_curso",
  "finalizada",
  "aprobada",
  "rechazada",
] as const;
export const EstadoActividad = z.enum(ESTADOS_ACTIVIDAD);
export type EstadoActividad = z.infer<typeof EstadoActividad>;

export const Actividad = z.object({
  id: Id,
  descripcion: z.string().min(1),
  estado: EstadoActividad,
});
export type Actividad = z.infer<typeof Actividad>;

export const ActividadCrear = z.object({ descripcion: z.string().min(1) });
export type ActividadCrear = z.infer<typeof ActividadCrear>;

// La asignación lleva el centro de trabajo completo y no solo su id: el
// operario debe poder ver su semana entera sin conexión con una sola respuesta.
export const Asignacion = z.object({
  id: Id,
  operarioId: Id,
  centroTrabajo: CentroTrabajo,
  fecha: Fecha,
  actividades: z.array(Actividad),
});
export type Asignacion = z.infer<typeof Asignacion>;

export const AsignacionCrear = z.object({
  operarioId: Id,
  centroTrabajoId: Id,
  fecha: Fecha,
  actividades: z.array(ActividadCrear).min(1),
});
export type AsignacionCrear = z.infer<typeof AsignacionCrear>;

export const SemanaInicio = Fecha.refine(esLunes, {
  message: "La semana empieza en lunes",
});

export const ESTADOS_PROGRAMACION = ["borrador", "publicada"] as const;
export const EstadoProgramacion = z.enum(ESTADOS_PROGRAMACION);
export type EstadoProgramacion = z.infer<typeof EstadoProgramacion>;

export const ProgramacionSemanal = z.object({
  id: Id,
  semanaInicio: SemanaInicio,
  estado: EstadoProgramacion,
  publicadaEn: Instante.optional(),
  asignaciones: z.array(Asignacion),
});
export type ProgramacionSemanal = z.infer<typeof ProgramacionSemanal>;

// El enunciado programa de lunes a viernes: una asignación fuera de esa
// ventana es un error de captura, no un caso a soportar.
export const ProgramacionCrear = z
  .object({
    semanaInicio: SemanaInicio,
    asignaciones: z.array(AsignacionCrear),
  })
  .superRefine((p, ctx) => {
    const viernes = sumarDias(p.semanaInicio, 4);
    p.asignaciones.forEach((a, i) => {
      if (a.fecha < p.semanaInicio || a.fecha > viernes) {
        ctx.addIssue({
          code: "custom",
          message:
            "La fecha debe estar entre el lunes y el viernes de la semana",
          path: ["asignaciones", i, "fecha"],
        });
      }
    });
  });
export type ProgramacionCrear = z.infer<typeof ProgramacionCrear>;

export const ProgramacionesFiltro = z.object({
  semanaInicio: SemanaInicio.optional(),
});
export type ProgramacionesFiltro = z.infer<typeof ProgramacionesFiltro>;

// Vista del operario autenticado: solo programaciones publicadas y solo sus
// asignaciones. Sin semanaInicio devuelve la semana en curso.
export const MiProgramacionFiltro = z.object({
  semanaInicio: SemanaInicio.optional(),
});
export type MiProgramacionFiltro = z.infer<typeof MiProgramacionFiltro>;

export const MiProgramacion = z.object({
  semanaInicio: SemanaInicio,
  asignaciones: z.array(Asignacion),
});
export type MiProgramacion = z.infer<typeof MiProgramacion>;
