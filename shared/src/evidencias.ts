import { z } from "zod";
import { Fecha, Id, Instante } from "./comunes";
import { LIMITES_EVIDENCIA } from "./constantes";
import { CentroTrabajo, EstadoActividad } from "./programacion";

export const TIPOS_EVIDENCIA = ["antes", "durante", "despues"] as const;
export const TipoEvidencia = z.enum(TIPOS_EVIDENCIA);
export type TipoEvidencia = z.infer<typeof TipoEvidencia>;

// Campos de texto del multipart de PUT /evidencias/:id. El archivo viaja
// aparte, en el campo LIMITES_EVIDENCIA.campoArchivo. El id va en la URL.
export const EvidenciaCampos = z.object({
  actividadId: Id,
  tipo: TipoEvidencia,
  capturadaEn: Instante,
});
export type EvidenciaCampos = z.infer<typeof EvidenciaCampos>;

export const Evidencia = EvidenciaCampos.extend({
  id: Id,
  operarioId: Id,
  recibidaEn: Instante,
  tipoMime: z.enum(LIMITES_EVIDENCIA.tiposMime),
  tamanoBytes: z.int().positive(),
  // Ruta relativa a la API: GET /evidencias/:id/foto
  fotoUrl: z.string().min(1),
});
export type Evidencia = z.infer<typeof Evidencia>;

export const RESULTADOS_REVISION = ["aprobada", "rechazada"] as const;
export const ResultadoRevision = z.enum(RESULTADOS_REVISION);
export type ResultadoRevision = z.infer<typeof ResultadoRevision>;

const revisionCampos = z.object({
  resultado: ResultadoRevision,
  observacion: z.string().max(500).optional(),
});

// Rechazar sin explicar no le sirve al operario ni al administrador.
export const RevisionSolicitud = revisionCampos.refine(
  (r) => r.resultado === "aprobada" || (r.observacion ?? "").trim().length > 0,
  { message: "Un rechazo requiere observación", path: ["observacion"] },
);
export type RevisionSolicitud = z.infer<typeof RevisionSolicitud>;

export const Revision = revisionCampos.extend({
  actividadId: Id,
  supervisorId: Id,
  revisadaEn: Instante,
});
export type Revision = z.infer<typeof Revision>;

export const ActividadResumen = z.object({
  id: Id,
  descripcion: z.string().min(1),
  estado: EstadoActividad,
  fecha: Fecha,
  operario: z.object({ id: Id, nombre: z.string().min(1) }),
  centroTrabajo: CentroTrabajo,
  evidenciasRecibidas: z.int().nonnegative(),
});
export type ActividadResumen = z.infer<typeof ActividadResumen>;

export const ActividadDetalle = ActividadResumen.extend({
  evidencias: z.array(Evidencia),
  revision: Revision.optional(),
});
export type ActividadDetalle = z.infer<typeof ActividadDetalle>;

// revision=pendiente: actividades con al menos una evidencia y sin revisión.
// Es la cola de trabajo del supervisor.
export const ActividadesFiltro = z.object({
  revision: z.enum(["pendiente", "revisada"]).optional(),
  fecha: Fecha.optional(),
  centroTrabajoId: Id.optional(),
});
export type ActividadesFiltro = z.infer<typeof ActividadesFiltro>;
