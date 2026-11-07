export class ArchivoInvalidoError extends Error {
  constructor(message = "Archivo fuera del tamaño permitido (máx 1.5 MB) o formato no soportado (JPEG/WebP)") {
    super(message);
    this.name = "ArchivoInvalidoError";
  }
}

export class EvidenciaConflictoError extends Error {
  constructor(id: string) {
    super(`La evidencia con id ${id} ya existe con datos diferentes`);
    this.name = "ConflictoError";
  }
}

export class RevisionSinEvidenciaError extends Error {
  constructor(actividadId: string) {
    super(`La actividad ${actividadId} no tiene evidencias para revisar`);
    this.name = "ConflictoError";
  }
}

export class EvidenciaAjenaError extends Error {
  constructor() {
    super("La evidencia no pertenece al operario autenticado");
    this.name = "SinPermisoError";
  }
}

export class EvidenciaNoEncontradaError extends Error {
  constructor(id: string) {
    super(`Evidencia con id ${id} no encontrada`);
    this.name = "RecursoNoEncontradoError";
  }
}

export class ActividadNoEncontradaError extends Error {
  constructor(id: string) {
    super(`Actividad con id ${id} no encontrada`);
    this.name = "RecursoNoEncontradoError";
  }
}
