import type {
  EstadoActividad,
  ResultadoRevision,
  TipoEvidencia,
} from "@plomada/shared";

export interface HechosActividad {
  tieneInicio?: boolean;
  tieneFin?: boolean;
  evidencias?: Array<{ tipo: TipoEvidencia }>;
  revision?: { resultado: ResultadoRevision };
}

/**
 * Deriva el estado de una actividad a partir de los hechos registrados.
 * Es una función pura de dominio. Reglas de docs/contrato-api.md:
 * 1. 'aprobada'   -> existe una revisión con resultado 'aprobada'
 * 2. 'rechazada'  -> existe una revisión con resultado 'rechazada'
 * 3. 'finalizada' -> existe un 'fin_actividad' o una evidencia de tipo 'despues'
 * 4. 'en_curso'   -> existe un 'inicio_actividad' o cualquier evidencia ('antes', 'durante', 'despues')
 * 5. 'pendiente'  -> ninguna de las anteriores
 */
export function derivarEstado(hechos: HechosActividad): EstadoActividad {
  if (hechos.revision?.resultado === "aprobada") {
    return "aprobada";
  }

  if (hechos.revision?.resultado === "rechazada") {
    return "rechazada";
  }

  const tieneEvidenciaDespues =
    hechos.evidencias?.some((e) => e.tipo === "despues") ?? false;
  if (hechos.tieneFin || tieneEvidenciaDespues) {
    return "finalizada";
  }

  const tieneCualquierEvidencia = (hechos.evidencias?.length ?? 0) > 0;
  if (hechos.tieneInicio || tieneCualquierEvidencia) {
    return "en_curso";
  }

  return "pendiente";
}
